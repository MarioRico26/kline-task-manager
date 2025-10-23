import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ServiceCount {
  [key: string]: number
}

interface StatusCount {
  [key: string]: {
    count: number
    color: string
  }
}

export async function GET() {
  try {
    console.log('📊 Fetching dashboard stats...')
    
    // Obtener estadísticas básicas
    const [
      totalTasks,
      totalCustomers, 
      totalServices,
      totalUsers,
      totalProperties,
      totalStatuses,
      tasks,
      services,
      statuses
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
          property: { select: { address: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.service.findMany(),
      prisma.taskStatus.findMany()
    ])

    // Calcular tareas completadas y pendientes
    const completedTasks = tasks.filter(task => task.completedAt !== null).length
    const pendingTasks = tasks.filter(task => task.completedAt === null).length

    // Tasks by Service
    const serviceCount: ServiceCount = {}
    tasks.forEach(task => {
      const serviceName = task.service.name
      serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1
    })
    
    const tasksByService = Object.entries(serviceCount).map(([service, count]) => ({
      service,
      count
    })).sort((a, b) => b.count - a.count)

    // Tasks by Status  
    const statusCount: StatusCount = {}
    tasks.forEach(task => {
      const statusName = task.status.name
      const statusColor = task.status.color || '#1e3a5f'
      if (!statusCount[statusName]) {
        statusCount[statusName] = { count: 0, color: statusColor }
      }
      statusCount[statusName].count++
    })

    const tasksByStatus = Object.entries(statusCount).map(([status, data]) => ({
      status,
      count: data.count,
      color: data.color
    }))

    // Recent Tasks (últimas 6)
    const recentTasks = tasks.slice(0, 6).map(task => ({
      id: task.id,
      service: task.service.name,
      customer: task.customer.fullName, 
      status: task.status.name,
      scheduledFor: task.scheduledFor,
      address: task.property.address
    }))

    const stats = {
      totalTasks,
      totalCustomers,
      totalServices,
      totalUsers, 
      totalProperties,
      totalStatuses,
      completedTasks,
      pendingTasks,
      overdueTasks: tasks.filter(task => 
        task.completedAt === null && 
        task.scheduledFor && 
        new Date(task.scheduledFor) < new Date()
      ).length,
      tasksByStatus,
      tasksByService,
      recentTasks
    }

    console.log('✅ Dashboard stats fetched successfully')
    return NextResponse.json(stats)

  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}