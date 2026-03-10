//kline-task-manager/src/lib/upload.ts:
import { put } from '@vercel/blob'

export async function uploadFile(file: File, path: string) {
  try {
    console.log('📁 Uploading file to Vercel Blob:', file.name)

    const blob = await put(`tasks/${path}/${Date.now()}-${file.name}`, file, {
      access: 'public',
    })

    console.log('✅ File uploaded successfully:', blob.url)
    return blob.url
  } catch (error) {
    console.error('❌ Error uploading file to Vercel Blob:', error)

    // Fallback: convertir a base64 para thumbnail en email
    const base64 = await fileToBase64(file)
    return base64
  }
}

// Convertir archivo a base64 para thumbnails en email
async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }

  if (typeof btoa === 'function') {
    return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`
  }

  // Node.js fallback
  return `data:${file.type || 'application/octet-stream'};base64,${Buffer.from(bytes).toString('base64')}`
}
