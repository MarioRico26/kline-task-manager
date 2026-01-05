// kline-task-manager/src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { uploadFile } from "@/lib/upload"
import { sendTaskUpdateEmail } from "@/lib/email"
import { sendSMS, buildTaskSMS } from "@/lib/sendSms"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const customerId = formData.get("customerId") as string
    const propertyId = formData.get("propertyId") as string
    const serviceId = formData.get("serviceId") as string
    const statusId = formData.get("statusId") as string
    const notes = formData.get("notes") as string
    const scheduledFor = formData.get("scheduledFor") as string
    const files = formData.getAll("files") as File[]

    if (!customerId || !propertyId || !serviceId || !statusId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const status = await prisma.taskStatus.findUnique({ where: { id: statusId } })

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
        media: true,
      },
    })

    // Upload images
    const uploadedImages: string[] = []
    if (files?.length > 0) {
      for (const file of files) {
        if (file.size > 0) {
          try {
            const fileUrl = await uploadFile(file, task.id)
            await prisma.taskMedia.create({
              data: { url: fileUrl, taskId: task.id },
            })
            uploadedImages.push(fileUrl)
          } catch (err) {
            console.error("⚠ Failed uploading a file:", err)
          }
        }
      }
    }

    // Notifications on create (si el status tiene notifyClient)
    if (status?.notifyClient) {
      const notificationPromises: Promise<any>[] = []

      // EMAIL
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
            status: status.name,
            scheduledFor: task.scheduledFor?.toISOString() || null,
            notes: task.notes,
            images: uploadedImages,
          })
        )
      }

      // SMS (MISMO TEMPLATE)
      if (task.customer.phone) {
        const smsText = buildTaskSMS(
          task.customer.fullName,
          task.service.name,
          task.service.description || null,
          task.property.address,
          task.property.city,
          status.name
        )
        notificationPromises.push(sendSMS(task.customer.phone, smsText))
      }

      if (notificationPromises.length > 0) {
        await Promise.allSettled(notificationPromises)
        console.log("📧 All notifications processed")
      }
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error("❌ Error creating task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      include: { customer: true, property: true, service: true, status: true, media: true },
    })
    return NextResponse.json(tasks)
  } catch (error) {
    console.error("❌ Error fetching tasks:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
