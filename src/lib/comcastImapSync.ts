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

type ImapAuthConfig =
  | {
      method: 'password'
      user: string
      pass: string
    }
  | {
      method: 'oauth'
      user: string
      accessToken: string
    }

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured.`)
  }
  return value
}

function optionalEnv(name: string) {
  return process.env[name]?.trim() || ''
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

async function getImapOAuthAccessToken() {
  const tenantId = optionalEnv('COMCAST_IMAP_OAUTH_TENANT_ID') || optionalEnv('MICROSOFT_GRAPH_TENANT_ID')
  const clientId = optionalEnv('COMCAST_IMAP_OAUTH_CLIENT_ID') || optionalEnv('MICROSOFT_GRAPH_CLIENT_ID')
  const clientSecret = optionalEnv('COMCAST_IMAP_OAUTH_CLIENT_SECRET') || optionalEnv('MICROSOFT_GRAPH_CLIENT_SECRET')
  const scope = optionalEnv('COMCAST_IMAP_OAUTH_SCOPE') || 'https://outlook.office365.com/.default'

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'IMAP OAuth is not fully configured. Set COMCAST_IMAP_OAUTH_TENANT_ID / CLIENT_ID / CLIENT_SECRET or reuse the MICROSOFT_GRAPH_* credentials.'
    )
  }

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope,
    }),
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(rawText || `Microsoft OAuth token request failed with status ${response.status}`)
  }

  const json = JSON.parse(rawText) as { access_token?: string }
  if (!json.access_token) {
    throw new Error('Microsoft OAuth token response did not include access_token.')
  }

  return json.access_token
}

async function getImapAuthConfig(user: string): Promise<ImapAuthConfig> {
  const hasOAuthConfig = Boolean(
    optionalEnv('COMCAST_IMAP_OAUTH_TENANT_ID') ||
    optionalEnv('COMCAST_IMAP_OAUTH_CLIENT_ID') ||
    optionalEnv('COMCAST_IMAP_OAUTH_CLIENT_SECRET') ||
    optionalEnv('MICROSOFT_GRAPH_TENANT_ID') ||
    optionalEnv('MICROSOFT_GRAPH_CLIENT_ID') ||
    optionalEnv('MICROSOFT_GRAPH_CLIENT_SECRET')
  )

  if (hasOAuthConfig) {
    return {
      method: 'oauth',
      user,
      accessToken: await getImapOAuthAccessToken(),
    }
  }

  return {
    method: 'password',
    user,
    pass: requiredEnv('COMCAST_IMAP_PASSWORD'),
  }
}

function formatImapError(error: unknown) {
  if (error instanceof Error) {
    const imapError = error as Error & {
      response?: string
      serverResponseCode?: string
      code?: string
      command?: string
    }

    const details = [imapError.message]
    if (imapError.code) details.push(`code=${imapError.code}`)
    if (imapError.command) details.push(`command=${imapError.command}`)
    if (imapError.serverResponseCode) details.push(`serverResponseCode=${imapError.serverResponseCode}`)
    if (imapError.response) details.push(`response=${imapError.response}`)
    return details.join(' | ')
  }

  return String(error)
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
  const folderName = process.env.COMCAST_IMAP_FOLDER?.trim() || 'INBOX'
  const maxMessages = optionalNumberEnv('COMCAST_IMAP_MAX_MESSAGES', 50)
  const lookbackDays = optionalNumberEnv('COMCAST_IMAP_LOOKBACK_DAYS', 30)
  const authConfig = await getImapAuthConfig(user)

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth:
      authConfig.method === 'oauth'
        ? { user: authConfig.user, accessToken: authConfig.accessToken }
        : { user: authConfig.user, pass: authConfig.pass },
    logger: false,
  })

  const parsedMessages: ParsedMailboxMessage[] = []
  let scannedCount = 0

  try {
    await client.connect()
  } catch (error) {
    throw new Error(`IMAP connection failed for ${user}@${host}:${port}. ${formatImapError(error)}`)
  }

  try {
    let resolvedPath: string
    let availablePaths: string[]

    try {
      const resolved = await resolveMailboxPath(client, folderName)
      resolvedPath = resolved.resolvedPath
      availablePaths = resolved.availablePaths
    } catch (error) {
      throw new Error(`IMAP mailbox lookup failed for ${user}. ${formatImapError(error)}`)
    }

    let lock
    try {
      lock = await client.getMailboxLock(resolvedPath)
    } catch (error) {
      throw new Error(
        `IMAP could not open mailbox folder "${resolvedPath}" for ${user}. ${formatImapError(error)}. Available folders: ${availablePaths.slice(0, 20).join(', ')}`
      )
    }
    try {
      const sinceDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
      const uidResults = await client.search({ all: true, since: sinceDate }, { uid: true })
      const uids = Array.isArray(uidResults) ? uidResults.map((value) => Number(value)).filter((value) => Number.isFinite(value)) : []
      const latestUids = uids
        .sort((left, right) => left - right)
        .slice(-maxMessages)
        .reverse()
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

        const receivedAt = message.internalDate ? new Date(message.internalDate) : parsed.date || new Date()

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
