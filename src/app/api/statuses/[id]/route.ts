import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { name, color, notifyClient } = await request.json()
    const { id } = await params

    const status = await prisma.taskStatus.update({
      where: { id },
      data: { 
        name,
        color: color || null,
        notifyClient: notifyClient || false
      },
      select: {
        id: true,
        name: true,
        color: true,
        notifyClient: true,
        createdAt: true
      }
    })

    return NextResponse.json(status)
  } catch (error) {
    console.error('Error updating status:', error)
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
    const { id } = await params

    await prisma.taskStatus.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Status deleted successfully' })
  } catch (error) {
    console.error('Error deleting status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}