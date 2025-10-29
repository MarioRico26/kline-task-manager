//kline-task-manager/src/app/api/tasks/route.ts:
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { uploadFile } from '@/lib/upload'
import { sendTaskUpdateEmail } from '@/lib/email'
import { sendSMS } from '@/lib/sendSms'
import { formatPhone } from '@/lib/formatPhone'

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
            email: true
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

    // Enviar email si el status notifica al cliente
    if (status.notifyClient) {
      const phone = formatPhone(customer.phone)
      const message = `📌 Service Update\n${service.name}\nStatus: ${status.name}`
    
      // Email
      if (customer.email) {
        sendTaskUpdateEmail({
          to: customer.email,
          subject: `Service Update: ${service.name}`,
          customerName: customer.fullName,
          service: service.name,
          property: `${property.address}, ${property.city}, ${property.state}`,
          status: status.name,
          scheduledFor: task.scheduledFor?.toISOString() || null,
          notes: task.notes,
          images: uploadedImages
        }).catch(e => console.error("Email failed:", e))
      }
    
      // SMS
      if (phone) {
        sendSMS(phone, message)
          .catch(e => console.error("SMS failed:", e))
      }
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}