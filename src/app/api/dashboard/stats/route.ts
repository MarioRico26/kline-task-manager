//src/app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const prisma = global.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

interface ServiceCount {
  [key: string]: number
}

interface StatusCount {
  [key: string]: { count: number; color: string }
}

function normalizeWorkflowKey(value: string) {
  return value.trim().toLowerCase()
}

function getCurrentWorkflowStep(definedSteps: number[], historySteps: number[]) {
  if (definedSteps.length === 0) return 0

  const startStep = definedSteps[0]
  let currentStep = 0

  for (const step of historySteps) {
    if (step === startStep) {
      currentStep = startStep
      continue
    }

    const currentIndex = definedSteps.indexOf(currentStep)
    if (currentIndex >= 0 && definedSteps[currentIndex + 1] === step) {
      currentStep = step
    }
  }

  return currentStep
}

export async function GET() {
  try {
    const [
      totalTasks,
      totalCustomers,
      totalServices,
      totalUsers,
      totalProperties,
      totalStatuses,
      sequentialServices,
      tasks,
    ] = await Promise.all([
      prisma.task.count(),
      prisma.customer.count(),
      prisma.service.count(),
      prisma.user.count(),
      prisma.property.count(),
      prisma.taskStatus.count(),
      prisma.service.findMany({
        where: {
          isSequential: true,
          workflowGroup: { not: null },
          stepOrder: { not: null },
        },
        select: { name: true, workflowGroup: true, stepOrder: true },
      }),
      prisma.task.findMany({
        include: {
          service: { select: { name: true, isSequential: true, workflowGroup: true, stepOrder: true } },
          customer: { select: { id: true, fullName: true } },
          status: { select: { name: true, color: true } },
          property: { select: { id: true, address: true, city: true, state: true, zip: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      }),
    ])

    const completedTasks = tasks.filter((t) => t.completedAt !== null).length
    const pendingTasks = tasks.filter((t) => t.completedAt === null).length

    const overdueTasks = tasks.filter((t) => {
      return t.completedAt === null && t.scheduledFor && new Date(t.scheduledFor) < new Date()
    }).length

    const serviceCount: ServiceCount = {}
    for (const t of tasks) {
      const name = t.service.name
      serviceCount[name] = (serviceCount[name] || 0) + 1
    }

    const tasksByService = Object.entries(serviceCount)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)

    const statusCount: StatusCount = {}
    for (const t of tasks) {
      const name = t.status.name
      const color = t.status.color || '#1e3a5f'
      if (!statusCount[name]) statusCount[name] = { count: 0, color }
      statusCount[name].count++
    }

    const tasksByStatus = Object.entries(statusCount).map(([status, data]) => ({
      status,
      count: data.count,
      color: data.color,
    }))

    const recentTasks = tasks.slice(0, 8).map((t) => ({
      id: t.id,
      service: t.service.name,
      customer: t.customer.fullName,
      status: t.status.name,
      scheduledFor: t.scheduledFor ? new Date(t.scheduledFor).toISOString() : null,
      address: `${t.property.address}, ${t.property.city}`,
    }))

    const workflowDefinitions = new Map<
      string,
      { label: string; steps: Array<{ stepOrder: number; name: string }> }
    >()

    sequentialServices.forEach((service) => {
      if (!service.workflowGroup || service.stepOrder === null) return

      const workflowKey = normalizeWorkflowKey(service.workflowGroup)
      const existing = workflowDefinitions.get(workflowKey)
      if (existing) {
        existing.steps.push({ stepOrder: service.stepOrder, name: service.name })
      } else {
        workflowDefinitions.set(workflowKey, {
          label: service.workflowGroup,
          steps: [{ stepOrder: service.stepOrder, name: service.name }],
        })
      }
    })

    workflowDefinitions.forEach((definition) => {
      definition.steps.sort((a, b) => a.stepOrder - b.stepOrder)
    })

    const monitorMap = new Map<
      string,
      {
        customerName: string
        propertyLabel: string
        workflowKey: string
        workflowLabel: string
        history: Array<{ stepOrder: number; createdAt: string }>
        lastActivity: string | null
      }
    >()

    tasks.forEach((task) => {
      if (!task.service.isSequential || task.service.stepOrder === null) return

      const workflowKey = normalizeWorkflowKey(task.service.workflowGroup || '')
      if (!workflowKey || !workflowDefinitions.has(workflowKey)) return

      const groupKey = `${task.customer.id}::${task.property.id}::${workflowKey}`
      const existing = monitorMap.get(groupKey)
      const createdAt = task.createdAt.toISOString()

      if (existing) {
        existing.history.push({ stepOrder: task.service.stepOrder, createdAt })
        if (!existing.lastActivity || createdAt > existing.lastActivity) {
          existing.lastActivity = createdAt
        }
      } else {
        monitorMap.set(groupKey, {
          customerName: task.customer.fullName,
          propertyLabel: `${task.property.address}, ${task.property.city}`,
          workflowKey,
          workflowLabel: workflowDefinitions.get(workflowKey)?.label || workflowKey,
          history: [{ stepOrder: task.service.stepOrder, createdAt }],
          lastActivity: createdAt,
        })
      }
    })

    const sequentialWorkflowMonitor = Array.from(monitorMap.values())
      .map((record) => {
        const definition = workflowDefinitions.get(record.workflowKey)
        if (!definition) return null

        const definedSteps = definition.steps.map((step) => step.stepOrder)
        const sortedHistory = record.history
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .map((item) => item.stepOrder)
        const currentStep = getCurrentWorkflowStep(definedSteps, sortedHistory)
        const currentIndex = definedSteps.indexOf(currentStep)
        const isCompleted = currentIndex === definedSteps.length - 1 && currentIndex >= 0

        const nextStep = currentStep === 0
          ? definedSteps[0]
          : isCompleted
            ? definedSteps[0]
            : definedSteps[currentIndex + 1]

        const currentStepDef = definition.steps.find((step) => step.stepOrder === currentStep)
        const nextStepDef = definition.steps.find((step) => step.stepOrder === nextStep)

        return {
          workflow: record.workflowLabel,
          customer: record.customerName,
          property: record.propertyLabel,
          currentStep: currentStepDef
            ? `${currentStepDef.stepOrder}. ${currentStepDef.name}`
            : 'Not started',
          nextStep: nextStepDef
            ? `${nextStepDef.stepOrder}. ${nextStepDef.name}`
            : '—',
          status: isCompleted ? 'COMPLETED' : currentStep === 0 ? 'NOT_STARTED' : 'IN_PROGRESS',
          lastActivity: record.lastActivity,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        const priority = { IN_PROGRESS: 0, NOT_STARTED: 1, COMPLETED: 2 }
        const p = priority[a.status as keyof typeof priority] - priority[b.status as keyof typeof priority]
        if (p !== 0) return p
        if (!a.lastActivity && !b.lastActivity) return 0
        if (!a.lastActivity) return 1
        if (!b.lastActivity) return -1
        return b.lastActivity.localeCompare(a.lastActivity)
      })
      .slice(0, 12)

    const res = NextResponse.json({
      totalTasks,
      totalCustomers,
      totalServices,
      totalUsers,
      totalProperties,
      totalStatuses,
      completedTasks,
      pendingTasks,
      overdueTasks,
      tasksByStatus,
      tasksByService,
      recentTasks,
      sequentialWorkflowMonitor,
    })

    // Evita respuestas “cacheadas raras”
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: unknown) {
    console.error('❌ Error fetching dashboard stats:', error)
    const details = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details },
      { status: 500 }
    )
  }
}
