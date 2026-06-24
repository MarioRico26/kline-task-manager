import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { parseComcastVoicemailEmail } from '@/lib/callsInboxImport'

function isVoicemailImportTableMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function getWebhookSecret(request: Request) {
  const headerSecret = request.headers.get('x-kline-webhook-secret')?.trim()
  if (headerSecret) return headerSecret

  const authHeader = request.headers.get('authorization')?.trim()
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim()
  }

  return ''
}

function formatBatchDateLabel(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export async function POST(request: Request) {
  try {
    const configuredSecret = process.env.COMCAST_VOICEMAIL_WEBHOOK_SECRET?.trim()
    if (!configuredSecret) {
      return NextResponse.json({ error: 'Webhook secret is not configured on the server.' }, { status: 503 })
    }

    const providedSecret = getWebhookSecret(request)
    if (!providedSecret || providedSecret !== configuredSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as {
      subject?: string
      from?: string
      receivedAt?: string
      bodyPreview?: string
      messageId?: string
    }

    const subject = (body.subject || '').trim()
    const from = (body.from || '').trim()
    const bodyPreview = (body.bodyPreview || '').trim()
    const messageId = (body.messageId || '').trim() || null

    if (!subject || !bodyPreview) {
      return NextResponse.json({ error: 'Subject and bodyPreview are required.' }, { status: 400 })
    }

    if (from && !from.toLowerCase().includes('comcast.net')) {
      return NextResponse.json({ error: 'Unexpected sender for Comcast voicemail intake.' }, { status: 400 })
    }

    const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date()
    const effectiveReceivedAt = Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt
    const parsed = parseComcastVoicemailEmail({
      subject,
      from,
      bodyPreview,
      messageId,
    })

    if (!parsed.transcriptRaw.trim()) {
      return NextResponse.json({ error: 'Unable to detect voicemail transcript from email.' }, { status: 400 })
    }

    const batchDateLabel = formatBatchDateLabel(effectiveReceivedAt)
    const batchSource = `Comcast Auto Import - ${batchDateLabel}`
    const duplicateMarker = messageId ? `Source email id: ${messageId}` : null

    const result = await prisma.$transaction(async (tx) => {
      let batch = await tx.voicemailImportBatch.findFirst({
        where: { source: batchSource },
        orderBy: { uploadedAt: 'desc' },
      })

      if (!batch) {
        batch = await tx.voicemailImportBatch.create({
          data: {
            source: batchSource,
            notes: 'Automatic Comcast voicemail email intake.',
            status: 'REVIEW_IN_PROGRESS',
            itemCount: 0,
          },
        })
      }

      if (duplicateMarker) {
        const existingItem = await tx.voicemailImportItem.findFirst({
          where: {
            batchId: batch.id,
            reviewNotes: { contains: duplicateMarker },
          },
          select: { id: true },
        })

        if (existingItem) {
          return { batchId: batch.id, itemId: existingItem.id, duplicate: true }
        }
      }

      const reviewNotes = [
        'Imported automatically from Comcast voicemail email.',
        duplicateMarker,
        parsed.voicemailDurationSeconds !== null ? `Voicemail length: ${parsed.voicemailDurationSeconds} seconds` : null,
        parsed.sourceSender ? `Source sender: ${parsed.sourceSender}` : null,
        `Source subject: ${parsed.sourceSubject}`,
      ]
        .filter(Boolean)
        .join('\n')

      const item = await tx.voicemailImportItem.create({
        data: {
          batchId: batch.id,
          recordedAt: effectiveReceivedAt,
          phoneNumberRaw: parsed.phoneNumberRaw,
          callerNameRaw: parsed.callerNameRaw,
          transcriptRaw: parsed.transcriptRaw,
          summaryDraft: parsed.summaryDraft,
          detectedAddress: parsed.detectedAddress,
          detectedTown: parsed.detectedTown,
          detectedServiceCategory: parsed.detectedServiceCategory,
          status: 'REVIEW_REQUIRED',
          transcriptionStatus: 'NOT_APPLICABLE',
          reviewNotes,
        },
        select: { id: true },
      })

      await tx.voicemailImportBatch.update({
        where: { id: batch.id },
        data: {
          itemCount: { increment: 1 },
          status: 'REVIEW_IN_PROGRESS',
        },
      })

      return { batchId: batch.id, itemId: item.id, duplicate: false }
    })

    return NextResponse.json({
      success: true,
      source: batchSource,
      ...result,
    })
  } catch (error) {
    if (isVoicemailImportTableMissing(error)) {
      return NextResponse.json({ error: 'Voicemail import tables are not active in the database yet.' }, { status: 503 })
    }

    console.error('Error ingesting Comcast voicemail email:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
