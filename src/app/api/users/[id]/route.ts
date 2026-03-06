import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSessionUser } from '@/lib/sessionUser'
import { UserAccessScope, getUserAccessScopeById, setUserAccessScope } from '@/lib/userScope'

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

    const { email, role, accessScope } = await request.json()
    const { id } = await params
    const selectedScope: UserAccessScope = accessScope === 'PERMITS_ONLY' ? 'PERMITS_ONLY' : 'ALL'

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

    await setUserAccessScope(prisma, id, selectedScope, access.sessionUser.id)

    return NextResponse.json({
      ...user,
      accessScope: selectedScope,
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

    const accessScope = await getUserAccessScopeById(prisma, id)
    return NextResponse.json({
      ...user,
      accessScope,
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
