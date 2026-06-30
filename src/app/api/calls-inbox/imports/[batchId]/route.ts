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

function normalizePhone(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '')
}

function normalizeText(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(value: string | null | undefined) {
  return normalizeText(value)
    .split(' ')
    .filter((part) => part.length >= 4)
}

function buildDuplicateSuggestions(
  items: Array<{
    id: string
    recordedAt: Date | null
    phoneNumberRaw: string | null
    callerNameRaw: string | null
    summaryDraft: string | null
    transcriptRaw: string | null
    detectedAddress: string | null
  }>,
  callRecords: Array<{
    id: string
    receivedAt: Date
    phoneNumber: string | null
    callerNameRaw: string | null
    summary: string
    detectedAddress: string | null
  }>
) {
  return new Map(
    items.map((item) => {
      const itemPhone = normalizePhone(item.phoneNumberRaw)
      const itemCaller = normalizeText(item.callerNameRaw)
      const itemAddress = normalizeText(item.detectedAddress)
      const itemText = `${normalizeText(item.summaryDraft)} ${normalizeText(item.transcriptRaw)}`
      const itemTokens = new Set(tokenize(itemText))

      const matches = callRecords
        .map((record) => {
          let score = 0
          const reasons: string[] = []

          const recordPhone = normalizePhone(record.phoneNumber)
          if (itemPhone && recordPhone && itemPhone === recordPhone) {
            score += 100
            reasons.push('Same phone')
          }

          const recordCaller = normalizeText(record.callerNameRaw)
          if (itemCaller && recordCaller && (recordCaller.includes(itemCaller) || itemCaller.includes(recordCaller))) {
            score += 30
            reasons.push('Similar caller')
          }

          const recordAddress = normalizeText(record.detectedAddress)
          if (itemAddress && recordAddress && (recordAddress.includes(itemAddress) || itemAddress.includes(recordAddress))) {
            score += 45
            reasons.push('Same address')
          }

          if (itemTokens.size > 0) {
            const recordTokens = new Set(tokenize(record.summary))
            const overlap = Array.from(itemTokens).filter((token) => recordTokens.has(token)).length
            if (overlap >= 3) {
              score += Math.min(overlap * 5, 25)
              reasons.push(`Summary overlap (${overlap})`)
            }
          }

          return score >= 60
            ? {
                callRecordId: record.id,
                receivedAt: record.receivedAt.toISOString(),
                callerNameRaw: record.callerNameRaw,
                phoneNumber: record.phoneNumber,
                summary: record.summary,
                detectedAddress: record.detectedAddress,
                score,
                reasons,
              }
            : null
        })
        .filter(Boolean)
        .sort((left, right) => (right?.score || 0) - (left?.score || 0))
        .slice(0, 3)

      return [item.id, matches]
    })
  )
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

    const duplicateCandidatePool = await prisma.callRecord.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 1500,
      select: {
        id: true,
        receivedAt: true,
        phoneNumber: true,
        callerNameRaw: true,
        summary: true,
        detectedAddress: true,
      },
    })

    const possibleDuplicatesByItemId = buildDuplicateSuggestions(
      batch.items.map((item) => ({
        id: item.id,
        recordedAt: item.recordedAt,
        phoneNumberRaw: item.phoneNumberRaw,
        callerNameRaw: item.callerNameRaw,
        summaryDraft: item.summaryDraft,
        transcriptRaw: item.transcriptRaw,
        detectedAddress: item.detectedAddress,
      })),
      duplicateCandidatePool
    )

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
        possibleDuplicates: possibleDuplicatesByItemId.get(item.id) || [],
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
