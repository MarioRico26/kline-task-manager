import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { email, role } = await request.json()
    const userId = params.id

    const user = await prisma.user.update({
      where: { id: userId },
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
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id

    await prisma.user.delete({
      where: { id: userId }
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