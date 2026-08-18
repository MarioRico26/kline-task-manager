import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildCallSmsMessage, callSmsTemplates } from '@/lib/callSmsTemplates'
import { formatPhone } from '@/lib/formatPhone'
import { sendSMS } from '@/lib/sendSms'
import { getSessionUser } from '@/lib/sessionUser'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!sessionUser.canSendCallSms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = (await request.json()) as {
      phoneNumber?: string
      template?: string
      additionalNote?: string
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        phone: true,
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const templateValue = typeof body.template === 'string' ? body.template : ''
    const additionalNote = typeof body.additionalNote === 'string' ? body.additionalNote : ''
    const finalMessage = buildCallSmsMessage(templateValue, additionalNote)

    if (!finalMessage.trim()) {
      return NextResponse.json({ error: 'Choose a template or enter a custom message.' }, { status: 400 })
    }

    if (finalMessage.length > 320) {
      return NextResponse.json({ error: 'SMS message is too long. Keep it under 320 characters.' }, { status: 400 })
    }

    const rawPhoneNumber = (body.phoneNumber || customer.phone || '').trim()
    const formattedPhoneNumber = formatPhone(rawPhoneNumber)

    if (!formattedPhoneNumber) {
      return NextResponse.json({ error: 'A valid phone number is required before sending SMS.' }, { status: 400 })
    }

    const smsResult = await sendSMS(formattedPhoneNumber, finalMessage)
    if (!smsResult.success) {
      return NextResponse.json({ error: smsResult.error || 'Unable to send SMS' }, { status: 500 })
    }

    const selectedTemplate = callSmsTemplates.find((item) => item.value === templateValue)

    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: 'SEND_CUSTOMER_SMS',
        description: `SMS sent to customer ${customer.fullName}`,
        entity: 'CUSTOMER',
        entityId: customer.id,
        details: {
          phoneNumber: formattedPhoneNumber,
          template: selectedTemplate?.label || 'Manual message',
          additionalNote: additionalNote.trim() || null,
          message: finalMessage,
          sid: smsResult.sid || null,
        },
      },
    })

    return NextResponse.json({
      success: true,
      sid: smsResult.sid,
      message: finalMessage,
      phoneNumber: formattedPhoneNumber,
    })
  } catch (error) {
    console.error('Error sending customer SMS:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
