import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSessionUser } from '@/lib/sessionUser'

const prisma = new PrismaClient()

export async function GET() {
  const sessionUser = await getSessionUser(prisma)
  if (!sessionUser) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  const response = NextResponse.json({
    authenticated: true,
    user: sessionUser,
  })

  response.cookies.set('access-scope', sessionUser.accessScope, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  response.cookies.set('planner-access', sessionUser.canAccessPlanner ? 'true' : 'false', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  response.cookies.set('seasonal-programs-access', sessionUser.canAccessSeasonalPrograms ? 'true' : 'false', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  response.cookies.set('calls-inbox-access', sessionUser.canAccessCallsInbox ? 'true' : 'false', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  return response
}
