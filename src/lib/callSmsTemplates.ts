const CALL_SMS_NO_REPLY_NOTICE = 'Please do not reply to this message.'

export const callSmsTemplates = [
  {
    value: 'RECEIVED_MESSAGE',
    label: 'Received your message',
    text: 'Hello, we received your message and will follow up shortly. Thank you, Kline Brothers.',
  },
  {
    value: 'TRIED_CALLING_BACK',
    label: 'We tried calling you back',
    text: 'Hello, we tried calling you back. Please call our office with the best time to reach you. Thank you, Kline Brothers.',
  },
  {
    value: 'ROUTED_TO_TEAM',
    label: 'Your message has been routed',
    text: 'Hello, your message has been routed to the appropriate team member and someone will follow up soon. Thank you, Kline Brothers.',
  },
] as const

export type CallSmsTemplateValue = (typeof callSmsTemplates)[number]['value']

export function buildCallSmsMessage(templateValue: string, additionalNote: string) {
  const template = callSmsTemplates.find((item) => item.value === templateValue)
  const cleanedNote = additionalNote.trim().replace(/\s+/g, ' ')

  if (!template && !cleanedNote) {
    return ''
  }

  if (!template) {
    return `${cleanedNote} ${CALL_SMS_NO_REPLY_NOTICE}`.trim()
  }

  if (!cleanedNote) {
    return `${template.text} ${CALL_SMS_NO_REPLY_NOTICE}`.trim()
  }

  return `${template.text} ${cleanedNote} ${CALL_SMS_NO_REPLY_NOTICE}`.trim()
}
