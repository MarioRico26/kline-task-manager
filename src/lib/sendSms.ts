// kline-task-manager/src/lib/sendSms.ts
import twilio from 'twilio'
import { formatPhone } from './formatPhone'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const fromNumber = process.env.TWILIO_PHONE_NUMBER!

const client = twilio(accountSid, authToken)

// ✅ Clean professional SMS template
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

${serviceName}${
    serviceDescription ? ` - ${serviceDescription}` : ''
  } at ${propertyAddress}, ${propertyCity}

Status: ${status}

Thank you for choosing Kline Bros.
Call us at 609-494-5838 for any questions.
  `.trim()
}

// ✅ SMS Sender
export async function sendSMS(to: string, message: string) {
  const phone = formatPhone(to)

  console.log("📨 Preparing SMS...")
  console.log("➡️ To:", phone)
  console.log("📤 From:", fromNumber)
  console.log("✉️ Text:", message)

  if (!phone) {
    console.error("❌ Invalid phone number.")
    return { success: false, error: "Invalid phone number" }
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: phone,
    })

    console.log("✅ SMS sent:", result.sid)
    return { success: true, sid: result.sid }

  } catch (error: any) {
    console.error("❌ SMS failed:", error)
    return { success: false, error: error.message }
  }
}