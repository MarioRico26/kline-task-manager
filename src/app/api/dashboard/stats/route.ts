//src/app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
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

export async function GET() {
  try {
    const [
      totalTasks,
      totalCustomers,
      totalServices,
      totalUsers,
      totalProperties,
      totalStatuses,
      tasks,
    ] = await Promise.all([
      prisma.task.count(),
      prisma.customer.count(),
      prisma.service.count(),
      prisma.user.count(),
      prisma.property.count(),
      prisma.taskStatus.count(),
      prisma.task.findMany({
        include: {
          service: { select: { name: true } },
          customer: { select: { fullName: true } },
          status: { select: { name: true, color: true } },
          property: { select: { address: true, city: true, state: true, zip: true } },
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
    })

    // Evita respuestas “cacheadas raras”
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: any) {
    console.error('❌ Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
