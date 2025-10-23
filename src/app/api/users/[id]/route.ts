import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Context {
  params: Promise<{ id: string }>
}

export async function PUT(
  request: NextRequest,
  context: Context
) {
  try {
    const { email, role } = await request.json()
    const { id } = await context.params

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

    return NextResponse.json(user)
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
  context: Context
) {
  try {
    const { id } = await context.params

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