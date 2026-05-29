import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendCallAssignmentEmail } from '@/lib/email'
import {
  canManageVoicemailImports,
  isVoicemailImportTableMissing,
  promoteVoicemailImportItems,
} from '@/lib/callsInboxPromotion'
import { getSessionUser } from '@/lib/sessionUser'

export async function POST(_request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canManageVoicemailImports(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { itemId } = await context.params
    const result = await promoteVoicemailImportItems({
      prisma,
      itemIds: [itemId],
      actorUserId: sessionUser.id,
      actorEmail: sessionUser.email,
      requireReadyStatus: false,
    })

    const callRecord = result.promotedCallRecords[0]
    if (result.assignedUser.email && result.assignedUser.id !== sessionUser.id && callRecord) {
      await sendCallAssignmentEmail({
        to: result.assignedUser.email,
        assignedByEmail: sessionUser.email,
        assigneeEmail: result.assignedUser.email,
        callerName: callRecord.callerNameRaw,
        phoneNumber: callRecord.phoneNumber,
        summary: callRecord.summary,
        receivedAt: callRecord.receivedAt,
        callRecordId: callRecord.id,
        isReassignment: false,
      })
    }

    return NextResponse.json({
      itemId,
      createdCallRecordId: callRecord?.id || null,
      status: 'CREATED_AS_CALL_RECORD',
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Voicemail import item not found' }, { status: 404 })
      }
      if (error.message === 'ALREADY_PROMOTED') {
        return NextResponse.json({ error: 'This voicemail item was already promoted to the live inbox' }, { status: 400 })
      }
      if (error.message === 'NO_ITEMS_SELECTED') {
        return NextResponse.json({ error: 'Select at least one voicemail item to promote' }, { status: 400 })
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
