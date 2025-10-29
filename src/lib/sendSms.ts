import twilio from 'twilio'
import { formatPhone } from './formatPhone'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const fromNumber = process.env.TWILIO_PHONE_NUMBER!

const client = twilio(accountSid, authToken)

// ✅ Plantilla genérica por ahora
export function defaultTaskMessage(service: string, status: string) {
  return `
Kline Service Update:
${service}
Status: ${status}

Questions? Call 609-494-5838.
Thank you!
Kline Bros. Landscaping & Pool Co.
  `.trim()
}

// ✅ Función universal para enviar SMS
export async function sendSMS(to: string, message: string) {
  const phone = formatPhone(to)

  console.log("📨 Preparing SMS...")
  console.log("➡️ To:", phone)
  console.log("📤 From:", fromNumber)
  console.log("✉️ Text:", message)

  if (!phone) {
    console.error("❌ Phone number missing or invalid.")
    return { success: false, error: "Invalid phone number" }
  }

  if (!fromNumber) {
    console.error("❌ TWILIO_PHONE_NUMBER missing in environment.")
    return { success: false, error: "No Twilio number configured" }
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: phone,
    })

    console.log("✅ SMS sent successfully:", result.sid)
    return { success: true, sid: result.sid }

  } catch (error: any) {
    console.error("❌ Error sending SMS:")
    console.error("🧾 Code:", error.code)
    console.error("📌 Message:", error.message)
    console.error("🔍 More:", error.moreInfo || "N/A")

    return { success: false, error: error.message }
  }
}