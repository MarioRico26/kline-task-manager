//kline-task-manager/src/lib/formatPhone.ts:
export function formatPhone(phone: string | null | undefined) {
  if (!phone) return null

  const digits = phone.replace(/\D/g, '')

  if (digits.length === 10) {
    return `+1${digits}`
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  return null
}