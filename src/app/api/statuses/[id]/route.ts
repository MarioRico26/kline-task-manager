import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type StatusPayload = {
  name: string
  color: string | null
  notifyClient: boolean
  clientMessage: string | null
  isSequential: boolean
  workflowGroup: string | null
  stepOrder: number | null
}

function parseStatusPayload(raw: unknown): { data?: StatusPayload; error?: string } {
  const body = (raw ?? {}) as Record<string, unknown>

  const name = String(body.name ?? '').trim()
  const colorInput = String(body.color ?? '').trim()
  const clientMessageInput = String(body.clientMessage ?? '').trim()
  const isSequential = Boolean(body.isSequential)
  const notifyClient = Boolean(body.notifyClient)
  const workflowGroupInput = String(body.workflowGroup ?? '').trim()
  const stepOrderRaw = body.stepOrder

  if (!name) return { error: 'Status name is required' }

  let stepOrder: number | null = null
  if (stepOrderRaw !== undefined && stepOrderRaw !== null && String(stepOrderRaw).trim() !== '') {
    stepOrder = Number(stepOrderRaw)
    if (!Number.isInteger(stepOrder) || stepOrder < 1) {
      return { error: 'Step order must be a positive integer' }
    }
  }

  if (isSequential) {
    if (!workflowGroupInput) return { error: 'Workflow group is required for sequential statuses' }
    if (stepOrder === null) return { error: 'Step order is required for sequential statuses' }
  }

  return {
    data: {
      name,
      color: colorInput || null,
      notifyClient,
      clientMessage: clientMessageInput || null,
      isSequential,
      workflowGroup: isSequential ? workflowGroupInput : null,
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
    const parsed = parseStatusPayload(body)

    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid payload' }, { status: 400 })
    }

    const duplicateName = await prisma.taskStatus.findFirst({
      where: {
        id: { not: id },
        name: { equals: parsed.data.name, mode: 'insensitive' },
      },
      select: { id: true },
    })

    if (duplicateName) {
      return NextResponse.json({ error: 'Status with this name already exists' }, { status: 400 })
    }

    if (parsed.data.isSequential && parsed.data.workflowGroup && parsed.data.stepOrder !== null) {
      const duplicateStep = await prisma.taskStatus.findFirst({
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

    const status = await prisma.taskStatus.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        color: true,
        notifyClient: true,
        clientMessage: true,
        isSequential: true,
        workflowGroup: true,
        stepOrder: true,
        createdAt: true,
      },
    })

    return NextResponse.json(status)
  } catch (error) {
    console.error('Error updating status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.taskStatus.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Status deleted successfully' })
  } catch (error) {
    console.error('Error deleting status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
