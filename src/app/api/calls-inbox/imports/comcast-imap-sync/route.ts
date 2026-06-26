import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/sessionUser'
import { syncComcastVoicemailImportsFromImap } from '@/lib/comcastImapSync'

function canManageVoicemailImports(sessionUser: Awaited<ReturnType<typeof getSessionUser>>) {
  return (
    sessionUser &&
    sessionUser.canAccessCallsInbox &&
    sessionUser.canAccessVoicemailImports &&
    sessionUser.accessScope !== 'PERMITS_ONLY'
  )
}

function isVoicemailImportTableMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function getProvidedSecret(request: Request) {
  const headerSecret = request.headers.get('x-kline-sync-secret')?.trim()
  if (headerSecret) return headerSecret

  const authHeader = request.headers.get('authorization')?.trim()
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim()
  }

  return ''
}

async function authorizeRequest(request: Request) {
  const sessionUser = await getSessionUser(prisma)
  if (canManageVoicemailImports(sessionUser)) {
    return { authorized: true as const, sessionUser }
  }

  const configuredSecret = process.env.COMCAST_VOICEMAIL_SYNC_SECRET?.trim()
  const providedSecret = getProvidedSecret(request)
  if (configuredSecret && providedSecret && configuredSecret === providedSecret) {
    return { authorized: true as const, sessionUser: null }
  }

  if (sessionUser) {
    return { authorized: false as const, status: 403, error: 'Forbidden' }
  }

  return { authorized: false as const, status: 401, error: 'Not authenticated' }
}

async function handleSync(request: Request) {
  const auth = await authorizeRequest(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const summary = await syncComcastVoicemailImportsFromImap(prisma)
    return NextResponse.json({ success: true, summary })
  } catch (error) {
    if (isVoicemailImportTableMissing(error)) {
      return NextResponse.json({ error: 'Voicemail import tables are not active in the database yet.' }, { status: 503 })
    }

    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Error syncing Comcast voicemail mailbox via IMAP:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleSync(request)
}

export async function POST(request: Request) {
  return handleSync(request)
}
