export function parseDateOnly(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function startOfDay(date = new Date()): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function endOfDay(date = new Date()): Date {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
