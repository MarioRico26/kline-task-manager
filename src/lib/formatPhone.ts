// kline-task-manager/src/lib/formatPhone.ts
export function formatPhone(phone: string | null | undefined) {
  if (!phone) return null

  const digits = phone.replace(/\D/g, '')

  // US 10 digits
  if (digits.length === 10) return `+1${digits}`

  // US 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`

  // Already E.164-ish but with +?
  if (phone.startsWith('+') && digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`
  }

  return null
}
