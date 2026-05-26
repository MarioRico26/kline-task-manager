import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { uploadFile } from '@/lib/upload'
import { getSessionUser } from '@/lib/sessionUser'
import {
  isSupportedVoicemailAudioFile,
  MAX_VOICEMAIL_AUDIO_BYTES,
  transcribeVoicemailAudio,
} from '@/lib/callsInboxTranscription'

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

export async function POST(request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canManageVoicemailImports(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { batchId } = await context.params
    const batch = await prisma.voicemailImportBatch.findUnique({
      where: { id: batchId },
      select: { id: true },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Voicemail import batch not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const recordedAtInput = (formData.get('recordedAt') as string | null)?.trim() || null

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Select one voicemail audio file to upload' }, { status: 400 })
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: 'Empty audio files cannot be uploaded' }, { status: 400 })
    }
    if (file.size > MAX_VOICEMAIL_AUDIO_BYTES) {
      return NextResponse.json(
        {
          error: `File "${file.name}" is too large. Keep each voicemail audio file under ${(MAX_VOICEMAIL_AUDIO_BYTES / (1024 * 1024)).toFixed(1)} MB.`,
        },
        { status: 413 }
      )
    }
    if (!isSupportedVoicemailAudioFile(file)) {
      return NextResponse.json({ error: 'Upload a supported voicemail audio file (.mp3, .m4a, .wav, .mp4, .aac, .ogg, .webm).' }, { status: 400 })
    }

    const item = await prisma.voicemailImportItem.create({
      data: {
        batchId: batch.id,
        recordedAt: recordedAtInput ? new Date(recordedAtInput) : null,
        audioFileName: file.name,
        audioMimeType: file.type || 'application/octet-stream',
        audioSizeBytes: file.size,
        status: 'REVIEW_REQUIRED',
        transcriptionStatus: 'PROCESSING',
      },
      select: { id: true },
    })

    try {
      const audioUrl = await uploadFile(file, `calls-inbox/voicemail-imports/${batch.id}`)
      const parsed = await transcribeVoicemailAudio(file)

      await prisma.voicemailImportItem.update({
        where: { id: item.id },
        data: {
          audioUrl,
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
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : 'Unable to transcribe voicemail audio'

      await prisma.voicemailImportItem.update({
        where: { id: item.id },
        data: {
          transcriptionStatus: 'FAILED',
          transcriptionError: message,
        },
      })

      await prisma.voicemailImportBatch.update({
        where: { id: batch.id },
        data: {
          status: 'REVIEW_IN_PROGRESS',
          itemCount: { increment: 1 },
        },
      })

      return NextResponse.json({
        itemId: item.id,
        warning: message,
        transcriptionStatus: 'FAILED',
      })
    }

    await prisma.voicemailImportBatch.update({
      where: { id: batch.id },
      data: {
        status: 'REVIEW_IN_PROGRESS',
        itemCount: { increment: 1 },
      },
    })

    return NextResponse.json({
      itemId: item.id,
      transcriptionStatus: 'COMPLETED',
    })
  } catch (error) {
    if (isVoicemailImportTableMissing(error)) {
      return NextResponse.json(
        {
          error: 'Voicemail import tables are not active in the database yet. Audio upload is ready in code, but the schema still needs activation.',
        },
        { status: 503 }
      )
    }

    console.error('Error uploading voicemail audio:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
