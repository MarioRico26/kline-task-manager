import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { uploadFile } from '@/lib/upload'
import { getSessionUser } from '@/lib/sessionUser'

const prisma = new PrismaClient()

const MAX_SINGLE_FILE_BYTES = 3.5 * 1024 * 1024

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

    if (file.size > MAX_SINGLE_FILE_BYTES) {
      return NextResponse.json(
        { error: `File "${file.name}" is too large. Please keep each file under ${Math.round(MAX_SINGLE_FILE_BYTES / (1024 * 1024))} MB.` },
        { status: 413 }
      )
    }

    const path = `${folder}/${sessionUser.id}`
    const url = await uploadFile(file, path)

    return NextResponse.json({
      url,
      name: file.name,
      size: file.size,
    })
  } catch (error) {
    console.error('❌ Upload API error:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
