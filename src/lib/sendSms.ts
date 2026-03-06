// kline-task-manager/src/lib/sendSms.ts
import twilio from "twilio"
import { formatPhone } from "./formatPhone"

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const fromNumber = process.env.TWILIO_PHONE_NUMBER!

const client = twilio(accountSid, authToken)

// ✅ Clean "human-proof" SMS template (no address, no status)
export function buildTaskSMS(
  customerName: string,
  serviceName: string,
  serviceDescription: string | null,
  clientMessage: string | null = null,
  notes: string | null = null
) {
  const body =
    (clientMessage && clientMessage.trim()) ||
    (serviceDescription && serviceDescription.trim()) ||
    `Your ${serviceName} service update is available.`

  const cleanedNotes = (notes || '').trim().replace(/\s+/g, ' ')
  const noteText = cleanedNotes ? `\n\nNote: ${cleanedNotes.slice(0, 240)}` : ''

  return `
Hi ${customerName},

${body}${noteText}

Thank you for choosing Kline Bros.
Call us at 609-494-5838 for any questions.

This number is not monitored. Please do not reply to this message.
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown SMS error"
    console.error("❌ SMS failed:", error)
    return { success: false, error: message }
  }
}
