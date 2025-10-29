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
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(customers)
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/customers
 * Crea un Customer y opcionalmente su primera Property en la misma transacción.
 * Body esperado:
 * {
 *   fullName: string,
 *   email: string,
 *   phone: string,
 *   property?: { address: string, city: string, state: string, zip: string }
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const fullName: string = body.fullName?.trim()
    const email: string = body.email?.trim().toLowerCase()
    const rawPhone: string = String(body.phone ?? '')
    const phone = rawPhone.replace(/\D/g, '')

    const propertyInput: undefined | {
      address?: string
      city?: string
      state?: string
      zip?: string
    } = body.property

    if (!fullName || !email || !phone) {
      return NextResponse.json({ error: 'fullName, email and phone are required' }, { status: 400 })
    }

    // Validar duplicado por email
    const existingCustomer = await prisma.customer.findUnique({ where: { email } })
    if (existingCustomer) {
      return NextResponse.json({ error: 'Customer with this email already exists' }, { status: 400 })
    }

    // Armar la transacción: 1) crear customer, 2) crear property (si viene completa)
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          fullName,
          email,
          phone,
          // tus campos "requeridos" en schema con placeholder
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

      let property = null as null | {
        id: string
        address: string
        city: string
        state: string
        zip: string
        createdAt: Date
      }

      // Crear property solo si llegan TODOS los campos
      const hasProperty =
        propertyInput &&
        propertyInput.address?.trim() &&
        propertyInput.city?.trim() &&
        propertyInput.state?.trim() &&
        propertyInput.zip?.trim()

      if (hasProperty) {
        // Evitar duplicado de dirección para el mismo cliente (aunque es nuevo, dejamos lógica por consistencia)
        property = await tx.property.create({
          data: {
            address: propertyInput!.address!.trim(),
            city: propertyInput!.city!.trim(),
            state: propertyInput!.state!.trim(),
            zip: propertyInput!.zip!.trim(),
            customerId: customer.id
          },
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            createdAt: true
          }
        })
      }

      return { customer, property }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}