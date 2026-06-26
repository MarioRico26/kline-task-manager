import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { Prisma, PrismaClient } from '@prisma/client'
import { parseComcastVoicemailEmail } from '@/lib/callsInboxImport'

export type ComcastImapSyncSummary = {
  mailboxUser: string
  folderName: string
  scannedCount: number
  matchedCount: number
  createdCount: number
  duplicateCount: number
  skippedCount: number
  batchSources: string[]
}

type ParsedMailboxMessage = {
  uid: number
  messageId: string | null
  subject: string
  from: string
  receivedAt: Date
  bodyPreview: string
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured.`)
  }
  return value
}

function optionalNumberEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim()
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function optionalBooleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name]?.trim().toLowerCase()
  if (!raw) return fallback
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'off'].includes(raw)) return false
  return fallback
}

function formatBatchDateLabel(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function isComcastVoicemailLike(subject: string, from: string) {
  return /^comcast business voicemail from\s+/i.test(subject.trim()) && from.toLowerCase().includes('comcast.net')
}

function normalizeMailboxPath(value: string) {
  return value.trim().replace(/\\/g, '/').replace(/\.+/g, '/').replace(/\/+/g, '/').toLowerCase()
}

async function resolveMailboxPath(client: ImapFlow, configuredFolderName: string) {
  const mailboxes = await client.list()
  const normalizedTarget = normalizeMailboxPath(configuredFolderName)

  const exactMatch = mailboxes.find((mailbox) => mailbox.path === configuredFolderName || mailbox.pathAsListed === configuredFolderName)
  if (exactMatch) {
    return { resolvedPath: exactMatch.path, availablePaths: mailboxes.map((mailbox) => mailbox.path) }
  }

  const normalizedMatch = mailboxes.find((mailbox) => normalizeMailboxPath(mailbox.path) === normalizedTarget)
  if (normalizedMatch) {
    return { resolvedPath: normalizedMatch.path, availablePaths: mailboxes.map((mailbox) => mailbox.path) }
  }

  const basenameTarget = configuredFolderName.split(/[/.]/).filter(Boolean).pop()?.toLowerCase() || normalizedTarget
  const basenameMatch = mailboxes.find((mailbox) => mailbox.name.trim().toLowerCase() == basenameTarget)
  if (basenameMatch) {
    return { resolvedPath: basenameMatch.path, availablePaths: mailboxes.map((mailbox) => mailbox.path) }
  }

  const candidatePaths = mailboxes
    .map((mailbox) => mailbox.path)
    .filter((mailboxPath) => {
      const normalizedPath = mailboxPath.toLowerCase()
      return normalizedPath.includes('comcast') || normalizedPath.includes('voice') || normalizedPath.includes('inbox')
    })

  const suggestedPaths = (candidatePaths.length > 0 ? candidatePaths : mailboxes.map((mailbox) => mailbox.path)).slice(0, 12)

  throw new Error(
    `IMAP could not find mailbox folder "${configuredFolderName}". Available candidates: ${suggestedPaths.join(', ')}`
  )
}

async function fetchRecentComcastMailboxMessages() {
  const host = process.env.COMCAST_IMAP_HOST?.trim() || 'outlook.office365.com'
  const port = optionalNumberEnv('COMCAST_IMAP_PORT', 993)
  const secure = optionalBooleanEnv('COMCAST_IMAP_SECURE', true)
  const user = requiredEnv('COMCAST_IMAP_USER')
  const pass = requiredEnv('COMCAST_IMAP_PASSWORD')
  const folderName = process.env.COMCAST_IMAP_FOLDER?.trim() || 'INBOX'
  const maxMessages = optionalNumberEnv('COMCAST_IMAP_MAX_MESSAGES', 50)
  const lookbackDays = optionalNumberEnv('COMCAST_IMAP_LOOKBACK_DAYS', 30)

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
  })

  const parsedMessages: ParsedMailboxMessage[] = []
  let scannedCount = 0

  await client.connect()

  try {
    const { resolvedPath, availablePaths } = await resolveMailboxPath(client, folderName)

    let lock
    try {
      lock = await client.getMailboxLock(resolvedPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown IMAP mailbox error'
      throw new Error(
        `IMAP could not open mailbox folder "${resolvedPath}" for ${user}. ${message}. Available folders: ${availablePaths.slice(0, 20).join(', ')}`
      )
    }
    try {
      const sinceDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
      const uidResults = await client.search({ all: true, since: sinceDate }, { uid: true })
      const uids = Array.isArray(uidResults) ? uidResults : []
      const latestUids = uids.slice(-maxMessages).reverse()
      scannedCount = latestUids.length

      for (const uid of latestUids) {
        const message = await client.fetchOne(String(uid), {
          uid: true,
          source: true,
          internalDate: true,
        }, { uid: true })

        if (!message || !message.source) continue

        const parsed = await simpleParser(message.source)
        const subject = (parsed.subject || '').trim()
        const from = parsed.from?.value?.[0]?.address?.trim() || ''

        if (!subject || !from || !isComcastVoicemailLike(subject, from)) {
          continue
        }

        const bodyPreview = (parsed.text || parsed.html || '').toString().trim()
        if (!bodyPreview) continue

        const receivedAt = parsed.date || (message.internalDate ? new Date(message.internalDate) : new Date())

        parsedMessages.push({
          uid: message.uid,
          messageId: parsed.messageId?.trim() || null,
          subject,
          from,
          receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
          bodyPreview,
        })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => undefined)
  }

  return {
    mailboxUser: user,
    folderName,
    scannedCount,
    matchedCount: parsedMessages.length,
    messages: parsedMessages,
  }
}

async function getOrCreateBatchId(tx: PrismaClient | Prisma.TransactionClient, batchSource: string, notes: string) {
  const existing = await tx.voicemailImportBatch.findFirst({
    where: { source: batchSource },
    orderBy: { uploadedAt: 'desc' },
    select: { id: true },
  })

  if (existing) return existing.id

  const created = await tx.voicemailImportBatch.create({
    data: {
      source: batchSource,
      notes,
      status: 'REVIEW_IN_PROGRESS',
      itemCount: 0,
    },
    select: { id: true },
  })

  return created.id
}

export async function syncComcastVoicemailImportsFromImap(prisma: PrismaClient): Promise<ComcastImapSyncSummary> {
  const { mailboxUser, folderName, scannedCount, matchedCount, messages } = await fetchRecentComcastMailboxMessages()

  let createdCount = 0
  let duplicateCount = 0
  let skippedCount = 0
  const batchSources = new Set<string>()

  for (const message of messages) {
    const parsed = parseComcastVoicemailEmail({
      subject: message.subject,
      from: message.from,
      bodyPreview: message.bodyPreview,
      messageId: message.messageId || `imap-uid-${message.uid}`,
    })

    if (!parsed.transcriptRaw.trim()) {
      skippedCount += 1
      continue
    }

    const duplicateMarker = message.messageId
      ? `Source internet message id: ${message.messageId}`
      : `Source IMAP uid: ${message.uid}`

    const duplicate = await prisma.voicemailImportItem.findFirst({
      where: {
        reviewNotes: { contains: duplicateMarker },
      },
      select: { id: true },
    })

    if (duplicate) {
      duplicateCount += 1
      continue
    }

    const batchSource = `Comcast Auto Import - ${formatBatchDateLabel(message.receivedAt)}`

    await prisma.$transaction(async (tx) => {
      const batchId = await getOrCreateBatchId(tx, batchSource, 'Automatic Comcast IMAP intake from mailbox.')

      const reviewNotes = [
        'Imported automatically from Comcast voicemail email via IMAP.',
        `Source mailbox folder: ${folderName}`,
        `Source IMAP uid: ${message.uid}`,
        message.messageId ? `Source internet message id: ${message.messageId}` : null,
        parsed.voicemailDurationSeconds !== null ? `Voicemail length: ${parsed.voicemailDurationSeconds} seconds` : null,
        parsed.sourceSender ? `Source sender: ${parsed.sourceSender}` : null,
        `Source subject: ${parsed.sourceSubject}`,
      ]
        .filter(Boolean)
        .join('\n')

      await tx.voicemailImportItem.create({
        data: {
          batchId,
          recordedAt: message.receivedAt,
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
      })

      await tx.voicemailImportBatch.update({
        where: { id: batchId },
        data: {
          itemCount: { increment: 1 },
          status: 'REVIEW_IN_PROGRESS',
        },
      })
    })

    batchSources.add(batchSource)
    createdCount += 1
  }

  return {
    mailboxUser,
    folderName,
    scannedCount,
    matchedCount,
    createdCount,
    duplicateCount,
    skippedCount,
    batchSources: Array.from(batchSources),
  }
}
