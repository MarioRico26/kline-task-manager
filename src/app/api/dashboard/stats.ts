import { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { range = 'month' } = req.query
    
    // Calcular fechas según el rango
    const now = new Date()
    let startDate = new Date()
    
    switch (range) {
      case 'week':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(now.getMonth() - 1)
        break
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setMonth(now.getMonth() - 1)
    }

    // Obtener todas las estadísticas en paralelo
    const [
      totalTasks,
      totalCustomers,
      totalServices,
      totalUsers,
      totalProperties,
      completedTasks,
      pendingTasks,
      overdueTasks,
      tasksByStatusData,
      tasksByServiceData,
      recentTasks
    ] = await Promise.all([
      // Totales básicos
      prisma.task.count(),
      prisma.customer.count(),
      prisma.service.count(),
      prisma.user.count(),
      prisma.property.count(),
      
      // Tareas completadas
      prisma.task.count({ 
        where: { 
          completedAt: { not: null },
          createdAt: { gte: startDate }
        } 
      }),
      
      // Tareas pendientes
      prisma.task.count({ 
        where: { 
          completedAt: null,
          scheduledFor: { gte: now }
        } 
      }),
      
      // Tareas vencidas
      prisma.task.count({ 
        where: { 
          completedAt: null,
          scheduledFor: { lt: now }
        } 
      }),
      
      // Tareas por estado
      prisma.taskStatus.findMany({
        include: {
          tasks: {
            where: { createdAt: { gte: startDate } },
            select: { id: true }
          }
        }
      }),
      
      // Tareas por servicio
      prisma.service.findMany({
        include: {
          tasks: {
            where: { createdAt: { gte: startDate } },
            select: { id: true }
          }
        }
      }),
      
      // Tareas recientes
      prisma.task.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          service: { select: { name: true } },
          customer: { select: { fullName: true } },
          status: { select: { name: true } }
        }
      })
    ])

    // Procesar datos para gráficos
    const tasksByStatus = tasksByStatusData.map(status => ({
      status: status.name,
      count: status.tasks.length,
      color: status.color || '#6b7280'
    }))

    const tasksByService = tasksByServiceData.map(service => ({
      service: service.name,
      count: service.tasks.length
    })).filter(item => item.count > 0).sort((a, b) => b.count - a.count)

    const formattedRecentTasks = recentTasks.map(task => ({
      id: task.id,
      service: task.service.name,
      customer: task.customer.fullName,
      status: task.status.name,
      scheduledFor: task.scheduledFor
    }))

    const stats = {
      totalTasks,
      totalCustomers,
      totalServices,
      totalUsers,
      totalProperties,
      completedTasks,
      pendingTasks,
      overdueTasks,
      tasksByStatus,
      tasksByService,
      recentTasks: formattedRecentTasks,
      monthlyStats: [] // Podrías agregar estadísticas mensuales aquí
    }

    res.status(200).json(stats)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}