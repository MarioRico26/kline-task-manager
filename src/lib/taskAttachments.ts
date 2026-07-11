import sharp from 'sharp'
import { uploadFile } from '@/lib/upload'

function getExtensionFromType(contentType: string) {
  const normalized = contentType.trim().toLowerCase()
  if (normalized.includes('heic') || normalized.includes('heif')) return '.heic'
  if (normalized.includes('tiff')) return '.tiff'
  if (normalized.includes('png')) return '.png'
  if (normalized.includes('webp')) return '.webp'
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg'
  return ''
}

function shouldNormalizeForPreview(url: string, contentType: string) {
  const normalizedUrl = url.trim().toLowerCase()
  const normalizedType = contentType.trim().toLowerCase()

  return (
    normalizedType.includes('heic') ||
    normalizedType.includes('heif') ||
    normalizedType.includes('tiff') ||
    normalizedUrl.endsWith('.heic') ||
    normalizedUrl.endsWith('.heif') ||
    normalizedUrl.endsWith('.tif') ||
    normalizedUrl.endsWith('.tiff')
  )
}

function getNormalizedName(url: string, contentType: string) {
  const lastSegment = url.split('/').pop() || `attachment${getExtensionFromType(contentType)}`
  const cleaned = lastSegment.split('?')[0]
  return cleaned.replace(/\.[^.]+$/, '') || 'attachment'
}

export async function normalizeTaskAttachmentUrl(url: string, taskId: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch uploaded attachment (${response.status})`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!shouldNormalizeForPreview(url, contentType)) {
    return url
  }

  const arrayBuffer = await response.arrayBuffer()
  const inputBuffer = Buffer.from(arrayBuffer)
  const normalizedBuffer = await sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer()

  const normalizedName = `${getNormalizedName(url, contentType)}.jpg`
  const normalizedFile = new File([new Uint8Array(normalizedBuffer)], normalizedName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })

  return uploadFile(normalizedFile, taskId)
}
