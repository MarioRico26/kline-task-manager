import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/sessionUser'
import { fileFromPublicUrl, transcribeVoicemailAudio } from '@/lib/callsInboxTranscription'

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

export async function POST(_request: Request, context: { params: Promise<{ itemId: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canManageVoicemailImports(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { itemId } = await context.params
    const item = await prisma.voicemailImportItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        audioUrl: true,
        audioFileName: true,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Voicemail import item not found' }, { status: 404 })
    }
    if (!item.audioUrl) {
      return NextResponse.json({ error: 'This voicemail item does not have an audio file to transcribe' }, { status: 400 })
    }

    await prisma.voicemailImportItem.update({
      where: { id: item.id },
      data: {
        transcriptionStatus: 'PROCESSING',
        transcriptionError: null,
      },
    })

    try {
      const file = await fileFromPublicUrl(item.audioUrl, item.audioFileName || `voicemail-${item.id}`)
      const parsed = await transcribeVoicemailAudio(file)

      const updated = await prisma.voicemailImportItem.update({
        where: { id: item.id },
        data: {
          transcriptRaw: parsed.transcriptRaw,
          summaryDraft: parsed.summaryDraft,
          callerNameRaw: parsed.callerNameRaw,
          phoneNumberRaw: parsed.phoneNumberRaw,
          detectedAddress: parsed.detectedAddress,
          detectedTown: parsed.detectedTown,
          detectedServiceCategory: parsed.detectedServiceCategory,
          transcriptionStatus: 'COMPLETED',
          transcriptionError: null,
        },
      })

      return NextResponse.json({
        itemId: updated.id,
        transcriptionStatus: updated.transcriptionStatus,
      })
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : 'Unable to transcribe voicemail audio'
      await prisma.voicemailImportItem.update({
        where: { id: item.id },
        data: {
          transcriptionStatus: 'FAILED',
          transcriptionError: message,
        },
      })

      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (error) {
    if (isVoicemailImportTableMissing(error)) {
      return NextResponse.json(
        {
          error: 'Voicemail import tables are not active in the database yet. Audio transcription is ready in code, but the schema still needs activation.',
        },
        { status: 503 }
      )
    }

    console.error('Error retranscribing voicemail import item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
