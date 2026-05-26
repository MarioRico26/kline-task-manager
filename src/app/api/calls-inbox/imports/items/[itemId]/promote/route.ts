import { NextResponse } from 'next/server'
import { Prisma, VoicemailImportBatchStatus, VoicemailImportItemStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendCallAssignmentEmail } from '@/lib/email'
import { getVoicemailImportBatchCounts } from '@/lib/callsInboxImport'
import { getSessionUser } from '@/lib/sessionUser'
import { getDefaultCallsInboxOwner } from '@/lib/userScope'

function canManageVoicemailImports(sessionUser: Awaited<ReturnType<typeof getSessionUser>>) {
  return (
    sessionUser &&
    sessionUser.canAccessCallsInbox &&
    sessionUser.canAccessVoicemailImports &&
    sessionUser.accessScope !== 'PERMITS_ONLY'
  )
}

function isVoicemailImportTableMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function resolveBatchStatus(statuses: VoicemailImportItemStatus[]): VoicemailImportBatchStatus {
  const counts = getVoicemailImportBatchCounts(statuses)
  if (counts.created === statuses.length && statuses.length > 0) return 'COMPLETED'
  if (counts.created > 0 && counts.created < statuses.length) return 'PARTIALLY_PROMOTED'
  if (counts.readyToCreate > 0 && counts.reviewRequired === 0) return 'READY_TO_PROMOTE'
  return 'REVIEW_IN_PROGRESS'
}

async function resolveDefaultCallsInboxOwnerId(actorUserId: string) {
  const configuredOwner = await getDefaultCallsInboxOwner(prisma)
  if (configuredOwner.userId) {
    const configuredUser = await prisma.user.findUnique({
      where: { id: configuredOwner.userId },
      select: { id: true },
    })

    if (configuredUser) return configuredUser.id
  }

  const configuredOwnerEmail = process.env.CALLS_INBOX_DEFAULT_OWNER_EMAIL?.trim().toLowerCase()
  if (configuredOwnerEmail) {
    const configuredUser = await prisma.user.findUnique({
      where: { email: configuredOwnerEmail },
      select: { id: true },
    })

    if (configuredUser) return configuredUser.id
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { id: true },
  })
  if (actor) return actor.id

  const fallbackAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  return fallbackAdmin?.id || null
}

export async function POST(_request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canManageVoicemailImports(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { itemId } = await context.params
    const assignedToUserId = await resolveDefaultCallsInboxOwnerId(sessionUser.id)

    if (!assignedToUserId) {
      return NextResponse.json({ error: 'No default office intake owner could be resolved' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.voicemailImportItem.findUnique({
        where: { id: itemId },
        include: {
          batch: {
            include: {
              items: { select: { status: true } },
            },
          },
        },
      })

      if (!item) {
        throw new Error('NOT_FOUND')
      }
      if (item.createdCallRecordId) {
        throw new Error('ALREADY_PROMOTED')
      }
      if (!item.transcriptRaw && !item.summaryDraft) {
        throw new Error('TRANSCRIPT_REQUIRED')
      }

      const assignedUser = await tx.user.findUnique({
        where: { id: assignedToUserId },
        select: { id: true, email: true },
      })
      if (!assignedUser) {
        throw new Error('NO_OWNER')
      }

      const callRecord = await tx.callRecord.create({
        data: {
          sourceType: 'VOICEMAIL',
          direction: 'INBOUND',
          receivedAt: item.recordedAt || item.importedAt,
          phoneNumber: item.phoneNumberRaw,
          callerNameRaw: item.callerNameRaw,
          priority: 'MEDIUM',
          status: 'NEW',
          callType: 'UNKNOWN',
          assignedToUserId: assignedUser.id,
          assignedByUserId: sessionUser.id,
          assignedAt: new Date(),
          summary: item.summaryDraft || item.transcriptRaw!.slice(0, 180),
          transcriptRaw: item.transcriptRaw || null,
          detectedAddress: item.detectedAddress,
          detectedTown: item.detectedTown,
          detectedServiceCategory: item.detectedServiceCategory,
        },
        include: {
          assignedToUser: { select: { id: true, email: true } },
        },
      })

      await tx.callActivity.createMany({
        data: [
          {
            callRecordId: callRecord.id,
            actionType: 'CREATED',
            note: `Call record created from voicemail import item ${item.id}.`,
            createdByUserId: sessionUser.id,
          },
          {
            callRecordId: callRecord.id,
            actionType: 'ASSIGNED',
            toValue: assignedUser.email,
            note: 'Imported voicemail assigned to intake owner.',
            createdByUserId: sessionUser.id,
          },
        ],
      })

      const updatedItem = await tx.voicemailImportItem.update({
        where: { id: itemId },
        data: {
          status: 'CREATED_AS_CALL_RECORD',
          createdCallRecordId: callRecord.id,
          reviewedAt: new Date(),
          reviewedByUserId: sessionUser.id,
        },
      })

      const currentStatuses = item.batch.items.map((batchItem) =>
        batchItem.status === item.status ? 'CREATED_AS_CALL_RECORD' : batchItem.status
      ) as VoicemailImportItemStatus[]

      const nextBatchStatus = resolveBatchStatus(currentStatuses)
      const counts = getVoicemailImportBatchCounts(currentStatuses)

      await tx.voicemailImportBatch.update({
        where: { id: item.batchId },
        data: {
          status: nextBatchStatus,
          processedCount: counts.readyToCreate + counts.created + counts.skipped + counts.duplicate,
          errorCount: counts.duplicate,
        },
      })

      return { callRecord, assignedUser, updatedItem }
    })

    if (result.assignedUser.email && result.assignedUser.id !== sessionUser.id) {
      await sendCallAssignmentEmail({
        to: result.assignedUser.email,
        assignedByEmail: sessionUser.email,
        assigneeEmail: result.assignedUser.email,
        callerName: result.callRecord.callerNameRaw,
        phoneNumber: result.callRecord.phoneNumber,
        summary: result.callRecord.summary,
        receivedAt: result.callRecord.receivedAt,
        callRecordId: result.callRecord.id,
        isReassignment: false,
      })
    }

    return NextResponse.json({
      itemId,
      createdCallRecordId: result.callRecord.id,
      status: result.updatedItem.status,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Voicemail import item not found' }, { status: 404 })
      }
      if (error.message === 'ALREADY_PROMOTED') {
        return NextResponse.json({ error: 'This voicemail item was already promoted to the live inbox' }, { status: 400 })
      }
      if (error.message === 'TRANSCRIPT_REQUIRED') {
        return NextResponse.json({ error: 'Complete or paste a transcript before promoting this voicemail into the live inbox' }, { status: 400 })
      }
      if (error.message === 'NO_OWNER') {
        return NextResponse.json({ error: 'No default office intake owner could be resolved' }, { status: 400 })
      }
    }

    if (isVoicemailImportTableMissing(error)) {
      return NextResponse.json(
        {
          error: 'Voicemail import tables are not active in the database yet. The promote workflow is ready in code, but the schema still needs activation.',
        },
        { status: 503 }
      )
    }

    console.error('Error promoting voicemail import item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
