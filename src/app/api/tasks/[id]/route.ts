// kline-task-manager/src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { uploadFile } from '@/lib/upload'
import { sendTaskUpdateEmail } from '@/lib/email'
import { sendSMS, buildTaskSMS } from '@/lib/sendSms'

const prisma = new PrismaClient()

function getTaskIdFromRequest(request: NextRequest) {
  const url = new URL(request.url)
  const pathSegments = url.pathname.split('/')
  return pathSegments[pathSegments.length - 1]
}

export async function PUT(request: NextRequest) {
  try {
    const taskId = getTaskIdFromRequest(request)

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const formData = await request.formData()

    const customerId = formData.get('customerId') as string
    const propertyId = formData.get('propertyId') as string
    const serviceId = formData.get('serviceId') as string
    const statusId = formData.get('statusId') as string
    const notes = (formData.get('notes') as string) || ''
    const scheduledFor = (formData.get('scheduledFor') as string) || ''
    const files = formData.getAll('files') as File[]

    // Validación básica
    if (!customerId || !propertyId || !serviceId || !statusId) {
      return NextResponse.json(
        { error: 'Missing required fields (customerId, propertyId, serviceId, statusId)' },
        { status: 400 }
      )
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { customer: true, property: true, service: true, status: true }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const newStatus = await prisma.taskStatus.findUnique({
      where: { id: statusId }
    })

    if (!newStatus) {
      return NextResponse.json({ error: 'Status not found' }, { status: 400 })
    }

    // Actualizar task
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        customerId,
        propertyId,
        serviceId,
        statusId,
        notes: notes ? notes : null,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null
      },
      include: {
        customer: true,
        property: true,
        service: true,
        status: true,
        media: true
      }
    })

    // Subir archivos (si vienen)
    const uploadedImages: string[] = []
    if (files?.length > 0) {
      for (const file of files) {
        if (!file || file.size <= 0) continue

        try {
          const url = await uploadFile(file, taskId)
          await prisma.taskMedia.create({
            data: { url, taskId }
          })
          uploadedImages.push(url)
        } catch (err) {
          console.error('⚠ Failed uploading a file:', err)
        }
      }
    }

    // Notificaciones (solo si el status lo requiere)
    if (newStatus.notifyClient) {
      const notificationPromises: Promise<any>[] = []

      const smsText = buildTaskSMS(
        task.customer.fullName,
        task.service.name,
        task.service.description || null,
        task.property.address,
        task.property.city,
        newStatus.name
      )

      // Email
      if (task.customer.email) {
        notificationPromises.push(
          sendTaskUpdateEmail({
            to: task.customer.email,
            subject: `Service Update: ${task.service.name}`,
            customerName: task.customer.fullName,
            service: {
              name: task.service.name,
              description: task.service.description || null,
            },
            property: `${task.property.address}, ${task.property.city}, ${task.property.state} ${task.property.zip}`,
            status: newStatus.name,
            scheduledFor: task.scheduledFor?.toISOString() || null,
            notes: task.notes,
            images: uploadedImages
          })
            .then(() => console.log('✅ Email sent successfully'))
            .catch(e => console.error('❌ Email failed:', e))
        )
      }

      // SMS
      if (task.customer.phone) {
        notificationPromises.push(
          sendSMS(task.customer.phone, smsText)
            .then(() => console.log('✅ SMS sent successfully'))
            .catch(e => console.error('❌ SMS failed:', e))
        )
      }

      if (notificationPromises.length > 0) {
        await Promise.allSettled(notificationPromises)
        console.log('📧 All notifications processed')
      }
    }

    console.log('✅ Task updated + notifications triggered')
    return NextResponse.json(task)
  } catch (error) {
    console.error('❌ Error updating task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const taskId = getTaskIdFromRequest(request)

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    await prisma.task.delete({ where: { id: taskId } })
    return NextResponse.json({ message: 'Task deleted successfully' })
  } catch (error) {
    console.error('❌ Error deleting task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
