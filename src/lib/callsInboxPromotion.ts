import { Prisma, PrismaClient, VoicemailImportBatchStatus, VoicemailImportItemStatus } from '@prisma/client'
import { getVoicemailImportBatchCounts } from '@/lib/callsInboxImport'
import { getDefaultCallsInboxOwner } from '@/lib/userScope'

type SessionLike = {
  id: string
  email: string
  accessScope: 'ALL' | 'PERMITS_ONLY' | 'NONE'
  canAccessCallsInbox: boolean
  canAccessVoicemailImports: boolean
}

export function canManageVoicemailImports(sessionUser: SessionLike | null | undefined) {
  return (
    sessionUser &&
    sessionUser.canAccessCallsInbox &&
    sessionUser.canAccessVoicemailImports &&
    sessionUser.accessScope !== 'PERMITS_ONLY'
  )
}

export function isVoicemailImportTableMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export function resolveBatchStatus(statuses: VoicemailImportItemStatus[]): VoicemailImportBatchStatus {
  const counts = getVoicemailImportBatchCounts(statuses)
  if (counts.created === statuses.length && statuses.length > 0) return 'COMPLETED'
  if (counts.created > 0 && counts.created < statuses.length) return 'PARTIALLY_PROMOTED'
  if (counts.readyToCreate > 0 && counts.reviewRequired === 0) return 'READY_TO_PROMOTE'
  return 'REVIEW_IN_PROGRESS'
}

export async function resolveDefaultCallsInboxOwnerId(prisma: PrismaClient, actorUserId: string) {
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

export async function promoteVoicemailImportItems(params: {
  prisma: PrismaClient
  itemIds: string[]
  actorUserId: string
  actorEmail: string
  requireReadyStatus?: boolean
}) {
  const { prisma, itemIds, actorUserId, requireReadyStatus = false } = params
  const uniqueItemIds = Array.from(new Set(itemIds.filter(Boolean)))

  if (uniqueItemIds.length === 0) {
    throw new Error('NO_ITEMS_SELECTED')
  }

  const assignedToUserId = await resolveDefaultCallsInboxOwnerId(prisma, actorUserId)
  if (!assignedToUserId) {
    throw new Error('NO_OWNER')
  }

  const result = await prisma.$transaction(async (tx) => {
    const items = await tx.voicemailImportItem.findMany({
      where: { id: { in: uniqueItemIds } },
      include: {
        batch: {
          include: {
            items: { select: { id: true, status: true } },
          },
        },
      },
    })

    if (items.length === 0) {
      throw new Error('NOT_FOUND')
    }

    const batchIds = Array.from(new Set(items.map((item) => item.batchId)))
    if (batchIds.length !== 1) {
      throw new Error('MULTIPLE_BATCHES')
    }

    const assignedUser = await tx.user.findUnique({
      where: { id: assignedToUserId },
      select: { id: true, email: true },
    })
    if (!assignedUser) {
      throw new Error('NO_OWNER')
    }

    const promotableItems = items.filter((item) => {
      if (item.createdCallRecordId) return false
      if (requireReadyStatus && item.status !== 'READY_TO_CREATE') return false
      if (!item.transcriptRaw && !item.summaryDraft) return false
      return true
    })

    if (promotableItems.length === 0) {
      throw new Error(requireReadyStatus ? 'NO_READY_ITEMS' : 'TRANSCRIPT_REQUIRED')
    }

    const promotedCallRecords: Array<{
      id: string
      callerNameRaw: string | null
      phoneNumber: string | null
      summary: string
      receivedAt: Date
      assignedToUser: { id: string; email: string | null }
      importItemId: string
    }> = []

    for (const item of promotableItems) {
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
          assignedByUserId: actorUserId,
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
            createdByUserId: actorUserId,
          },
          {
            callRecordId: callRecord.id,
            actionType: 'ASSIGNED',
            toValue: assignedUser.email,
            note: 'Imported voicemail assigned to intake owner.',
            createdByUserId: actorUserId,
          },
        ],
      })

      await tx.voicemailImportItem.update({
        where: { id: item.id },
        data: {
          status: 'CREATED_AS_CALL_RECORD',
          createdCallRecordId: callRecord.id,
          reviewedAt: new Date(),
          reviewedByUserId: actorUserId,
        },
      })

      promotedCallRecords.push({
        id: callRecord.id,
        callerNameRaw: callRecord.callerNameRaw,
        phoneNumber: callRecord.phoneNumber,
        summary: callRecord.summary,
        receivedAt: callRecord.receivedAt,
        assignedToUser: {
          id: callRecord.assignedToUser?.id || assignedUser.id,
          email: callRecord.assignedToUser?.email || assignedUser.email,
        },
        importItemId: item.id,
      })
    }

    const batchId = promotableItems[0].batchId
    const currentStatuses = items[0].batch.items.map((batchItem) =>
      promotableItems.some((item) => item.id === batchItem.id) ? 'CREATED_AS_CALL_RECORD' : batchItem.status
    ) as VoicemailImportItemStatus[]

    const nextBatchStatus = resolveBatchStatus(currentStatuses)
    const counts = getVoicemailImportBatchCounts(currentStatuses)

    await tx.voicemailImportBatch.update({
      where: { id: batchId },
      data: {
        status: nextBatchStatus,
        processedCount: counts.readyToCreate + counts.created + counts.skipped + counts.duplicate,
        errorCount: counts.duplicate,
      },
    })

    const skippedItemIds = items
      .filter((item) => !promotableItems.some((candidate) => candidate.id === item.id))
      .map((item) => item.id)

    return {
      batchId,
      assignedUser,
      promotedCallRecords,
      promotedItemIds: promotableItems.map((item) => item.id),
      skippedItemIds,
    }
  })

  return result
}
