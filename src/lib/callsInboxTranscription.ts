import { parseVoicemailImportEntry } from '@/lib/callsInboxImport'

export const MAX_VOICEMAIL_AUDIO_BYTES = 3.5 * 1024 * 1024

const SUPPORTED_AUDIO_MIME_PREFIXES = ['audio/', 'video/mp4']
const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.mp4', '.mpeg', '.aac', '.ogg', '.webm']

export function isSupportedVoicemailAudioFile(file: File) {
  const lowerName = file.name.toLowerCase()
  const hasSupportedMime = SUPPORTED_AUDIO_MIME_PREFIXES.some((prefix) => (file.type || '').startsWith(prefix))
  const hasSupportedExtension = SUPPORTED_AUDIO_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  return hasSupportedMime || hasSupportedExtension
}

export async function transcribeVoicemailAudio(file: File) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured for voicemail transcription yet.')
  }

  const formData = new FormData()
  formData.append('file', file, file.name)
  formData.append('model', process.env.OPENAI_AUDIO_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-mini-transcribe')
  formData.append('response_format', 'text')
  formData.append('temperature', '0')
  formData.append(
    'prompt',
    'Transcribe office voicemail clearly. Preserve names, addresses, phone numbers, and action requests when possible.'
  )

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  const rawText = await response.text()

  if (!response.ok) {
    throw new Error(rawText || `Transcription failed with status ${response.status}`)
  }

  const transcriptRaw = rawText.trim()
  if (!transcriptRaw) {
    throw new Error('Transcription completed but returned empty text.')
  }

  return parseVoicemailImportEntry(transcriptRaw)
}

export async function fileFromPublicUrl(url: string, fallbackName: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Unable to download audio from storage (${response.status})`)
  }

  const blob = await response.blob()
  const contentType = blob.type || 'application/octet-stream'
  const extension = contentType.includes('mpeg') ? '.mp3' : contentType.includes('mp4') ? '.mp4' : contentType.includes('wav') ? '.wav' : contentType.includes('ogg') ? '.ogg' : ''
  const safeName = fallbackName.endsWith(extension) || !extension ? fallbackName : `${fallbackName}${extension}`

  return new File([blob], safeName, {
    type: contentType,
    lastModified: Date.now(),
  })
}
