import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { getSessionUser } from '@/lib/sessionUser'
import {
  UserAccessScope,
  getUserAccessScopeMap,
  getUserCallsInboxAccessMap,
  getDefaultCallsInboxOwner,
  getUserPlannerAccessMap,
  getUserSeasonalProgramsAccessMap,
  getUserVoicemailImportsAccessMap,
  setUserAccessScope,
  setDefaultCallsInboxOwner,
  setUserCallsInboxAccess,
  setUserPlannerAccess,
  setUserSeasonalProgramsAccess,
  setUserVoicemailImportsAccess,
} from '@/lib/userScope'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (sessionUser.accessScope === 'PERMITS_ONLY') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const userIds = users.map((user) => user.id)
    const [scopeMap, plannerAccessMap, seasonalProgramsAccessMap, callsInboxAccessMap, voicemailImportsAccessMap, defaultCallsInboxOwner] = await Promise.all([
      getUserAccessScopeMap(prisma, userIds),
      getUserPlannerAccessMap(prisma, userIds),
      getUserSeasonalProgramsAccessMap(prisma, userIds),
      getUserCallsInboxAccessMap(prisma, userIds),
      getUserVoicemailImportsAccessMap(prisma, userIds),
      getDefaultCallsInboxOwner(prisma),
    ])

    const usersWithScope = users.map((user) => ({
      ...user,
      accessScope: scopeMap.get(user.id) || 'ALL',
      canAccessPlanner: plannerAccessMap.get(user.id)?.canAccessPlanner || false,
      canAccessSeasonalPrograms: seasonalProgramsAccessMap.get(user.id)?.canAccessSeasonalPrograms || false,
      canAccessCallsInbox: callsInboxAccessMap.get(user.id)?.canAccessCallsInbox || false,
      canAccessVoicemailImports: voicemailImportsAccessMap.get(user.id)?.canAccessVoicemailImports || false,
      isDefaultCallsInboxOwner: defaultCallsInboxOwner.userId === user.id,
    }))

    return NextResponse.json(usersWithScope)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (sessionUser.accessScope === 'PERMITS_ONLY') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { email, password, role, accessScope, canAccessPlanner, canAccessSeasonalPrograms, canAccessCallsInbox, canAccessVoicemailImports, isDefaultCallsInboxOwner } = await request.json()
    const selectedScope: UserAccessScope =
      accessScope === 'NONE' ? 'NONE' : accessScope === 'PERMITS_ONLY' ? 'PERMITS_ONLY' : 'ALL'
    const selectedPlannerAccess = canAccessPlanner === true
    const selectedSeasonalProgramsAccess = canAccessSeasonalPrograms === true
    const selectedVoicemailImportsAccess = canAccessVoicemailImports === true
    const selectedCallsInboxAccess = canAccessCallsInbox === true || isDefaultCallsInboxOwner === true || selectedVoicemailImportsAccess

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Hashear password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role || 'VIEWER'
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    })

    await Promise.all([
      setUserAccessScope(prisma, user.id, selectedScope, sessionUser?.id),
      setUserPlannerAccess(prisma, user.id, selectedPlannerAccess, sessionUser?.id),
      setUserSeasonalProgramsAccess(prisma, user.id, selectedSeasonalProgramsAccess, sessionUser?.id),
      setUserCallsInboxAccess(prisma, user.id, selectedCallsInboxAccess, sessionUser?.id),
      setUserVoicemailImportsAccess(prisma, user.id, selectedVoicemailImportsAccess, sessionUser?.id),
    ])

    if (isDefaultCallsInboxOwner === true) {
      await setDefaultCallsInboxOwner(prisma, user.id, sessionUser.id)
    }

    return NextResponse.json({
      ...user,
      accessScope: selectedScope,
      canAccessPlanner: selectedPlannerAccess,
      canAccessSeasonalPrograms: selectedSeasonalProgramsAccess,
      canAccessCallsInbox: selectedCallsInboxAccess,
      canAccessVoicemailImports: selectedVoicemailImportsAccess,
      isDefaultCallsInboxOwner: isDefaultCallsInboxOwner === true,
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
