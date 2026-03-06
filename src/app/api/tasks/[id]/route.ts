// kline-task-manager/src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { uploadFile } from "@/lib/upload"
import { sendTaskUpdateEmail } from "@/lib/email"
import { sendSMS, buildTaskSMS } from "@/lib/sendSms"
import { getSessionUser } from "@/lib/sessionUser"
import { isPermitsServiceLike } from "@/lib/userScope"
import { formatPhone } from "@/lib/formatPhone"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

function normalizeWorkflowGroup(value: string | null) {
  return (value || '').trim().toLowerCase()
}

function isCompletedStatusName(statusName: string | null | undefined) {
  return (statusName || '').trim().toLowerCase() === 'completed'
}

async function getDefaultInProgressStatusId() {
  const inProgress = await prisma.taskStatus.findFirst({
    where: { name: { equals: 'In Progress', mode: 'insensitive' } },
    select: { id: true, name: true, notifyClient: true },
  })

  if (inProgress?.id) return inProgress

  const open = await prisma.taskStatus.findFirst({
    where: { name: { equals: 'Open', mode: 'insensitive' } },
    select: { id: true, name: true, notifyClient: true },
  })

  return open || null
}

async function getNextSequentialService(service: {
  isSequential: boolean
  workflowGroup: string | null
  stepOrder: number | null
}) {
  if (!service.isSequential || !service.workflowGroup || service.stepOrder === null) {
    return null
  }

  return prisma.service.findFirst({
    where: {
      isSequential: true,
      workflowGroup: { equals: normalizeWorkflowGroup(service.workflowGroup), mode: 'insensitive' },
      stepOrder: service.stepOrder + 1,
    },
    select: {
      id: true,
      name: true,
      description: true,
      clientMessage: true,
      stepOrder: true,
    },
  })
}

async function validateSequentialServiceTransition(
  currentService: {
    id: string
    name: string
    isSequential: boolean
    workflowGroup: string | null
    stepOrder: number | null
  },
  targetService: {
    id: string
    name: string
    isSequential: boolean
    workflowGroup: string | null
    stepOrder: number | null
  }
): Promise<string | null> {
  if (!targetService.isSequential) return null
  const targetGroup = normalizeWorkflowGroup(targetService.workflowGroup)
  if (!targetGroup || targetService.stepOrder === null) {
    return `Service "${targetService.name}" is misconfigured. Missing workflowGroup or stepOrder.`
  }

  if (currentService.id === targetService.id) return null

  const currentGroup = normalizeWorkflowGroup(currentService.workflowGroup)

  if (
    currentService.isSequential &&
    currentGroup === targetGroup &&
    currentService.stepOrder !== null
  ) {
    const expectedStep = currentService.stepOrder + 1
    if (targetService.stepOrder !== expectedStep) {
      const expectedService = await prisma.service.findFirst({
        where: {
          workflowGroup: { equals: targetGroup, mode: 'insensitive' },
          stepOrder: expectedStep,
        },
        select: { name: true },
      })

      if (expectedService) {
        return `Before "${targetService.name}", you need to complete "${expectedService.name}" (step ${expectedStep}) first.`
      }

      return `Before "${targetService.name}", you need to complete step ${expectedStep} first.`
    }
    return null
  }

  if (targetService.stepOrder !== 1) {
    const firstStepService = await prisma.service.findFirst({
      where: {
        workflowGroup: { equals: targetGroup, mode: 'insensitive' },
        stepOrder: 1,
      },
      select: { name: true },
    })

    if (firstStepService) {
      return `This workflow must start with "${firstStepService.name}" (step 1) before "${targetService.name}".`
    }

    return `This workflow must start at step 1 before "${targetService.name}".`
  }

  return null
}

export async function PUT(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(prisma)
    const url = new URL(request.url)
    const pathSegments = url.pathname.split("/")
    const taskId = pathSegments[pathSegments.length - 1]

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    const formData = await request.formData()

    const customerId = formData.get("customerId") as string
    const propertyId = formData.get("propertyId") as string
    const serviceId = formData.get("serviceId") as string
    const statusId = formData.get("statusId") as string
    const notes = formData.get("notes") as string
    const scheduledFor = formData.get("scheduledFor") as string
    const files = formData.getAll("files") as File[]

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { customer: true, property: true, service: true, status: true },
    })

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    if (sessionUser?.accessScope === "PERMITS_ONLY" && !isPermitsServiceLike(existingTask.service)) {
      return NextResponse.json({ error: "Your account can only manage permit-related tasks." }, { status: 403 })
    }

    const newService = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        name: true,
        description: true,
        clientMessage: true,
        isSequential: true,
        workflowGroup: true,
        stepOrder: true,
      },
    })

    if (!newService) {
      return NextResponse.json({ error: "Service not found" }, { status: 400 })
    }

    if (sessionUser?.accessScope === "PERMITS_ONLY" && !isPermitsServiceLike(newService)) {
      return NextResponse.json({ error: "Your account can only assign permit-related services." }, { status: 403 })
    }

    const newStatus = await prisma.taskStatus.findUnique({
      where: { id: statusId },
      select: {
        id: true,
        name: true,
        notifyClient: true,
        clientMessage: true,
        isSequential: true,
        workflowGroup: true,
        stepOrder: true,
      },
    })

    if (!newStatus) {
      return NextResponse.json({ error: "Status not found" }, { status: 400 })
    }

    const sequenceError = await validateSequentialServiceTransition(
      {
        id: existingTask.service.id,
        name: existingTask.service.name,
        isSequential: existingTask.service.isSequential,
        workflowGroup: existingTask.service.workflowGroup,
        stepOrder: existingTask.service.stepOrder,
      },
      newService
    )

    if (sequenceError) {
      return NextResponse.json({ error: sequenceError }, { status: 400 })
    }

    const wasCompleted = isCompletedStatusName(existingTask.status?.name)
    const isNowCompleted = isCompletedStatusName(newStatus.name)

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        customerId,
        propertyId,
        serviceId,
        statusId,
        completedAt: isNowCompleted ? existingTask.completedAt || new Date() : null,
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

    let autoCreatedNextTaskId: string | null = null
    if (!wasCompleted && isNowCompleted) {
      const nextService = await getNextSequentialService(task.service)
      if (nextService) {
        const existingNextTask = await prisma.task.findFirst({
          where: {
            customerId: task.customerId,
            propertyId: task.propertyId,
            serviceId: nextService.id,
            NOT: {
              status: {
                name: { equals: 'Completed', mode: 'insensitive' },
              },
            },
          },
          select: { id: true },
        })

        if (!existingNextTask) {
          const inProgressStatus = await getDefaultInProgressStatusId()
          if (inProgressStatus) {
            const nextTask = await prisma.task.create({
              data: {
                customerId: task.customerId,
                propertyId: task.propertyId,
                serviceId: nextService.id,
                statusId: inProgressStatus.id,
                notes: null,
                scheduledFor: null,
                completedAt: null,
              },
              select: { id: true },
            })

            autoCreatedNextTaskId = nextTask.id
            console.log(
              `✅ Auto-created next sequential task (${nextService.name}, step ${nextService.stepOrder}) for task ${task.id}`
            )

            if (inProgressStatus.notifyClient) {
              const notificationPromises: Promise<unknown>[] = []
              const customerEmail = task.customer?.email
              const customerPhone = formatPhone(task.customer?.phone)

              if (customerEmail) {
                notificationPromises.push(
                  sendTaskUpdateEmail({
                    to: customerEmail,
                    subject: `Service Update: ${nextService.name}`,
                    customerName: task.customer.fullName,
                    service: {
                      name: nextService.name,
                      description: nextService.description || null,
                    },
                    property: `${task.property.address}, ${task.property.city}, ${task.property.state} ${task.property.zip}`,
                    status: inProgressStatus.name,
                    notes: null,
                    images: [],
                  })
                )
              }

              if (customerPhone) {
                const smsText = buildTaskSMS(
                  task.customer.fullName,
                  nextService.name,
                  nextService.description || null,
                  nextService.clientMessage || null,
                  null
                )
                notificationPromises.push(sendSMS(customerPhone, smsText))
              }

              if (notificationPromises.length > 0) {
                await Promise.allSettled(notificationPromises)
              }
            }
          } else {
            console.warn('⚠ Could not auto-create next sequential step: no In Progress/Open status found')
          }
        }
      }
    }

    // Upload images
    const uploadedImages: string[] = []
    if (files?.length > 0) {
      for (const file of files) {
        if (file.size > 0) {
          try {
            const fileUrl = await uploadFile(file, taskId)
            await prisma.taskMedia.create({
              data: { url: fileUrl, taskId },
            })
            uploadedImages.push(fileUrl)
          } catch (err) {
            console.error("⚠ Failed uploading a file:", err)
          }
        }
      }
    }

    // Notifications
    if (newStatus?.notifyClient) {
      const notificationPromises: Promise<unknown>[] = []

      // EMAIL
      if (existingTask.customer.email) {
        notificationPromises.push(
          sendTaskUpdateEmail({
            to: existingTask.customer.email,
            subject: `Service Update: ${task.service.name}`,
            customerName: existingTask.customer.fullName,
            service: {
              name: task.service.name,
              description: task.service.description || null,
            },
            property: `${task.property.address}, ${task.property.city}, ${task.property.state} ${task.property.zip}`,
            status: newStatus.name,
            notes: task.notes,
            images: uploadedImages,
          })
        )
      }

      // SMS (MISMO NIVEL DE DETALLE QUE CREACIÓN)
      if (existingTask.customer.phone) {
        const smsText = buildTaskSMS(
          existingTask.customer.fullName,
          task.service.name,
          task.service.description || null,
          task.service.clientMessage || null,
          task.notes
        )

        notificationPromises.push(sendSMS(existingTask.customer.phone, smsText))
      }

      if (notificationPromises.length > 0) {
        await Promise.allSettled(notificationPromises)
        console.log("📧 All notifications processed")
      }
    }

    console.log("✅ Task updated + notifications triggered")
    return NextResponse.json({
      ...task,
      autoCreatedNextTaskId,
    })
  } catch (error) {
    console.error("❌ Error updating task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(prisma)
    const url = new URL(request.url)
    const pathSegments = url.pathname.split("/")
    const taskId = pathSegments[pathSegments.length - 1]

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { service: { select: { name: true, workflowGroup: true } } },
    })
    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    if (sessionUser?.accessScope === "PERMITS_ONLY" && !isPermitsServiceLike(existingTask.service)) {
      return NextResponse.json({ error: "Your account can only delete permit-related tasks." }, { status: 403 })
    }

    await prisma.task.delete({ where: { id: taskId } })
    return NextResponse.json({ message: "Task deleted successfully" })
  } catch (error) {
    console.error("❌ Error deleting task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
