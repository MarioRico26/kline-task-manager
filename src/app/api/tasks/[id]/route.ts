import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { uploadFile } from '@/lib/upload'
import { sendTaskUpdateEmail } from '@/lib/email'

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

    // Verificar que la tarea existe
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { customer: true, property: true, service: true, status: true }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Obtener el nuevo status
    const newStatus = await prisma.taskStatus.findUnique({
      where: { id: statusId }
    })

    // Actualizar la tarea
    const task = await prisma.task.update({
      where: { id: taskId },
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

    // Subir nuevas imágenes
    const uploadedImages: string[] = []
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.size > 0) {
          try {
            const imageUrl = await uploadFile(file, taskId)
            
            await prisma.taskMedia.create({
              data: {
                url: imageUrl,
                taskId: taskId,
              }
            })
            
            uploadedImages.push(imageUrl)
          } catch (uploadError) {
            console.error('Error uploading file:', uploadError)
          }
        }
      }
    }

    // Enviar email si el status cambió y notifica al cliente
    if (newStatus?.notifyClient && existingTask.customer.email) {
      try {
        const emailData = {
          to: existingTask.customer.email,
          subject: `Service Update: ${task.service.name}`,
          customerName: existingTask.customer.fullName,
          service: task.service.name,
          property: `${task.property.address}, ${task.property.city}, ${task.property.state} ${task.property.zip}`,
          status: newStatus.name,
          scheduledFor: task.scheduledFor?.toISOString() || null,
          notes: task.notes,
          images: uploadedImages
        }

        await sendTaskUpdateEmail(emailData)
        console.log('Update email sent successfully to:', existingTask.customer.email)
      } catch (emailError) {
        console.error('Failed to send update email:', emailError)
      }
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    // Verificar que la tarea existe
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Eliminar la tarea (esto eliminará en cascada las media asociadas)
    await prisma.task.delete({
      where: { id: taskId }
    })

    return NextResponse.json({ message: 'Task deleted successfully' })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}