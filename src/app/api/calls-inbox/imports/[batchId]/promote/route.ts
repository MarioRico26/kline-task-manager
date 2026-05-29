import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendCallAssignmentDigestEmail } from '@/lib/email'
import {
  canManageVoicemailImports,
  isVoicemailImportTableMissing,
  promoteVoicemailImportItems,
} from '@/lib/callsInboxPromotion'
import { getSessionUser } from '@/lib/sessionUser'

export async function POST(request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canManageVoicemailImports(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { batchId } = await context.params
    const body = (await request.json().catch(() => ({}))) as {
      itemIds?: string[]
      mode?: 'selected' | 'all_ready'
      sendDigestEmail?: boolean
    }

    const mode = body.mode || 'selected'
    let itemIds = Array.isArray(body.itemIds) ? body.itemIds.filter(Boolean) : []

    if (mode === 'all_ready') {
      const readyItems = await prisma.voicemailImportItem.findMany({
        where: {
          batchId,
          status: 'READY_TO_CREATE',
          createdCallRecordId: null,
        },
        select: { id: true },
        orderBy: { importedAt: 'asc' },
      })
      itemIds = readyItems.map((item) => item.id)
      if (itemIds.length === 0) {
        return NextResponse.json({ error: 'There are no ready voicemail items to promote in this batch' }, { status: 400 })
      }
    }

    const result = await promoteVoicemailImportItems({
      prisma,
      itemIds,
      actorUserId: sessionUser.id,
      actorEmail: sessionUser.email,
      requireReadyStatus: true,
    })

    if ((body.sendDigestEmail ?? true) && result.promotedCallRecords.length > 0) {
      const recordsByAssignee = new Map<string, typeof result.promotedCallRecords>()

      for (const record of result.promotedCallRecords) {
        const email = record.assignedToUser.email
        if (!email || record.assignedToUser.id === sessionUser.id) continue
        const existing = recordsByAssignee.get(email) || []
        existing.push(record)
        recordsByAssignee.set(email, existing)
      }

      const batch = await prisma.voicemailImportBatch.findUnique({
        where: { id: batchId },
        select: { source: true },
      })

      await Promise.all(
        Array.from(recordsByAssignee.entries()).map(([email, records]) =>
          sendCallAssignmentDigestEmail({
            to: email,
            assignedByEmail: sessionUser.email,
            assigneeEmail: email,
            batchLabel: batch?.source || `Batch ${batchId}`,
            records: records.map((record) => ({
              callerName: record.callerNameRaw,
              phoneNumber: record.phoneNumber,
              summary: record.summary,
              receivedAt: record.receivedAt,
              callRecordId: record.id,
            })),
          })
        )
      )
    }

    return NextResponse.json({
      batchId,
      promotedCount: result.promotedItemIds.length,
      skippedCount: result.skippedItemIds.length,
      promotedItemIds: result.promotedItemIds,
      skippedItemIds: result.skippedItemIds,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Voicemail import batch items not found' }, { status: 404 })
      }
      if (error.message === 'NO_ITEMS_SELECTED') {
        return NextResponse.json({ error: 'Select at least one voicemail item to promote' }, { status: 400 })
      }
      if (error.message === 'NO_READY_ITEMS') {
        return NextResponse.json({ error: 'Only items marked Ready can be promoted in batch' }, { status: 400 })
      }
      if (error.message === 'TRANSCRIPT_REQUIRED') {
        return NextResponse.json({ error: 'Every selected voicemail needs a transcript or summary before batch promotion' }, { status: 400 })
      }
      if (error.message === 'MULTIPLE_BATCHES') {
        return NextResponse.json({ error: 'Batch promotion must use items from a single voicemail batch' }, { status: 400 })
      }
      if (error.message === 'NO_OWNER') {
        return NextResponse.json({ error: 'No default office intake owner could be resolved' }, { status: 400 })
      }
    }

    if (isVoicemailImportTableMissing(error)) {
      return NextResponse.json(
        {
          error: 'Voicemail import tables are not active in the database yet. The batch promote workflow is ready in code, but the schema still needs activation.',
        },
        { status: 503 }
      )
    }

    console.error('Error promoting voicemail import batch items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
