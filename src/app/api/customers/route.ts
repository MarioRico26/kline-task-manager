import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { fullName, email, phone } = await request.json()

    // Validar que el email no exista
    const existingCustomer = await prisma.customer.findUnique({
      where: { email }
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'Customer with this email already exists' },
        { status: 400 }
      )
    }

    // Crear customer (solo campos necesarios)
    const customer = await prisma.customer.create({
      data: {
        fullName,
        email,
        phone,
        // Campos requeridos por el schema pero con valores por defecto
        billingAddress: 'Not provided',
        billingCity: 'Not provided', 
        billingState: 'Not provided',
        billingZip: 'Not provided',
        serviceAddress: 'Not provided',
        serviceCity: 'Not provided',
        serviceState: 'Not provided',
        serviceZip: 'Not provided'
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
    console.error('Error creating customer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}