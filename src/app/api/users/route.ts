import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { getSessionUser } from '@/lib/sessionUser'
import { UserAccessScope, getUserAccessScopeMap, setUserAccessScope } from '@/lib/userScope'

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

    const scopeMap = await getUserAccessScopeMap(
      prisma,
      users.map((user) => user.id)
    )

    const usersWithScope = users.map((user) => ({
      ...user,
      accessScope: scopeMap.get(user.id) || 'ALL',
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

    const { email, password, role, accessScope } = await request.json()
    const selectedScope: UserAccessScope = accessScope === 'PERMITS_ONLY' ? 'PERMITS_ONLY' : 'ALL'

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

    await setUserAccessScope(prisma, user.id, selectedScope, sessionUser?.id)

    return NextResponse.json({
      ...user,
      accessScope: selectedScope,
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
