import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildCallSmsMessage, callSmsTemplates } from '@/lib/callSmsTemplates'
import { formatPhone } from '@/lib/formatPhone'
import { getSessionUser } from '@/lib/sessionUser'
import { sendSMS } from '@/lib/sendSms'

const MAX_BATCH_RECIPIENTS = 100

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!sessionUser.canSendCallSms) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = (await request.json()) as { customerIds?: unknown; template?: unknown; additionalNote?: unknown }
    const customerIds = Array.isArray(body.customerIds)
      ? [...new Set(body.customerIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))]
      : []

    if (customerIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one customer before sending.' }, { status: 400 })
    }
    if (customerIds.length > MAX_BATCH_RECIPIENTS) {
      return NextResponse.json({ error: `Batch SMS is limited to ${MAX_BATCH_RECIPIENTS} customers at a time.` }, { status: 400 })
    }

    const template = typeof body.template === 'string' ? body.template : ''
    const additionalNote = typeof body.additionalNote === 'string' ? body.additionalNote : ''
    const message = buildCallSmsMessage(template, additionalNote)
    if (!message.trim()) {
      return NextResponse.json({ error: 'Choose a template or enter a custom message.' }, { status: 400 })
    }
    if (message.length > 320) {
      return NextResponse.json({ error: 'SMS message is too long. Keep it under 320 characters.' }, { status: 400 })
    }

    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, fullName: true, phone: true },
    })
    const selectedTemplate = callSmsTemplates.find((item) => item.value === template)
    const results: { customerId: string; customerName: string; status: 'sent' | 'skipped' | 'failed'; detail: string }[] = []

    // Send in sequence so a large confirmation does not spike the messaging provider.
    for (const customer of customers) {
      const phoneNumber = formatPhone(customer.phone)
      if (!phoneNumber) {
        results.push({ customerId: customer.id, customerName: customer.fullName, status: 'skipped', detail: 'No valid phone number' })
        continue
      }

      const smsResult = await sendSMS(phoneNumber, message)
      if (!smsResult.success) {
        results.push({ customerId: customer.id, customerName: customer.fullName, status: 'failed', detail: smsResult.error || 'Unable to send SMS' })
        continue
      }

      await prisma.auditLog.create({
        data: {
          userId: sessionUser.id,
          action: 'SEND_CUSTOMER_SMS',
          description: `Batch SMS sent to customer ${customer.fullName}`,
          entity: 'CUSTOMER',
          entityId: customer.id,
          details: {
            phoneNumber,
            template: selectedTemplate?.label || 'Manual message',
            additionalNote: additionalNote.trim() || null,
            message,
            sid: smsResult.sid || null,
            batch: true,
          },
        },
      })
      results.push({ customerId: customer.id, customerName: customer.fullName, status: 'sent', detail: phoneNumber })
    }

    return NextResponse.json({
      success: true,
      summary: {
        selected: customerIds.length,
        found: customers.length,
        sent: results.filter((result) => result.status === 'sent').length,
        skipped: results.filter((result) => result.status === 'skipped').length,
        failed: results.filter((result) => result.status === 'failed').length,
      },
      results,
    })
  } catch (error) {
    console.error('Error sending batch customer SMS:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
