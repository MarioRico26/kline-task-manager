import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { uploadFile } from '@/lib/upload'
import { getSessionUser } from '@/lib/sessionUser'
import sharp from 'sharp'

const prisma = new PrismaClient()

export const runtime = 'nodejs'

const MAX_SINGLE_FILE_BYTES = 2.8 * 1024 * 1024
const TARGET_IMAGE_BYTES = 1.8 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 1920
const MIN_IMAGE_DIMENSION = 900

function isHeicLike(file: File) {
  const normalizedType = file.type.trim().toLowerCase()
  const normalizedName = file.name.trim().toLowerCase()

  return (
    normalizedType === 'image/heic' ||
    normalizedType === 'image/heif' ||
    normalizedName.endsWith('.heic') ||
    normalizedName.endsWith('.heif')
  )
}

function isImageLike(file: File) {
  return file.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)
}

function replaceFileExtension(name: string, extension: string) {
  return name.replace(/\.[^.]+$/, '') + extension
}

async function optimizeImageForUpload(file: File) {
  if (!isImageLike(file)) return file
  if (file.size <= MAX_SINGLE_FILE_BYTES && !isHeicLike(file)) return file

  const inputBuffer = Buffer.from(await file.arrayBuffer())
  const metadata = await sharp(inputBuffer, { failOn: 'none' }).metadata()
  const longestSide = Math.max(metadata.width || 0, metadata.height || 0)

  let maxDimension = longestSide > 0 ? Math.min(longestSide, MAX_IMAGE_DIMENSION) : MAX_IMAGE_DIMENSION
  let bestBuffer: Buffer | null = null

  while (maxDimension >= MIN_IMAGE_DIMENSION) {
    let quality = 82
    let outputBuffer = await sharp(inputBuffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()

    bestBuffer = outputBuffer

    while (outputBuffer.length > TARGET_IMAGE_BYTES && quality > 42) {
      quality -= 8
      outputBuffer = await sharp(inputBuffer, { failOn: 'none' })
        .rotate()
        .resize({
          width: maxDimension,
          height: maxDimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer()
      bestBuffer = outputBuffer
    }

    if (outputBuffer.length <= MAX_SINGLE_FILE_BYTES) {
      return new File([new Uint8Array(outputBuffer)], replaceFileExtension(file.name, '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
    }

    maxDimension = Math.floor(maxDimension * 0.82)
  }

  if (bestBuffer && bestBuffer.length <= MAX_SINGLE_FILE_BYTES) {
    return new File([new Uint8Array(bestBuffer)], replaceFileExtension(file.name, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  }

  throw new Error(`Could not reduce "${file.name}" enough for upload`)
}

function normalizeFolder(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const folderInput = (formData.get('folder') as string) || 'tasks/manual'
    const folder = normalizeFolder(folderInput) || 'tasks/manual'

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Empty file cannot be uploaded' }, { status: 400 })
    }

    let uploadReadyFile = file

    if (isImageLike(file)) {
      try {
        uploadReadyFile = await optimizeImageForUpload(file)
      } catch (error) {
        console.error('❌ Image optimization error:', error)
        return NextResponse.json(
          { error: `We could not prepare "${file.name}" for upload. Please try a smaller image or convert it to JPG/PNG first.` },
          { status: 413 }
        )
      }
    }

    if (uploadReadyFile.size > MAX_SINGLE_FILE_BYTES) {
      return NextResponse.json(
        { error: `File "${uploadReadyFile.name}" is too large. Please keep each file under ${Math.round(MAX_SINGLE_FILE_BYTES / (1024 * 1024))} MB.` },
        { status: 413 }
      )
    }

    const path = `${folder}/${sessionUser.id}`
    const url = await uploadFile(uploadReadyFile, path)

    return NextResponse.json({
      url,
      name: uploadReadyFile.name,
      size: uploadReadyFile.size,
    })
  } catch (error) {
    console.error('❌ Upload API error:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
