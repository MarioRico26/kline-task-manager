import sharp from 'sharp'
import { uploadFile } from '@/lib/upload'
import { convertHeicBufferToJpeg, isHeicLikeInput } from '@/lib/heic'

export type PreparedTaskAttachment = {
  originalUrl: string
  previewUrl: string
  mimeType: string | null
  originalFilename: string | null
  warning?: string
}

function getMimeTypeFromDataUrl(url: string) {
  const match = url.match(/^data:([^;,]+)[;,]/i)
  return match?.[1]?.trim() || ''
}

function getFileNameFromUrl(url: string) {
  const withoutQuery = (url.split('/').pop() || '').split('?')[0]
  return withoutQuery || null
}

function getExtensionFromName(name: string | null | undefined) {
  if (!name) return ''
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/i)
  return match?.[1] || ''
}

function isPreviewFriendlyType(contentType: string) {
  const normalizedType = contentType.trim().toLowerCase()
  return (
    normalizedType.includes('jpeg') ||
    normalizedType.includes('jpg') ||
    normalizedType.includes('png') ||
    normalizedType.includes('webp') ||
    normalizedType.includes('gif')
  )
}

function isPreviewFriendlyExtension(extension: string) {
  const normalized = extension.trim().toLowerCase()
  return normalized === '.jpg' || normalized === '.jpeg' || normalized === '.png' || normalized === '.webp' || normalized === '.gif'
}

function shouldCreatePreview(contentType: string, fileName: string | null, sourceUrl?: string) {
  const normalizedType = contentType.trim().toLowerCase()
  const extension = getExtensionFromName(fileName)
  const normalizedUrl = (sourceUrl || '').trim().toLowerCase()

  if (normalizedType.includes('heic') || normalizedType.includes('heif') || normalizedType.includes('tiff') || normalizedType.includes('avif')) {
    return true
  }

  if (extension === '.heic' || extension === '.heif' || extension === '.tif' || extension === '.tiff' || extension === '.avif') {
    return true
  }

  if (
    normalizedUrl.endsWith('.heic') ||
    normalizedUrl.endsWith('.heif') ||
    normalizedUrl.endsWith('.tif') ||
    normalizedUrl.endsWith('.tiff') ||
    normalizedUrl.endsWith('.avif')
  ) {
    return true
  }

  if (isPreviewFriendlyType(normalizedType) || isPreviewFriendlyExtension(extension)) {
    return false
  }

  return Boolean(normalizedType || extension)
}

function getNormalizedName(fileName: string | null, fallbackUrl?: string) {
  const lastSegment = fileName || getFileNameFromUrl(fallbackUrl || '') || 'attachment'
  const cleaned = lastSegment.split('?')[0]
  return cleaned.replace(/\.[^.]+$/, '') || 'attachment'
}

async function buildPreviewBuffer(inputBuffer: Buffer) {
  return sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer()
}

async function normalizeInputBufferForPreview(inputBuffer: Buffer, fileName: string | null, contentType: string | null) {
  if (isHeicLikeInput(fileName, contentType)) {
    return convertHeicBufferToJpeg(inputBuffer)
  }

  return inputBuffer
}

async function uploadPreviewBuffer(previewBuffer: Buffer, baseName: string, taskId: string) {
  const previewFile = new File([new Uint8Array(previewBuffer)], `${baseName}-preview.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })

  return uploadFile(previewFile, taskId)
}

function buildAttachmentWarning(fileName: string | null) {
  const label = fileName || 'attachment'
  return `Preview could not be generated for ${label}, so the original file was kept.`
}

export async function prepareTaskAttachmentFromUrl(url: string, taskId: string): Promise<PreparedTaskAttachment> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch uploaded attachment (${response.status})`)
    }

    const headerType = response.headers.get('content-type') || ''
    const mimeType = headerType || getMimeTypeFromDataUrl(url) || null
    const fileName = getFileNameFromUrl(url)

    if (!shouldCreatePreview(mimeType || '', fileName, url)) {
      return {
        originalUrl: url,
        previewUrl: url,
        mimeType,
        originalFilename: fileName,
      }
    }

    try {
      const arrayBuffer = await response.arrayBuffer()
      const inputBuffer = await normalizeInputBufferForPreview(Buffer.from(arrayBuffer), fileName, mimeType)
      const previewBuffer = await buildPreviewBuffer(inputBuffer)
      const previewUrl = await uploadPreviewBuffer(previewBuffer, getNormalizedName(fileName, url), taskId)

      return {
        originalUrl: url,
        previewUrl,
        mimeType,
        originalFilename: fileName,
      }
    } catch (previewError) {
      console.error('⚠ Attachment preview generation failed from URL:', previewError)
      return {
        originalUrl: url,
        previewUrl: url,
        mimeType,
        originalFilename: fileName,
        warning: buildAttachmentWarning(fileName),
      }
    }
  } catch (error) {
    console.error('⚠ Attachment URL inspection failed, keeping original URL:', error)
    return {
      originalUrl: url,
      previewUrl: url,
      mimeType: getMimeTypeFromDataUrl(url) || null,
      originalFilename: getFileNameFromUrl(url),
      warning: buildAttachmentWarning(getFileNameFromUrl(url)),
    }
  }
}

export async function prepareTaskAttachmentFromFile(file: File, taskId: string): Promise<PreparedTaskAttachment> {
  const originalUrl = await uploadFile(file, taskId)
  const mimeType = file.type || null
  const originalFilename = file.name || null

  if (!shouldCreatePreview(mimeType || '', originalFilename, originalUrl)) {
    return {
      originalUrl,
      previewUrl: originalUrl,
      mimeType,
      originalFilename,
    }
  }

  try {
    const inputBuffer = await normalizeInputBufferForPreview(
      Buffer.from(await file.arrayBuffer()),
      originalFilename,
      mimeType
    )
    const previewBuffer = await buildPreviewBuffer(inputBuffer)
    const previewUrl = await uploadPreviewBuffer(previewBuffer, getNormalizedName(originalFilename, originalUrl), taskId)

    return {
      originalUrl,
      previewUrl,
      mimeType,
      originalFilename,
    }
  } catch (error) {
    console.error('⚠ Attachment preview generation failed from File:', error)
    return {
      originalUrl,
      previewUrl: originalUrl,
      mimeType,
      originalFilename,
      warning: buildAttachmentWarning(originalFilename),
    }
  }
}
