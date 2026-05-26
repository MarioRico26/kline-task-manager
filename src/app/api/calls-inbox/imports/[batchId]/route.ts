import { NextResponse } from 'next/server'
import { Prisma, VoicemailImportBatchStatus, VoicemailImportItemStatus } from '@prisma/client'
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

function mapBatchRecord(batch: {
  id: string
  source: string
  status: VoicemailImportBatchStatus
  notes: string | null
  itemCount: number
  processedCount: number
  errorCount: number
  uploadedAt: Date
  uploadedByUser: { id: string; email: string } | null
  items: { status: VoicemailImportItemStatus }[]
}) {
  return {
    id: batch.id,
    source: batch.source,
    status: batch.status,
    notes: batch.notes,
    itemCount: batch.itemCount,
    processedCount: batch.processedCount,
    errorCount: batch.errorCount,
    uploadedAt: batch.uploadedAt.toISOString(),
    uploadedByUser: batch.uploadedByUser,
    counts: getVoicemailImportBatchCounts(batch.items.map((item) => item.status)),
  }
}

export async function GET(_request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canManageVoicemailImports(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { batchId } = await context.params

    const batch = await prisma.voicemailImportBatch.findUnique({
      where: { id: batchId },
      include: {
        uploadedByUser: { select: { id: true, email: true } },
        items: {
          orderBy: [{ status: 'asc' }, { importedAt: 'asc' }],
          include: {
            reviewedByUser: { select: { id: true, email: true } },
          },
        },
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Voicemail import batch not found' }, { status: 404 })
    }

    return NextResponse.json({
      batch: mapBatchRecord(batch),
      items: batch.items.map((item) => ({
        id: item.id,
        recordedAt: item.recordedAt?.toISOString() || null,
        phoneNumberRaw: item.phoneNumberRaw,
        callerNameRaw: item.callerNameRaw,
        transcriptRaw: item.transcriptRaw,
        audioUrl: item.audioUrl,
        audioFileName: item.audioFileName,
        audioMimeType: item.audioMimeType,
        audioSizeBytes: item.audioSizeBytes,
        transcriptionStatus: item.transcriptionStatus,
        transcriptionError: item.transcriptionError,
        summaryDraft: item.summaryDraft,
        detectedAddress: item.detectedAddress,
        detectedTown: item.detectedTown,
        detectedServiceCategory: item.detectedServiceCategory,
        status: item.status,
        reviewNotes: item.reviewNotes,
        reviewedAt: item.reviewedAt?.toISOString() || null,
        reviewedByUser: item.reviewedByUser,
        createdCallRecordId: item.createdCallRecordId,
      })),
      moduleReady: true,
    })
  } catch (error) {
    if (isVoicemailImportTableMissing(error)) {
      return NextResponse.json({
        batch: null,
        items: [],
        moduleReady: false,
        message: 'Voicemail import tables are defined in code, but the database tables have not been activated yet.',
      })
    }

    console.error('Error fetching voicemail import batch detail:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
