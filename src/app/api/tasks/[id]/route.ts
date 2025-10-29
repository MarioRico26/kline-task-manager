import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { uploadFile } from '@/lib/upload'
import { sendTaskUpdateEmail } from '@/lib/email'
import { sendSMS } from '@/lib/sendSms'
import { formatPhone } from '@/lib/formatPhone'

const prisma = new PrismaClient()

export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const taskId = pathSegments[pathSegments.length - 1]

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const formData = await request.formData()
    
    const customerId = formData.get('customerId') as string
    const propertyId = formData.get('propertyId') as string
    const serviceId = formData.get('serviceId') as string
    const statusId = formData.get('statusId') as string
    const notes = formData.get('notes') as string
    const scheduledFor = formData.get('scheduledFor') as string
    const files = formData.getAll('files') as File[]

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

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        customerId,
        propertyId,
        serviceId,
        statusId,
        notes: notes || null,
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

    const uploadedImages: string[] = []
    if (files?.length > 0) {
      for (const file of files) {
        if (file.size > 0) {
          try {
            const url = await uploadFile(file, taskId)
            await prisma.taskMedia.create({
              data: { url, taskId }
            })
            uploadedImages.push(url)
          } catch (err) {
            console.error("⚠ Failed uploading a file:", err)
          }
        }
      }
    }

    // ✅ Enviar notificaciones sin bloquear la respuesta
    if (newStatus?.notifyClient) {
      const phone = formatPhone(existingTask.customer.phone)
      const message = `📌 Service Update\n${task.service.name}\nStatus: ${newStatus.name}`

      // ✅ Email si el cliente tiene correo
      if (existingTask.customer.email) {
        sendTaskUpdateEmail({
          to: existingTask.customer.email,
          subject: `Service Update: ${task.service.name}`,
          customerName: existingTask.customer.fullName,
          service: task.service.name,
          property: `${task.property.address}, ${task.property.city}, ${task.property.state} ${task.property.zip}`,
          status: newStatus.name,
          scheduledFor: task.scheduledFor?.toISOString() || null,
          notes: task.notes,
          images: uploadedImages
        }).catch(e => console.error("❌ Email failed:", e))
      }

      // ✅ SMS si hay número
      if (phone) {
        sendSMS(phone, message)
          .catch(e => console.error("❌ SMS failed:", e))
      }
    }

    console.log("✅ Task updated + notifications triggered")
    return NextResponse.json(task)

  } catch (error) {
    console.error('❌ Error updating task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const taskId = pathSegments[pathSegments.length - 1]

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}