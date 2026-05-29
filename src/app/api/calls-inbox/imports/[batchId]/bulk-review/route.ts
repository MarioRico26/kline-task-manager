import { NextResponse } from 'next/server'
import { VoicemailImportItemStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getVoicemailImportBatchCounts } from '@/lib/callsInboxImport'
import { canManageVoicemailImports, isVoicemailImportTableMissing, resolveBatchStatus } from '@/lib/callsInboxPromotion'
import { getSessionUser } from '@/lib/sessionUser'

const ALLOWED_STATUSES: VoicemailImportItemStatus[] = ['REVIEW_REQUIRED', 'READY_TO_CREATE', 'DUPLICATE', 'SKIPPED']

export async function PATCH(request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canManageVoicemailImports(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { batchId } = await context.params
    const body = (await request.json()) as {
      itemIds?: string[]
      status?: VoicemailImportItemStatus
    }

    const itemIds = Array.isArray(body.itemIds) ? Array.from(new Set(body.itemIds.filter(Boolean))) : []
    if (itemIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one voicemail item to update' }, { status: 400 })
    }

    if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Choose a valid review status for the selected voicemail items' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const items = await tx.voicemailImportItem.findMany({
        where: { id: { in: itemIds }, batchId },
        select: { id: true, createdCallRecordId: true },
      })

      if (items.length === 0) {
        throw new Error('NOT_FOUND')
      }

      const editableIds = items.filter((item) => !item.createdCallRecordId).map((item) => item.id)
      if (editableIds.length === 0) {
        throw new Error('NO_UPDATABLE_ITEMS')
      }

      await tx.voicemailImportItem.updateMany({
        where: { id: { in: editableIds } },
        data: {
          status: body.status,
          reviewedAt: new Date(),
          reviewedByUserId: sessionUser.id,
        },
      })

      const batchItems = await tx.voicemailImportItem.findMany({
        where: { batchId },
        select: { id: true, status: true },
      })

      const nextStatuses = batchItems.map((item) => item.status)
      const counts = getVoicemailImportBatchCounts(nextStatuses)

      await tx.voicemailImportBatch.update({
        where: { id: batchId },
        data: {
          status: resolveBatchStatus(nextStatuses),
          processedCount: counts.readyToCreate + counts.created + counts.skipped + counts.duplicate,
          errorCount: counts.duplicate,
        },
      })

      return {
        updatedItemIds: editableIds,
        skippedItemIds: itemIds.filter((id) => !editableIds.includes(id)),
      }
    })

    return NextResponse.json({
      batchId,
      status: body.status,
      updatedCount: result.updatedItemIds.length,
      skippedCount: result.skippedItemIds.length,
      updatedItemIds: result.updatedItemIds,
      skippedItemIds: result.skippedItemIds,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Voicemail import items not found for this batch' }, { status: 404 })
      }
      if (error.message === 'NO_UPDATABLE_ITEMS') {
        return NextResponse.json({ error: 'Selected voicemail items were already promoted and can no longer be updated in batch' }, { status: 400 })
      }
    }

    if (isVoicemailImportTableMissing(error)) {
      return NextResponse.json(
        {
          error: 'Voicemail import tables are not active in the database yet. The batch review workflow is ready in code, but the schema still needs activation.',
        },
        { status: 503 }
      )
    }

    console.error('Error updating voicemail import batch items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
