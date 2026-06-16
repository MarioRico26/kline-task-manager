import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { buildCallSmsMessage, callSmsTemplates } from '@/lib/callSmsTemplates'
import { formatPhone } from '@/lib/formatPhone'
import { sendSMS } from '@/lib/sendSms'
import { getSessionUser } from '@/lib/sessionUser'

function canAccessCallsInbox(sessionUser: Awaited<ReturnType<typeof getSessionUser>>) {
  return sessionUser && sessionUser.canAccessCallsInbox && sessionUser.accessScope !== 'PERMITS_ONLY'
}

function isCallsInboxTableMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!canAccessCallsInbox(sessionUser) || !sessionUser.canSendCallSms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = (await request.json()) as {
      phoneNumber?: string
      template?: string
      additionalNote?: string
    }

    const record = await prisma.callRecord.findUnique({
      where: { id },
      select: {
        id: true,
        phoneNumber: true,
        callerNameRaw: true,
      },
    })

    if (!record) {
      return NextResponse.json({ error: 'Call record not found' }, { status: 404 })
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

    const rawPhoneNumber = (body.phoneNumber || record.phoneNumber || '').trim()
    const formattedPhoneNumber = formatPhone(rawPhoneNumber)

    if (!formattedPhoneNumber) {
      return NextResponse.json({ error: 'A valid phone number is required before sending SMS.' }, { status: 400 })
    }

    const smsResult = await sendSMS(formattedPhoneNumber, finalMessage)
    if (!smsResult.success) {
      return NextResponse.json({ error: smsResult.error || 'Unable to send SMS' }, { status: 500 })
    }

    const selectedTemplate = callSmsTemplates.find((item) => item.value === templateValue)
    const activityNote = [
      `SMS sent to ${formattedPhoneNumber}.`,
      selectedTemplate ? `Template: ${selectedTemplate.label}.` : 'Template: Manual message.',
      additionalNote.trim() ? `Additional note: ${additionalNote.trim()}` : null,
      `Message: ${finalMessage}`,
      `Twilio SID: ${smsResult.sid}.`,
    ]
      .filter(Boolean)
      .join('\n')

    await prisma.callActivity.create({
      data: {
        callRecordId: record.id,
        actionType: 'NOTE_ADDED',
        note: activityNote,
        fromValue: selectedTemplate?.label || null,
        toValue: smsResult.sid || null,
        createdByUserId: sessionUser.id,
      },
    })

    return NextResponse.json({
      success: true,
      sid: smsResult.sid,
      message: finalMessage,
      phoneNumber: formattedPhoneNumber,
    })
  } catch (error) {
    if (isCallsInboxTableMissing(error)) {
      return NextResponse.json({ error: 'Calls Inbox schema has not been activated yet.' }, { status: 503 })
    }

    console.error('Error sending call SMS:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
