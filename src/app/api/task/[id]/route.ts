import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { put } from '@vercel/blob'
import { sendTaskUpdateEmail } from '@/lib/email'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const formData = await request.formData()
    
    const customerId = formData.get('customerId') as string
    const propertyId = formData.get('propertyId') as string
    const serviceId = formData.get('serviceId') as string
    const statusId = formData.get('statusId') as string
    const notes = formData.get('notes') as string
    const scheduledFor = formData.get('scheduledFor') as string
    const files = formData.getAll('files') as File[]

    // Validar que la tarea existe
    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        customer: true,
        property: true,
        service: true,
        status: true
      }
    })

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Obtener el nuevo status
    const newStatus = await prisma.taskStatus.findUnique({
      where: { id: statusId }
    })

    if (!newStatus) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Actualizar la tarea
    const task = await prisma.task.update({
      where: { id },
      data: {
        customerId,
        propertyId,
        serviceId,
        statusId,
        notes: notes || null,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      },
      include: {
        customer: true,
        property: true,
        service: true,
        status: true,
        media: true
      }
    })

    // Subir nuevas imágenes si existen (OPCIONAL)
    const uploadedImages: string[] = []
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.size > 0) {
          const blob = await put(`tasks/${task.id}/${Date.now()}-${file.name}`, file, {
            access: 'public',
          })
          
          await prisma.taskMedia.create({
            data: {
              url: blob.url,
              taskId: task.id,
            }
          })
          
          uploadedImages.push(blob.url)
        }
      }
    }

    // Enviar email si:
    // 1. El nuevo status notifica al cliente Y
    // 2. El status cambió O es la primera vez que se notifica
    const shouldSendEmail = newStatus.notifyClient && 
      (existingTask.statusId !== statusId || !existingTask.status.notifyClient)

    if (shouldSendEmail) {
      const allImages = [...task.media.map(m => m.url), ...uploadedImages]
      
      const emailData = {
        to: task.customer.email,
        subject: `Service Update: ${task.service.name}`,
        customerName: task.customer.fullName,
        service: task.service.name,
        property: `${task.property.address}, ${task.property.city}, ${task.property.state} ${task.property.zip}`,
        status: task.status.name,
        scheduledFor: task.scheduledFor?.toISOString() || null,
        notes: task.notes,
        images: allImages
      }

      await sendTaskUpdateEmail(emailData)
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.task.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Task deleted successfully' })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}