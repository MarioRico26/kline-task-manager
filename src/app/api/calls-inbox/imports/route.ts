import { NextResponse } from 'next/server'
import { Prisma, VoicemailImportBatchStatus, VoicemailImportItemStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { parseVoicemailImportDump, getVoicemailImportBatchCounts } from '@/lib/callsInboxImport'
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

export async function GET() {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canManageVoicemailImports(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const batches = await prisma.voicemailImportBatch.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: 50,
      include: {
        uploadedByUser: { select: { id: true, email: true } },
        items: { select: { status: true } },
      },
    })

    return NextResponse.json({
      batches: batches.map(mapBatchRecord),
      moduleReady: true,
    })
  } catch (error) {
    if (isVoicemailImportTableMissing(error)) {
      return NextResponse.json({
        batches: [],
        moduleReady: false,
        message: 'Voicemail import tables are defined in code, but the database tables have not been activated yet.',
      })
    }

    console.error('Error fetching voicemail import batches:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canManageVoicemailImports(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = (await request.json()) as {
      source?: string
      notes?: string
      rawTranscriptDump?: string
      createEmptyBatch?: boolean
    }

    const source = (body.source || '').trim()
    const notes = (body.notes || '').trim() || null
    const rawTranscriptDump = (body.rawTranscriptDump || '').trim()
    const createEmptyBatch = body.createEmptyBatch === true

    if (!source) {
      return NextResponse.json({ error: 'Source is required' }, { status: 400 })
    }
    if (!rawTranscriptDump && !createEmptyBatch) {
      return NextResponse.json({ error: 'Paste at least one voicemail transcript entry' }, { status: 400 })
    }

    const parsedItems = rawTranscriptDump ? parseVoicemailImportDump(rawTranscriptDump) : []
    if (!createEmptyBatch && parsedItems.length === 0) {
      return NextResponse.json({ error: 'No voicemail entries were detected. Separate entries with blank lines.' }, { status: 400 })
    }

    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.voicemailImportBatch.create({
        data: {
          source,
          notes,
          status: parsedItems.length > 0 ? 'REVIEW_IN_PROGRESS' : 'IMPORTED',
          itemCount: parsedItems.length,
          uploadedByUserId: sessionUser.id,
        },
      })

      if (parsedItems.length > 0) {
        await tx.voicemailImportItem.createMany({
          data: parsedItems.map((item) => ({
            batchId: createdBatch.id,
            transcriptRaw: item.transcriptRaw,
            summaryDraft: item.summaryDraft,
            callerNameRaw: item.callerNameRaw,
            phoneNumberRaw: item.phoneNumberRaw,
            detectedAddress: item.detectedAddress,
            detectedTown: item.detectedTown,
            detectedServiceCategory: item.detectedServiceCategory,
            status: 'REVIEW_REQUIRED',
            transcriptionStatus: 'NOT_APPLICABLE',
          })),
        })
      }

      return createdBatch
    })

    return NextResponse.json({
      id: batch.id,
      itemCount: parsedItems.length,
      moduleReady: true,
    })
  } catch (error) {
    if (isVoicemailImportTableMissing(error)) {
      return NextResponse.json(
        {
          error: 'Voicemail import tables are not active in the database yet. The import workflow is ready in code, but the schema still needs activation.',
        },
        { status: 503 }
      )
    }

    console.error('Error creating voicemail import batch:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
