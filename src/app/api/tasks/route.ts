import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { uploadFile } from '@/lib/upload'
import { sendTaskUpdateEmail } from '@/lib/email'
import { smsService } from '@/lib/sms-services'

const prisma = new PrismaClient()

export async function GET() {
  try {
    console.log('🔄 Fetching tasks from database...')
    
    const tasks = await prisma.task.findMany({
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true  // ← Agregar phone aquí también
          }
        },
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true
          }
        },
        service: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        status: {
          select: {
            id: true,
            name: true,
            color: true,
            notifyClient: true
          }
        },
        media: {
          select: {
            id: true,
            url: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`✅ Found ${tasks.length} tasks`)
    return NextResponse.json(tasks)
    
  } catch (error) {
    console.error('❌ Error fetching tasks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    const customerId = formData.get('customerId') as string
    const propertyId = formData.get('propertyId') as string
    const serviceId = formData.get('serviceId') as string
    const statusId = formData.get('statusId') as string
    const notes = formData.get('notes') as string
    const scheduledFor = formData.get('scheduledFor') as string
    const files = formData.getAll('files') as File[]

    // Validar datos requeridos
    if (!customerId || !propertyId || !serviceId || !statusId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Obtener datos relacionados
    const [customer, property, service, status] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.property.findUnique({ where: { id: propertyId } }),
      prisma.service.findUnique({ where: { id: serviceId } }),
      prisma.taskStatus.findUnique({ where: { id: statusId } })
    ])

    if (!customer || !property || !service || !status) {
      return NextResponse.json(
        { error: 'Invalid customer, property, service, or status' },
        { status: 400 }
      )
    }

    // Crear la tarea
    const task = await prisma.task.create({
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

    // Subir imágenes si existen
    const uploadedImages: string[] = []
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.size > 0) {
          try {
            const imageUrl = await uploadFile(file, task.id)
            
            await prisma.taskMedia.create({
              data: {
                url: imageUrl,
                taskId: task.id,
              }
            })
            
            uploadedImages.push(imageUrl)
          } catch (uploadError) {
            console.error('Error uploading file:', uploadError)
            // Continuar con otras imágenes incluso si una falla
          }
        }
      }
    }

    // ENVIAR NOTIFICACIONES EN PARALELO E INDEPENDIENTES
    const notificationPromises = [];

    // 1. EMAIL - Si el status notifica al cliente
    if (status.notifyClient && customer.email) {
      notificationPromises.push(
        (async () => {
          try {
            const emailData = {
              to: customer.email,
              subject: `Service Update: ${service.name}`,
              customerName: customer.fullName,
              service: service.name,
              property: `${property.address}, ${property.city}, ${property.state} ${property.zip}`,
              status: status.name,
              scheduledFor: task.scheduledFor?.toISOString() || null,
              notes: task.notes,
              images: uploadedImages
            }

            await sendTaskUpdateEmail(emailData)
            console.log('✅ Email sent successfully to:', customer.email)
            return { type: 'email', success: true }
          } catch (emailError) {
            console.error('❌ Failed to send email:', emailError)
            return { type: 'email', success: false, error: emailError }
          }
        })()
      );
    }

    // 2. SMS - Independiente del email (siempre que tenga teléfono)
    if (customer.phone) {
      notificationPromises.push(
        (async () => {
          try {
            const smsResult = await smsService.sendTaskNotification(
              customer.phone!, // El teléfono sin formato +1
              customer.fullName,
              {
                service: service.name,
                scheduledFor: task.scheduledFor,
                status: status.name,
                propertyAddress: `${property.address}, ${property.city}`
              },
              'creation'
            )

            if (smsResult.success) {
              console.log('✅ SMS sent successfully to:', customer.phone)
              return { type: 'sms', success: true }
            } else {
              console.warn('⚠️ SMS failed:', smsResult.error)
              return { type: 'sms', success: false, error: smsResult.error }
            }
          } catch (smsError) {
            console.error('❌ SMS sending error:', smsError)
            return { type: 'sms', success: false, error: smsError }
          }
        })()
      );
    }

    // Esperar todas las notificaciones (pero no fallar si alguna falla)
    if (notificationPromises.length > 0) {
      const results = await Promise.allSettled(notificationPromises);
      console.log('📨 Notification results:', results);
    }

    return NextResponse.json({
      ...task,
      notifications: {
        email: customer.email && status.notifyClient ? 'sent' : 'skipped',
        sms: customer.phone ? 'sent' : 'no_phone'
      }
    })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}