import { Prisma, PrismaClient } from '@prisma/client'
import { parseComcastVoicemailEmail } from '@/lib/callsInboxImport'

type GraphMailFolder = {
  id: string
  displayName: string
  childFolderCount?: number
}

type GraphMessage = {
  id: string
  subject: string | null
  bodyPreview: string | null
  receivedDateTime: string | null
  internetMessageId?: string | null
  from?: {
    emailAddress?: {
      address?: string | null
      name?: string | null
    } | null
  } | null
}

type GraphCollectionResponse<T> = {
  value?: T[]
  '@odata.nextLink'?: string
}

export type ComcastGraphSyncSummary = {
  mailboxUser: string
  folderName: string
  scannedCount: number
  matchedCount: number
  createdCount: number
  duplicateCount: number
  skippedCount: number
  batchSources: string[]
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured.`)
  }
  return value
}

function formatBatchDateLabel(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function isComcastVoicemailMessage(message: GraphMessage) {
  const subject = (message.subject || '').trim()
  const sender = message.from?.emailAddress?.address?.trim().toLowerCase() || ''

  return /^comcast business voicemail from\s+/i.test(subject) && sender.includes('comcast.net')
}

async function getMicrosoftGraphAccessToken() {
  const tenantId = requiredEnv('MICROSOFT_GRAPH_TENANT_ID')
  const clientId = requiredEnv('MICROSOFT_GRAPH_CLIENT_ID')
  const clientSecret = requiredEnv('MICROSOFT_GRAPH_CLIENT_SECRET')

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    }),
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(rawText || `Microsoft Graph token request failed with status ${response.status}`)
  }

  const json = JSON.parse(rawText) as { access_token?: string }
  if (!json.access_token) {
    throw new Error('Microsoft Graph token response did not include access_token.')
  }

  return json.access_token
}

async function graphGetJson<T>(accessToken: string, url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      Prefer: 'outlook.body-content-type="text"',
    },
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(rawText || `Microsoft Graph request failed with status ${response.status}`)
  }

  return JSON.parse(rawText) as T
}

async function listCollection<T>(accessToken: string, firstUrl: string, maxItems?: number) {
  const items: T[] = []
  let nextUrl: string | undefined = firstUrl

  while (nextUrl) {
    const page: GraphCollectionResponse<T> = await graphGetJson<GraphCollectionResponse<T>>(accessToken, nextUrl)
    const pageItems = page.value || []
    for (const item of pageItems) {
      items.push(item)
      if (typeof maxItems === 'number' && items.length >= maxItems) {
        return items
      }
    }
    nextUrl = page['@odata.nextLink']
  }

  return items
}

async function findFolderByDisplayName(accessToken: string, mailboxUser: string, displayName: string) {
  const normalizedTarget = displayName.trim().toLowerCase()
  const encodedUser = encodeURIComponent(mailboxUser)
  const pendingUrls = [
    `https://graph.microsoft.com/v1.0/users/${encodedUser}/mailFolders?$select=id,displayName,childFolderCount&$top=100`,
  ]
  const visitedUrls = new Set<string>()

  while (pendingUrls.length > 0) {
    const nextUrl = pendingUrls.shift()
    if (!nextUrl || visitedUrls.has(nextUrl)) continue
    visitedUrls.add(nextUrl)

    const folders = await listCollection<GraphMailFolder>(accessToken, nextUrl)
    for (const folder of folders) {
      if ((folder.displayName || '').trim().toLowerCase() === normalizedTarget) {
        return folder
      }

      if ((folder.childFolderCount || 0) > 0) {
        pendingUrls.push(
          `https://graph.microsoft.com/v1.0/users/${encodedUser}/mailFolders/${encodeURIComponent(folder.id)}/childFolders?$select=id,displayName,childFolderCount&$top=100`
        )
      }
    }
  }

  return null
}

async function listRecentFolderMessages(accessToken: string, mailboxUser: string, folderId: string, maxMessages: number) {
  const encodedUser = encodeURIComponent(mailboxUser)
  const encodedFolderId = encodeURIComponent(folderId)
  const url = `https://graph.microsoft.com/v1.0/users/${encodedUser}/mailFolders/${encodedFolderId}/messages?$top=${Math.min(Math.max(maxMessages, 1), 100)}&$select=id,subject,bodyPreview,receivedDateTime,internetMessageId,from&$orderby=receivedDateTime desc`
  return listCollection<GraphMessage>(accessToken, url, maxMessages)
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

export async function syncComcastVoicemailImports(prisma: PrismaClient): Promise<ComcastGraphSyncSummary> {
  const mailboxUser = requiredEnv('COMCAST_VOICEMAIL_MAILBOX_USER')
  const folderName = requiredEnv('COMCAST_VOICEMAIL_FOLDER_NAME')
  const maxMessages = Number(process.env.COMCAST_VOICEMAIL_SYNC_MAX_MESSAGES || '50')
  const accessToken = await getMicrosoftGraphAccessToken()

  const folder = await findFolderByDisplayName(accessToken, mailboxUser, folderName)
  if (!folder) {
    throw new Error(`Microsoft Graph could not find the Outlook folder "${folderName}" for ${mailboxUser}.`)
  }

  const recentMessages = await listRecentFolderMessages(accessToken, mailboxUser, folder.id, Number.isFinite(maxMessages) ? maxMessages : 50)
  const matchedMessages = recentMessages.filter(isComcastVoicemailMessage)

  let createdCount = 0
  let duplicateCount = 0
  let skippedCount = 0
  const batchSources = new Set<string>()

  for (const message of matchedMessages) {
    const subject = (message.subject || '').trim()
    const bodyPreview = (message.bodyPreview || '').trim()
    const from = message.from?.emailAddress?.address?.trim() || ''

    if (!subject || !bodyPreview) {
      skippedCount += 1
      continue
    }

    const receivedAt = message.receivedDateTime ? new Date(message.receivedDateTime) : new Date()
    const effectiveReceivedAt = Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt
    const parsed = parseComcastVoicemailEmail({
      subject,
      from,
      bodyPreview,
      messageId: message.internetMessageId || message.id,
    })

    if (!parsed.transcriptRaw.trim()) {
      skippedCount += 1
      continue
    }

    const duplicateMarker = message.internetMessageId
      ? `Source internet message id: ${message.internetMessageId}`
      : `Source graph message id: ${message.id}`

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

    const batchSource = `Comcast Auto Import - ${formatBatchDateLabel(effectiveReceivedAt)}`
    const batchId = await prisma.$transaction(async (tx) => {
      const resolvedBatchId = await getOrCreateBatchId(tx, batchSource, 'Automatic Comcast Microsoft Graph intake.')

      const reviewNotes = [
        'Imported automatically from Comcast voicemail mailbox via Microsoft Graph.',
        `Source graph folder: ${folderName}`,
        `Source graph message id: ${message.id}`,
        message.internetMessageId ? `Source internet message id: ${message.internetMessageId}` : null,
        parsed.voicemailDurationSeconds !== null ? `Voicemail length: ${parsed.voicemailDurationSeconds} seconds` : null,
        parsed.sourceSender ? `Source sender: ${parsed.sourceSender}` : null,
        `Source subject: ${parsed.sourceSubject}`,
      ]
        .filter(Boolean)
        .join('\n')

      await tx.voicemailImportItem.create({
        data: {
          batchId: resolvedBatchId,
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
      })

      await tx.voicemailImportBatch.update({
        where: { id: resolvedBatchId },
        data: {
          itemCount: { increment: 1 },
          status: 'REVIEW_IN_PROGRESS',
        },
      })

      return resolvedBatchId
    })

    void batchId
    batchSources.add(batchSource)
    createdCount += 1
  }

  return {
    mailboxUser,
    folderName,
    scannedCount: recentMessages.length,
    matchedCount: matchedMessages.length,
    createdCount,
    duplicateCount,
    skippedCount,
    batchSources: Array.from(batchSources),
  }
}
