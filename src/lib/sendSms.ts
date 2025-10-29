//kline-task-manager/src/lib/sendSms.ts:
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const client = twilio(accountSid, authToken)

// phoneNumber debe ser formato +1XXXXXXXXXX
export async function sendSMS(to: string, message: string) {
  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
    })

    console.log("✅ SMS enviado:", result.sid)
    return { success: true }
  } catch (error) {
    console.error("❌ Error enviando SMS:", error)
    return { success: false, error }
  }
}