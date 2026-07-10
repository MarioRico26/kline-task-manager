import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { handleUpload } from '@vercel/blob/client'
import { getSessionUser } from '@/lib/sessionUser'

const prisma = new PrismaClient()

export const runtime = 'nodejs'

const MAX_CLIENT_UPLOAD_BYTES = 50 * 1024 * 1024

function isAllowedUploadPath(pathname: string) {
  return pathname.startsWith('tasks/manual/')
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAllowedUploadPath(pathname)) {
          throw new Error('Invalid upload path')
        }

        return {
          allowedContentTypes: ['image/*'],
          maximumSizeInBytes: MAX_CLIENT_UPLOAD_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
        }
      },
    })

    return NextResponse.json(json)
  } catch (error) {
    console.error('❌ Client upload token error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to prepare upload' },
      { status: 400 }
    )
  }
}
