import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type ServicePayload = {
  name: string
  description: string | null
  clientMessage: string | null
  isSequential: boolean
  workflowGroup: string | null
  stepOrder: number | null
}

function parseServicePayload(raw: unknown): { data?: ServicePayload; error?: string } {
  const body = (raw ?? {}) as Record<string, unknown>

  const name = String(body.name ?? '').trim()
  const description = String(body.description ?? '').trim()
  const clientMessage = String(body.clientMessage ?? '').trim()
  const isSequential = Boolean(body.isSequential)
  const workflowGroup = String(body.workflowGroup ?? '').trim()
  const stepOrderRaw = body.stepOrder

  if (!name) return { error: 'Service name is required' }

  let stepOrder: number | null = null
  if (stepOrderRaw !== undefined && stepOrderRaw !== null && String(stepOrderRaw).trim() !== '') {
    stepOrder = Number(stepOrderRaw)
    if (!Number.isInteger(stepOrder) || stepOrder < 1) {
      return { error: 'Step order must be a positive integer' }
    }
  }

  if (isSequential) {
    if (!workflowGroup) return { error: 'Workflow group is required for sequential services' }
    if (stepOrder === null) return { error: 'Step order is required for sequential services' }
  }

  return {
    data: {
      name,
      description: description || null,
      clientMessage: clientMessage || null,
      isSequential,
      workflowGroup: isSequential ? workflowGroup : null,
      stepOrder: isSequential ? stepOrder : null,
    },
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = parseServicePayload(body)

    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid payload' }, { status: 400 })
    }

    const duplicateName = await prisma.service.findFirst({
      where: {
        id: { not: id },
        name: { equals: parsed.data.name, mode: 'insensitive' },
      },
      select: { id: true },
    })

    if (duplicateName) {
      return NextResponse.json({ error: 'Service with this name already exists' }, { status: 400 })
    }

    if (parsed.data.isSequential && parsed.data.workflowGroup && parsed.data.stepOrder !== null) {
      const duplicateStep = await prisma.service.findFirst({
        where: {
          id: { not: id },
          workflowGroup: parsed.data.workflowGroup,
          stepOrder: parsed.data.stepOrder,
        },
        select: { id: true },
      })

      if (duplicateStep) {
        return NextResponse.json(
          { error: `Step ${parsed.data.stepOrder} already exists in workflow "${parsed.data.workflowGroup}"` },
          { status: 400 }
        )
      }
    }

    const service = await prisma.service.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        description: true,
        clientMessage: true,
        isSequential: true,
        workflowGroup: true,
        stepOrder: true,
        createdAt: true,
      },
    })

    return NextResponse.json(service)
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.service.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Service deleted successfully' })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
