import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSessionUser } from '@/lib/sessionUser'
import {
  UserAccessScope,
  getUserAccessScopeById,
  getUserCallsInboxAccessById,
  getDefaultCallsInboxOwner,
  getUserPlannerAccessById,
  getUserSeasonalProgramsAccessById,
  getUserVoicemailImportsAccessById,
  setUserAccessScope,
  setDefaultCallsInboxOwner,
  setUserCallsInboxAccess,
  setUserPlannerAccess,
  setUserSeasonalProgramsAccess,
  setUserVoicemailImportsAccess,
} from '@/lib/userScope'

const prisma = new PrismaClient()

async function ensureUserAdminAccess() {
  const sessionUser = await getSessionUser(prisma)
  if (!sessionUser) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }
  if (sessionUser.accessScope === 'PERMITS_ONLY') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { sessionUser }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await ensureUserAdminAccess()
    if ('error' in access) return access.error

    const { email, role, accessScope, canAccessPlanner, canAccessSeasonalPrograms, canAccessCallsInbox, canAccessVoicemailImports, isDefaultCallsInboxOwner } = await request.json()
    const { id } = await params
    const selectedScope: UserAccessScope = accessScope === 'PERMITS_ONLY' ? 'PERMITS_ONLY' : 'ALL'
    const selectedPlannerAccess = canAccessPlanner === true
    const selectedSeasonalProgramsAccess = canAccessSeasonalPrograms === true
    const selectedVoicemailImportsAccess = canAccessVoicemailImports === true
    const selectedCallsInboxAccess = canAccessCallsInbox === true || isDefaultCallsInboxOwner === true || selectedVoicemailImportsAccess

    const user = await prisma.user.update({
      where: { id },
      data: { email, role },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    })

    await Promise.all([
      setUserAccessScope(prisma, id, selectedScope, access.sessionUser.id),
      setUserPlannerAccess(prisma, id, selectedPlannerAccess, access.sessionUser.id),
      setUserSeasonalProgramsAccess(prisma, id, selectedSeasonalProgramsAccess, access.sessionUser.id),
      setUserCallsInboxAccess(prisma, id, selectedCallsInboxAccess, access.sessionUser.id),
      setUserVoicemailImportsAccess(prisma, id, selectedVoicemailImportsAccess, access.sessionUser.id),
    ])

    if (isDefaultCallsInboxOwner === true) {
      await setDefaultCallsInboxOwner(prisma, id, access.sessionUser.id)
    } else {
      const currentDefaultOwner = await getDefaultCallsInboxOwner(prisma)
      if (currentDefaultOwner.userId === id) {
        await setDefaultCallsInboxOwner(prisma, null, access.sessionUser.id)
      }
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
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await ensureUserAdminAccess()
    if ('error' in access) return access.error

    const { id } = await params

    await prisma.user.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await ensureUserAdminAccess()
    if ('error' in access) return access.error

    const { id } = await params
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [accessScope, plannerAccess, seasonalProgramsAccess, callsInboxAccess, voicemailImportsAccess, defaultCallsInboxOwner] = await Promise.all([
      getUserAccessScopeById(prisma, id),
      getUserPlannerAccessById(prisma, id),
      getUserSeasonalProgramsAccessById(prisma, id),
      getUserCallsInboxAccessById(prisma, id),
      getUserVoicemailImportsAccessById(prisma, id),
      getDefaultCallsInboxOwner(prisma),
    ])

    return NextResponse.json({
      ...user,
      accessScope,
      canAccessPlanner: plannerAccess.canAccessPlanner,
      canAccessSeasonalPrograms: seasonalProgramsAccess.canAccessSeasonalPrograms,
      canAccessCallsInbox: callsInboxAccess.canAccessCallsInbox,
      canAccessVoicemailImports: voicemailImportsAccess.canAccessVoicemailImports,
      isDefaultCallsInboxOwner: defaultCallsInboxOwner.userId === id,
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
