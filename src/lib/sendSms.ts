// kline-task-manager/src/lib/sendSms.ts
// kline-task-manager/src/lib/sendSms.ts
import twilio from 'twilio'
import { formatPhone } from './formatPhone'

const accountSid = process.env.TWILIO_ACCOUNT_SID || ''
const authToken = process.env.TWILIO_AUTH_TOKEN || ''

// Recomendado: Messaging Service (MGxxxx)
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

// Alternativa: número Twilio +1...
const fromNumber = process.env.TWILIO_PHONE_NUMBER

const client = twilio(accountSid, authToken)

export function buildTaskSMS(
  customerName: string,
  serviceName: string,
  serviceDescription: string | null,
  propertyAddress: string,
  propertyCity: string,
  status: string
) {
  return `
Hi ${customerName},

${serviceName}${serviceDescription ? ` - ${serviceDescription}` : ''} at ${propertyAddress}, ${propertyCity}

Status: ${status}

Thank you for choosing Kline Bros.
Call us at 609-494-5838 for any questions.
  `.trim()
}

export async function sendSMS(to: string, message: string) {
  const phone = formatPhone(to)

  console.log('📨 Preparing SMS...')
  console.log('➡️ To:', phone)
  console.log('✉️ Text:', message)
  console.log('📤 Using:', messagingServiceSid ? 'MessagingServiceSid' : 'FromNumber', {
    messagingServiceSid: messagingServiceSid ? '✅ SET' : '❌ MISSING',
    fromNumber: fromNumber ? '✅ SET' : '❌ MISSING',
  })

  if (!phone) {
    console.error('❌ Invalid phone number.')
    return { success: false, error: 'Invalid phone number' }
  }

  if (!accountSid || !authToken) {
    console.error('❌ Missing Twilio credentials.')
    return { success: false, error: 'Missing Twilio credentials' }
  }

  if (!messagingServiceSid && !fromNumber) {
    console.error('❌ Missing TWILIO_MESSAGING_SERVICE_SID and TWILIO_PHONE_NUMBER.')
    return { success: false, error: 'Missing SMS sender configuration' }
  }

  try {
    const payload: any = {
      body: message,
      to: phone,
    }

    if (messagingServiceSid) {
      payload.messagingServiceSid = messagingServiceSid
    } else {
      payload.from = fromNumber
    }

    const result = await client.messages.create(payload)

    console.log('✅ SMS sent:', result.sid)
    return { success: true, sid: result.sid }
  } catch (error: any) {
    console.error('❌ SMS failed:', error)
    return { success: false, error: error?.message || 'SMS failed' }
  }
}
