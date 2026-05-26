import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import {
  getUserAccessScopeById,
  getUserCallsInboxAccessById,
  getUserPlannerAccessById,
  getUserSeasonalProgramsAccessById,
  getUserVoicemailImportsAccessById,
} from '@/lib/userScope'

const prisma = new PrismaClient()

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    
    const user = await prisma.user.findUnique({
      where: { email }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    
    const validPassword = await bcrypt.compare(password, user.password)
    
    if (!validPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    
    const [accessScope, plannerAccess, seasonalProgramsAccess, callsInboxAccess, voicemailImportsAccess] = await Promise.all([
      getUserAccessScopeById(prisma, user.id),
      getUserPlannerAccessById(prisma, user.id),
      getUserSeasonalProgramsAccessById(prisma, user.id),
      getUserCallsInboxAccessById(prisma, user.id),
      getUserVoicemailImportsAccessById(prisma, user.id),
    ])

    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        accessScope,
        canAccessPlanner: plannerAccess.canAccessPlanner,
        canAccessSeasonalPrograms: seasonalProgramsAccess.canAccessSeasonalPrograms,
        canAccessCallsInbox: callsInboxAccess.canAccessCallsInbox,
        canAccessVoicemailImports: voicemailImportsAccess.canAccessVoicemailImports,
      }
    })
    
    // ✅ Cookie sólida solo desde servidor. Chrome-friendly ✅
    response.cookies.set('user-id', String(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    })

    response.cookies.set('access-scope', accessScope, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    })

    response.cookies.set('planner-access', plannerAccess.canAccessPlanner ? 'true' : 'false', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    })

    response.cookies.set('seasonal-programs-access', seasonalProgramsAccess.canAccessSeasonalPrograms ? 'true' : 'false', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    })

    response.cookies.set('calls-inbox-access', callsInboxAccess.canAccessCallsInbox ? 'true' : 'false', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    })

    response.cookies.set('voicemail-imports-access', voicemailImportsAccess.canAccessVoicemailImports ? 'true' : 'false', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    })
    
    return response
    
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
