// kline-task-manager/src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { uploadFile } from "@/lib/upload"
import { sendTaskUpdateEmail } from "@/lib/email"
import { sendSMS, buildTaskSMS } from "@/lib/sendSms"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

function validateSequentialTransition(
  currentStatus: {
    id: string
    name: string
    isSequential: boolean
    workflowGroup: string | null
    stepOrder: number | null
  },
  targetStatus: {
    id: string
    name: string
    isSequential: boolean
    workflowGroup: string | null
    stepOrder: number | null
  }
): string | null {
  if (!targetStatus.isSequential) return null
  if (!targetStatus.workflowGroup || targetStatus.stepOrder === null) {
    return `Status "${targetStatus.name}" is misconfigured. Missing workflowGroup or stepOrder.`
  }

  if (currentStatus.id === targetStatus.id) return null

  if (
    currentStatus.isSequential &&
    currentStatus.workflowGroup === targetStatus.workflowGroup &&
    currentStatus.stepOrder !== null
  ) {
    if (targetStatus.stepOrder !== currentStatus.stepOrder + 1) {
      return `Invalid sequence transition. You can only move from step ${currentStatus.stepOrder} to step ${currentStatus.stepOrder + 1}.`
    }
    return null
  }

  if (targetStatus.stepOrder !== 1) {
    return `Workflow "${targetStatus.workflowGroup}" must start at step 1.`
  }

  return null
}

export async function PUT(request: NextRequest) {
  try {
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

    const sequenceError = validateSequentialTransition(
      {
        id: existingTask.status.id,
        name: existingTask.status.name,
        isSequential: existingTask.status.isSequential,
        workflowGroup: existingTask.status.workflowGroup,
        stepOrder: existingTask.status.stepOrder,
      },
      newStatus
    )

    if (sequenceError) {
      return NextResponse.json({ error: sequenceError }, { status: 400 })
    }

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
        media: true,
      },
    })

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
            scheduledFor: task.scheduledFor?.toISOString() || null,
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
          newStatus.clientMessage || null
        )

        notificationPromises.push(sendSMS(existingTask.customer.phone, smsText))
      }

      if (notificationPromises.length > 0) {
        await Promise.allSettled(notificationPromises)
        console.log("📧 All notifications processed")
      }
    }

    console.log("✅ Task updated + notifications triggered")
    return NextResponse.json(task)
  } catch (error) {
    console.error("❌ Error updating task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const pathSegments = url.pathname.split("/")
    const taskId = pathSegments[pathSegments.length - 1]

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    const existingTask = await prisma.task.findUnique({ where: { id: taskId } })
    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    await prisma.task.delete({ where: { id: taskId } })
    return NextResponse.json({ message: "Task deleted successfully" })
  } catch (error) {
    console.error("❌ Error deleting task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
