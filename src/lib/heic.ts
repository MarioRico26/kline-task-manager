import heicConvert from 'heic-convert'

function getNormalizedType(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function getNormalizedName(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

export function isHeicLikeInput(fileName?: string | null, contentType?: string | null) {
  const normalizedType = getNormalizedType(contentType)
  const normalizedName = getNormalizedName(fileName)

  return (
    normalizedType === 'image/heic' ||
    normalizedType === 'image/heif' ||
    normalizedName.endsWith('.heic') ||
    normalizedName.endsWith('.heif')
  )
}

export function replaceWithJpgExtension(fileName?: string | null) {
  const sourceName = (fileName || 'attachment').trim()
  if (!sourceName) return 'attachment.jpg'
  return sourceName.replace(/\.[^.]+$/, '') + '.jpg'
}

export async function convertHeicBufferToJpeg(inputBuffer: Buffer | Uint8Array) {
  const converted = await heicConvert({
    buffer: inputBuffer,
    format: 'JPEG',
    quality: 0.9,
  })

  return Buffer.isBuffer(converted) ? converted : Buffer.from(converted)
}
