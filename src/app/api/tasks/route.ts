import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { uploadFile } from '@/lib/upload'
import { sendTaskUpdateEmail } from '@/lib/email'
import { sendSMS, buildTaskSMS } from '@/lib/sendSms'
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
            email: true,
            phone: true,
          },
        },
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            zip: true,
          },
        },
        service: true,
        status: true,
        media: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log(`✅ Found ${tasks.length} tasks`)
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('❌ Error fetching tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getDefaultCompletedStatusId() {
  const completed = await prisma.taskStatus.findFirst({
    where: { name: { equals: 'Completed', mode: 'insensitive' } },
    select: { id: true },
  })

  return completed?.id || null
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const customerId = (formData.get('customerId') as string) || ''
    const propertyId = (formData.get('propertyId') as string) || ''
    const serviceId = (formData.get('serviceId') as string) || ''
    const statusIdFromForm = (formData.get('statusId') as string) || '' // puede venir vacío
    const notes = (formData.get('notes') as string) || ''
    const scheduledFor = (formData.get('scheduledFor') as string) || ''
    const files = formData.getAll('files') as File[]

    // ✅ requeridos reales
    if (!customerId || !propertyId || !serviceId) {
      return NextResponse.json(
        { error: 'Missing required fields: customerId, propertyId, serviceId' },
        { status: 400 }
      )
    }

    // ✅ status default = Completed si no mandan statusId
    let finalStatusId = statusIdFromForm
    if (!finalStatusId) {
      const completedId = await getDefaultCompletedStatusId()
      if (!completedId) {
        return NextResponse.json(
          { error: 'Default status "Completed" not found. Please create it in Statuses.' },
          { status: 400 }
        )
      }
      finalStatusId = completedId
    }

    // ✅ Cargar entidades (y validar que existan)
    const [customer, property, service, status] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.property.findUnique({ where: { id: propertyId } }),
      prisma.service.findUnique({ where: { id: serviceId } }),
      prisma.taskStatus.findUnique({ where: { id: finalStatusId } }),
    ])

    if (!customer || !property || !service || !status) {
      return NextResponse.json(
        { error: 'Invalid customer, property, service, or status' },
        { status: 400 }
      )
    }

    const task = await prisma.task.create({
      data: {
        customerId,
        propertyId,
        serviceId,
        statusId: finalStatusId,
        notes: notes || null,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      },
      include: {
        customer: true,
        property: true,
        service: true,
        status: true,
        media: true,
      },
    })

    // ✅ uploads
    const uploadedImages: string[] = []
    if (files?.length > 0) {
      for (const file of files) {
        if (file.size > 0) {
          try {
            const imageUrl = await uploadFile(file, task.id)

            await prisma.taskMedia.create({
              data: { url: imageUrl, taskId: task.id },
            })

            uploadedImages.push(imageUrl)
          } catch (uploadErr) {
            console.error('⚠ Error uploading file:', uploadErr)
          }
        }
      }
    }

    // ✅ Notificaciones (solo si el status notifica)
    if (status.notifyClient) {
      const phone = formatPhone(customer.phone)

      // ✅ SMS “bonito” (igual que update)
      const smsText = buildTaskSMS(
        customer.fullName,
        service.name,
        service.description || null,
      )

      const notificationPromises: Promise<any>[] = []

      // ✅ Email
      if (customer.email) {
        notificationPromises.push(
          sendTaskUpdateEmail({
            to: customer.email,
            subject: `Service Update: ${service.name}`,
            customerName: customer.fullName,
            service: {
              name: service.name,
              description: service.description || null,
            },
            property: `${property.address}, ${property.city}, ${property.state} ${property.zip}`,
            status: status.name,
            scheduledFor: task.scheduledFor?.toISOString() || null,
            notes: task.notes,
            images: uploadedImages,
          })
            .then(() => console.log('✅ Email sent successfully'))
            .catch((err) => console.error('❌ Email failed:', err))
        )
      }

      // ✅ SMS
      if (phone) {
        notificationPromises.push(
          sendSMS(phone, smsText)
            .then(() => console.log('✅ SMS sent successfully'))
            .catch((err) => console.error('❌ SMS failed:', err))
        )
      }

      if (notificationPromises.length > 0) {
        await Promise.allSettled(notificationPromises)
        console.log('📩 All notifications processed')
      }
    }

    console.log('✅ Task created + notifications sent (if enabled)')
    return NextResponse.json(task)
  } catch (error) {
    console.error('❌ Error creating task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
