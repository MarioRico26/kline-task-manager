import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { address, city, state, zip, customerId } = await request.json()
    const { id } = await params

    // Verificar que el customer existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Verificar si ya existe otra propiedad con la misma dirección para este cliente
    const existingProperty = await prisma.property.findFirst({
      where: {
        address,
        city,
        state,
        zip,
        customerId,
        NOT: { id }
      }
    })

    if (existingProperty) {
      return NextResponse.json(
        { error: 'Another property with this address already exists for this customer' },
        { status: 400 }
      )
    }

    const property = await prisma.property.update({
      where: { id },
      data: { 
        address,
        city,
        state,
        zip,
        customerId
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(property)
  } catch (error) {
    console.error('Error updating property:', error)
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

    await prisma.property.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Property deleted successfully' })
  } catch (error) {
    console.error('Error deleting property:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}