import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSessionUser } from '@/lib/sessionUser'

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

  if (!name) {
    return { error: 'Status name is required' }
  }

  let stepOrder: number | null = null
  if (stepOrderRaw !== undefined && stepOrderRaw !== null && String(stepOrderRaw).trim() !== '') {
    stepOrder = Number(stepOrderRaw)
    if (!Number.isInteger(stepOrder) || stepOrder < 1) {
      return { error: 'Step order must be a positive integer' }
    }
  }

  if (isSequential) {
    if (!workflowGroupInput) {
      return { error: 'Workflow group is required for sequential statuses' }
    }
    if (stepOrder === null) {
      return { error: 'Step order is required for sequential statuses' }
    }
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

export async function GET() {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const statuses = await prisma.taskStatus.findMany({
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
      orderBy: [{ isSequential: 'desc' }, { workflowGroup: 'asc' }, { stepOrder: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(statuses)
  } catch (error) {
    console.error('Error fetching statuses:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (sessionUser.accessScope === 'PERMITS_ONLY') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = parseStatusPayload(body)

    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid payload' }, { status: 400 })
    }

    const existingStatus = await prisma.taskStatus.findFirst({
      where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
      select: { id: true },
    })

    if (existingStatus) {
      return NextResponse.json({ error: 'Status with this name already exists' }, { status: 400 })
    }

    if (parsed.data.isSequential && parsed.data.workflowGroup && parsed.data.stepOrder !== null) {
      const existingStep = await prisma.taskStatus.findFirst({
        where: {
          workflowGroup: parsed.data.workflowGroup,
          stepOrder: parsed.data.stepOrder,
        },
        select: { id: true },
      })

      if (existingStep) {
        return NextResponse.json(
          { error: `Step ${parsed.data.stepOrder} already exists in workflow "${parsed.data.workflowGroup}"` },
          { status: 400 }
        )
      }
    }

    const status = await prisma.taskStatus.create({
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
    console.error('Error creating status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
