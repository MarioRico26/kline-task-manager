import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { uploadFile } from '@/lib/upload'
import { sendTaskUpdateEmail } from '@/lib/email'
import { sendSMS, buildTaskSMS } from '@/lib/sendSms'
import { formatPhone } from '@/lib/formatPhone'
import { getSessionUser } from '@/lib/sessionUser'
import { isPermitsServiceLike } from '@/lib/userScope'

const prisma = new PrismaClient()

function normalizeWorkflowGroup(value: string) {
  return value.trim().toLowerCase()
}

const permitsTaskFilter = {
  service: {
    OR: [
      { workflowGroup: { contains: 'permit', mode: 'insensitive' as const } },
      { name: { contains: 'permit', mode: 'insensitive' as const } },
    ],
  },
}

export async function GET() {
  try {
    console.log('🔄 Fetching tasks from database...')
    const sessionUser = await getSessionUser(prisma)

    const tasks = await prisma.task.findMany({
      where: sessionUser?.accessScope === 'PERMITS_ONLY' ? permitsTaskFilter : undefined,
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

async function getDefaultInProgressStatusId() {
  const inProgress = await prisma.taskStatus.findFirst({
    where: { name: { equals: 'In Progress', mode: 'insensitive' } },
    select: { id: true },
  })

  if (inProgress?.id) return inProgress.id

  const open = await prisma.taskStatus.findFirst({
    where: { name: { equals: 'Open', mode: 'insensitive' } },
    select: { id: true },
  })

  return open?.id || null
}

async function getDefaultCompletedStatusId() {
  const completed = await prisma.taskStatus.findFirst({
    where: { name: { equals: 'Completed', mode: 'insensitive' } },
    select: { id: true },
  })

  return completed?.id || null
}

function isCompletedStatusName(statusName: string | null | undefined) {
  return (statusName || '').trim().toLowerCase() === 'completed'
}

async function getNextSequentialStep(
  customerId: string,
  propertyId: string,
  workflowGroup: string
) {
  const normalizedWorkflowGroup = normalizeWorkflowGroup(workflowGroup)

  const workflowServices = await prisma.service.findMany({
    where: {
      isSequential: true,
      workflowGroup: { equals: normalizedWorkflowGroup, mode: 'insensitive' },
      stepOrder: { not: null },
    },
    orderBy: { stepOrder: 'asc' },
    select: { stepOrder: true, name: true },
  })

  if (workflowServices.length === 0) return null

  const definedSteps = workflowServices
    .map((service) => service.stepOrder || 0)
    .filter((step) => step > 0)
  if (definedSteps.length === 0) return null

  const previousTasks = await prisma.task.findMany({
    where: {
      customerId,
      propertyId,
      service: {
        isSequential: true,
        workflowGroup: { equals: normalizedWorkflowGroup, mode: 'insensitive' },
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      service: {
        select: {
          stepOrder: true,
        },
      },
      status: {
        select: {
          name: true,
        },
      },
    },
  })

  const completedSteps = new Set<number>()
  for (const task of previousTasks) {
    const step = task.service.stepOrder || 0
    if (!step || !isCompletedStatusName(task.status?.name)) continue
    if (!completedSteps.has(step)) completedSteps.add(step)
  }

  const nextStep = definedSteps.find((step) => !completedSteps.has(step))
  if (!nextStep) return null

  const nextService = workflowServices.find((service) => service.stepOrder === nextStep)
  if (!nextService?.stepOrder) return null

  return {
    stepOrder: nextService.stepOrder,
    name: nextService.name,
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser(prisma)
    const formData = await request.formData()

    const customerId = (formData.get('customerId') as string) || ''
    const propertyId = (formData.get('propertyId') as string) || ''
    const serviceId = (formData.get('serviceId') as string) || ''
    const statusIdFromForm = (formData.get('statusId') as string) || '' // puede venir vacío
    const hasCustomStatus = Boolean(statusIdFromForm)
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
    const [customer, property, service] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, customerId: true, address: true, city: true, state: true, zip: true } }),
      prisma.service.findUnique({ where: { id: serviceId } }),
    ])

    if (!customer || !property || !service) {
      return NextResponse.json(
        { error: 'Invalid customer, property, or service' },
        { status: 400 }
      )
    }

    if (property.customerId !== customerId) {
      return NextResponse.json(
        { error: 'Selected property does not belong to selected customer' },
        { status: 400 }
      )
    }

    if (sessionUser?.accessScope === 'PERMITS_ONLY' && !isPermitsServiceLike(service)) {
      return NextResponse.json(
        { error: 'Your account can only create permit-related tasks.' },
        { status: 403 }
      )
    }

    if (service.isSequential) {
      if (!service.workflowGroup || service.stepOrder === null) {
        return NextResponse.json(
          { error: `Service "${service.name}" is misconfigured for sequential workflow.` },
          { status: 400 }
        )
      }

      const normalizedWorkflowGroup = normalizeWorkflowGroup(service.workflowGroup)
      const nextStep = await getNextSequentialStep(customerId, propertyId, normalizedWorkflowGroup)

      if (!nextStep) {
        return NextResponse.json(
          { error: `Workflow "${service.workflowGroup}" is already completed for this customer and property.` },
          { status: 400 }
        )
      }

      if (service.stepOrder !== nextStep.stepOrder) {
        return NextResponse.json(
          {
            error: `Before "${service.name}", you need to complete "${nextStep.name}" (step ${nextStep.stepOrder}) first.`,
          },
          { status: 400 }
        )
      }

      const existingStepTasks = await prisma.task.findMany({
        where: {
          customerId,
          propertyId,
          serviceId: service.id,
        },
        select: {
          status: {
            select: {
              name: true,
            },
          },
        },
      })

      const hasOpenStep = existingStepTasks.some((task) => !isCompletedStatusName(task.status?.name))
      if (hasOpenStep) {
        return NextResponse.json(
          { error: `There is already an active "${service.name}" task for this customer and property.` },
          { status: 400 }
        )
      }

      if (!hasCustomStatus && service.stepOrder === 1) {
        const inProgressId = await getDefaultInProgressStatusId()
        if (inProgressId) {
          finalStatusId = inProgressId
        }
      }
    }

    const status = await prisma.taskStatus.findUnique({
      where: { id: finalStatusId },
    })

    if (!status) {
      return NextResponse.json(
        { error: 'Invalid status selected' },
        { status: 400 }
      )
    }

    const task = await prisma.task.create({
      data: {
        customerId,
        propertyId,
        serviceId,
        statusId: finalStatusId,
        completedAt: isCompletedStatusName(status.name) ? new Date() : null,
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
        service.clientMessage || null,
        task.notes,
      )

      const notificationPromises: Promise<unknown>[] = []

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
