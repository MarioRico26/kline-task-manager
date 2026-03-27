import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { sendTaskUpdateEmail } from "@/lib/email"
import { sendSMS, buildTaskSMS } from "@/lib/sendSms"
import { getSessionUser } from "@/lib/sessionUser"
import { isPermitsServiceLike } from "@/lib/userScope"
import { formatPhone } from "@/lib/formatPhone"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

function getEmailRecipients(primaryEmail: string | null | undefined, extraEmails: string[]) {
  const recipients = [primaryEmail || '', ...(extraEmails || [])]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
  return Array.from(new Set(recipients))
}

function getPhoneRecipients(primaryPhone: string | null | undefined, extraPhones: string[]) {
  const recipients = [primaryPhone || '', ...(extraPhones || [])]
    .map((phone) => formatPhone(phone))
    .filter(Boolean) as string[]
  return Array.from(new Set(recipients))
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(prisma)
    const url = new URL(request.url)
    const pathSegments = url.pathname.split("/")
    const taskId = pathSegments[pathSegments.length - 2]

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        customer: true,
        property: true,
        service: true,
        status: true,
        media: true,
      },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    if (sessionUser?.accessScope === "PERMITS_ONLY" && !isPermitsServiceLike(task.service)) {
      return NextResponse.json({ error: "Your account can only notify permit-related tasks." }, { status: 403 })
    }

    const emailRecipients = getEmailRecipients(task.customer.email, task.notificationEmails || [])
    const phoneRecipients = getPhoneRecipients(task.customer.phone, task.notificationPhones || [])

    if (!emailRecipients.length && !phoneRecipients.length) {
      return NextResponse.json({ error: "This task has no email or phone recipients configured." }, { status: 400 })
    }

    const notificationPromises: Promise<unknown>[] = []
    const propertyLabel = `${task.property.address}, ${task.property.city}, ${task.property.state} ${task.property.zip}`
    const imageUrls = task.media.map((media) => media.url)

    for (const email of emailRecipients) {
      notificationPromises.push(
        sendTaskUpdateEmail({
          to: email,
          subject: `Service Update: ${task.service.name}`,
          customerName: task.customer.fullName,
          service: {
            name: task.service.name,
            description: task.service.description || null,
          },
          property: propertyLabel,
          status: task.status.name,
          notes: task.notes,
          images: imageUrls,
        })
      )
    }

    const smsText = buildTaskSMS(
      task.customer.fullName,
      task.service.name,
      task.service.description || null,
      task.service.clientMessage || null,
      task.notes
    )

    for (const phone of phoneRecipients) {
      notificationPromises.push(sendSMS(phone, smsText))
    }

    await Promise.allSettled(notificationPromises)

    return NextResponse.json({
      ok: true,
      emailRecipients: emailRecipients.length,
      phoneRecipients: phoneRecipients.length,
    })
  } catch (error) {
    console.error("❌ Error resending task notification:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
