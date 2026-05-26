import { NextResponse } from 'next/server'
import { CallServiceCategory, Prisma, VoicemailImportBatchStatus, VoicemailImportItemStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getVoicemailImportBatchCounts } from '@/lib/callsInboxImport'
import { getSessionUser } from '@/lib/sessionUser'

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

export async function PATCH(request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canManageVoicemailImports(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { itemId } = await context.params
    const body = (await request.json()) as {
      status?: string
      callerNameRaw?: string
      phoneNumberRaw?: string
      transcriptRaw?: string
      summaryDraft?: string
      detectedAddress?: string
      detectedTown?: string
      detectedServiceCategory?: string
      reviewNotes?: string
    }

    const updatedItem = await prisma.$transaction(async (tx) => {
      const existing = await tx.voicemailImportItem.findUnique({
        where: { id: itemId },
        select: { id: true, batchId: true, createdCallRecordId: true },
      })

      if (!existing) {
        throw new Error('NOT_FOUND')
      }

      const item = await tx.voicemailImportItem.update({
        where: { id: itemId },
        data: {
          status: (body.status as VoicemailImportItemStatus | undefined) ?? undefined,
          callerNameRaw: body.callerNameRaw?.trim() || null,
          phoneNumberRaw: body.phoneNumberRaw?.trim() || null,
          transcriptRaw: body.transcriptRaw?.trim() || undefined,
          summaryDraft: body.summaryDraft?.trim() || null,
          detectedAddress: body.detectedAddress?.trim() || null,
          detectedTown: body.detectedTown?.trim() || null,
          detectedServiceCategory: (body.detectedServiceCategory as CallServiceCategory | undefined) ?? null,
          reviewNotes: body.reviewNotes?.trim() || null,
          reviewedAt: new Date(),
          reviewedByUserId: sessionUser.id,
        },
        include: {
          batch: {
            include: {
              items: { select: { status: true } },
            },
          },
          reviewedByUser: { select: { id: true, email: true } },
        },
      })

      const nextBatchStatus = resolveBatchStatus(item.batch.items.map((batchItem) => batchItem.status))
      const processedCount = item.batch.items.filter((batchItem) =>
        ['READY_TO_CREATE', 'CREATED_AS_CALL_RECORD', 'SKIPPED', 'DUPLICATE'].includes(batchItem.status)
      ).length

      const errorCount = item.batch.items.filter((batchItem) => batchItem.status === 'DUPLICATE').length

      await tx.voicemailImportBatch.update({
        where: { id: item.batchId },
        data: {
          status: nextBatchStatus,
          processedCount,
          errorCount,
        },
      })

      return item
    })

    return NextResponse.json({
      id: updatedItem.id,
      status: updatedItem.status,
      reviewedAt: updatedItem.reviewedAt?.toISOString() || null,
      reviewedByUser: updatedItem.reviewedByUser,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Voicemail import item not found' }, { status: 404 })
    }
    if (isVoicemailImportTableMissing(error)) {
      return NextResponse.json(
        {
          error: 'Voicemail import tables are not active in the database yet. The review workflow is ready in code, but the schema still needs activation.',
        },
        { status: 503 }
      )
    }

    console.error('Error updating voicemail import item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
