import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { fullName, email, phone } = await request.json()
    const { id } = await params

    // Verificar si el email ya existe en otro customer
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        email,
        NOT: { id }
      }
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'Another customer with this email already exists' },
        { status: 400 }
      )
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: { 
        fullName,
        email,
        phone
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        createdAt: true
      }
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error updating customer:', error)
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

    await prisma.customer.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Customer deleted successfully' })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}