import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { getSessionUser } from '@/lib/sessionUser'

const prisma = new PrismaClient()

async function ensureAdminAccess() {
  const sessionUser = await getSessionUser(prisma)
  if (!sessionUser) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  if (sessionUser.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { sessionUser }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await ensureAdminAccess()
    if ('error' in access) return access.error

    const { password } = await request.json()
    const { id } = await params

    if (typeof password !== 'string' || password.trim().length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    })

    await prisma.auditLog.create({
      data: {
        userId: access.sessionUser.id,
        action: 'PASSWORD_RESET',
        description: `Password reset for ${user.email}`,
        entity: 'USER_PASSWORD',
        entityId: user.id,
        details: {
          resetByUserId: access.sessionUser.id,
          resetByEmail: access.sessionUser.email,
          targetEmail: user.email,
        },
      },
    })

    return NextResponse.json({ message: 'Password reset successfully' })
  } catch (error) {
    console.error('Error resetting user password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
