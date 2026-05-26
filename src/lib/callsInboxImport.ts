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
