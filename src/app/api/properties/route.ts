import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const properties = await prisma.property.findMany({
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        customerId: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(properties)
  } catch (error) {
    console.error('Error fetching properties:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { address, city, state, zip, customerId } = await request.json()

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

    // Verificar si ya existe una propiedad con la misma dirección para este cliente
    const existingProperty = await prisma.property.findFirst({
      where: {
        address,
        city,
        state,
        zip,
        customerId
      }
    })

    if (existingProperty) {
      return NextResponse.json(
        { error: 'Property with this address already exists for this customer' },
        { status: 400 }
      )
    }

    // Crear propiedad
    const property = await prisma.property.create({
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
    console.error('Error creating property:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}