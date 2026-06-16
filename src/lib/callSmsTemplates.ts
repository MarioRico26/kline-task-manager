export const callSmsTemplates = [
  {
    value: 'RECEIVED_MESSAGE',
    label: 'Received your message',
    text: 'Hello, we received your message and will follow up shortly.',
  },
  {
    value: 'TRIED_CALLING_BACK',
    label: 'We tried calling you back',
    text: 'Hello, we tried calling you back. Please reply with the best time to reach you.',
  },
  {
    value: 'ROUTED_TO_TEAM',
    label: 'Your message has been routed',
    text: 'Hello, your message has been routed to the appropriate team member and someone will follow up soon.',
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
    return cleanedNote
  }

  if (!cleanedNote) {
    return template.text
  }

  return `${template.text} ${cleanedNote}`.trim()
}
