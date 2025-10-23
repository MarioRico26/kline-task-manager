import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { name, description } = await request.json()
    const { id } = await params

    const service = await prisma.service.update({
      where: { id },
      data: { 
        name,
        description: description || null
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true
      }
    })

    return NextResponse.json(service)
  } catch (error) {
    console.error('Error updating service:', error)
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

    await prisma.service.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Service deleted successfully' })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}