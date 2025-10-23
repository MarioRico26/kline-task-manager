import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const statuses = await prisma.taskStatus.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        notifyClient: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(statuses)
  } catch (error) {
    console.error('Error fetching statuses:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { name, color, notifyClient } = await request.json()

    // Verificar si el status ya existe
    const existingStatus = await prisma.taskStatus.findFirst({
      where: { name }
    })

    if (existingStatus) {
      return NextResponse.json(
        { error: 'Status with this name already exists' },
        { status: 400 }
      )
    }

    // Crear status
    const status = await prisma.taskStatus.create({
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
    console.error('Error creating status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}