import { CallServiceCategory, VoicemailImportItemStatus } from '@prisma/client'

export type ParsedImportItem = {
  transcriptRaw: string
  summaryDraft: string
  callerNameRaw: string | null
  phoneNumberRaw: string | null
  detectedAddress: string | null
  detectedTown: string | null
  detectedServiceCategory: CallServiceCategory | null
}

export type ParsedComcastVoicemailEmail = ParsedImportItem & {
  voicemailDurationSeconds: number | null
  sourceSubject: string
  sourceSender: string | null
  sourceMessageId: string | null
}

function stripLeadingTimestamp(block: string) {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return ''

  const firstLine = lines[0]
  const isTimestampLine =
    /^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(firstLine) ||
    /^(Yesterday|Today),\s*\d{1,2}:\d{2}\s?(AM|PM)$/i.test(firstLine)

  return (isTimestampLine ? lines.slice(1) : lines).join(' ').trim()
}

function detectServiceCategory(text: string): CallServiceCategory | null {
  const normalized = text.toLowerCase()
  if (/(pool|swim-ready|heater|salt system|jet nozzles|hot tub|filter)/.test(normalized)) return 'POOL'
  if (/(irrigation|turn-on|turn on|turn off|sprinkler|water on|lines exposed)/.test(normalized)) return 'IRRIGATION'
  if (/(cleanup|clean up|grass|weed|shrub|mulch|stone installation)/.test(normalized)) return 'MAINTENANCE'
  return 'GENERAL'
}

function extractPhone(text: string) {
  const match = text.match(/(?:phone\s*)?(\d{3}[-.\s]\d{3}[-.\s]\d{4})/i)
  return match ? match[1].replace(/\s+/g, ' ').trim() : null
}

function extractCallerName(text: string) {
  const firstComma = text.indexOf(',')
  if (firstComma <= 0) return null
  const candidate = text.slice(0, firstComma).trim()
  if (candidate.length > 80) return null
  if (/^(unknown caller)$/i.test(candidate)) return 'Unknown caller'
  return candidate || null
}

function extractDetectedAddress(text: string) {
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const addressCandidate = parts[1]
  return /\d/.test(addressCandidate) ? addressCandidate : null
}

function extractDetectedTown(text: string) {
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 3) return null
  const townCandidate = parts[2]
  if (/phone|called|asked|said|regarding/i.test(townCandidate)) return null
  return townCandidate || null
}

function normalizeComcastName(rawName: string | null) {
  if (!rawName) return null
  return rawName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || null
}

function extractComcastSubjectPhone(subject: string) {
  const match = subject.match(/voicemail from\s+(\d{10,})/i)
  return match ? match[1] : null
}

function extractComcastSubjectName(subject: string) {
  const match = subject.match(/voicemail from\s+\d{10,}\s+[–-]\s+(.+)$/i)
  return normalizeComcastName(match ? match[1] : null)
}

function parseComcastBodyPreview(bodyPreview: string) {
  const lines = bodyPreview
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const filtered: string[] = []
  let durationSeconds: number | null = null

  for (const line of lines) {
    if (/^comcast business voicemail from/i.test(line)) continue
    if (/^https?:\/\/\S+$/i.test(line)) continue
    if (/^some content in this message has been blocked/i.test(line)) continue
    if (/^trust sender$/i.test(line)) continue
    if (/^show blocked content$/i.test(line)) continue
    if (/^this is a service-related email\./i.test(line)) break
    if (/^services and features are subject to comcast/i.test(line)) break
    if (/^comcast respects your privacy\./i.test(line)) break
    if (/^one comcast center$/i.test(line)) break
    if (/^attn:/i.test(line)) break

    const durationMatch = line.match(/^(\d+)\s+seconds?$/i)
    if (durationMatch) {
      durationSeconds = Number(durationMatch[1])
      continue
    }

    filtered.push(line.replace(/https?:\/\/\S+/gi, '').trim())
  }

  return {
    transcript: filtered.join(' ').replace(/\s+/g, ' ').trim(),
    durationSeconds,
  }
}

export function parseVoicemailImportDump(rawDump: string): ParsedImportItem[] {
  return rawDump
    .split(/\n\s*\n/g)
    .map((block) => stripLeadingTimestamp(block))
    .filter(Boolean)
    .map((cleanText) => parseVoicemailImportEntry(cleanText))
}

export function parseVoicemailImportEntry(rawText: string): ParsedImportItem {
  const cleanText = stripLeadingTimestamp(rawText)

  return {
    transcriptRaw: cleanText,
    summaryDraft: cleanText.slice(0, 220),
    callerNameRaw: extractCallerName(cleanText),
    phoneNumberRaw: extractPhone(cleanText),
    detectedAddress: extractDetectedAddress(cleanText),
    detectedTown: extractDetectedTown(cleanText),
    detectedServiceCategory: detectServiceCategory(cleanText),
  }
}

export function parseComcastVoicemailEmail(input: {
  subject: string
  from?: string | null
  bodyPreview: string
  messageId?: string | null
}) : ParsedComcastVoicemailEmail {
  const subject = input.subject.trim()
  const { transcript, durationSeconds } = parseComcastBodyPreview(input.bodyPreview || '')
  const parsedTranscript = parseVoicemailImportEntry(transcript || subject)

  return {
    ...parsedTranscript,
    callerNameRaw: extractComcastSubjectName(subject) || parsedTranscript.callerNameRaw,
    phoneNumberRaw: extractComcastSubjectPhone(subject) || parsedTranscript.phoneNumberRaw,
    voicemailDurationSeconds: durationSeconds,
    sourceSubject: subject,
    sourceSender: input.from?.trim() || null,
    sourceMessageId: input.messageId?.trim() || null,
  }
}

export function getVoicemailImportBatchCounts(
  statuses: VoicemailImportItemStatus[]
) {
  return statuses.reduce(
    (acc, status) => {
      if (status === 'REVIEW_REQUIRED') acc.reviewRequired += 1
      if (status === 'READY_TO_CREATE') acc.readyToCreate += 1
      if (status === 'CREATED_AS_CALL_RECORD') acc.created += 1
      if (status === 'SKIPPED') acc.skipped += 1
      if (status === 'DUPLICATE') acc.duplicate += 1
      return acc
    },
    {
      reviewRequired: 0,
      readyToCreate: 0,
      created: 0,
      skipped: 0,
      duplicate: 0,
    }
  )
}
