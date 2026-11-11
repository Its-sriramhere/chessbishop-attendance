export function formatDate(value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', options ?? { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDay(value: string | Date | null | undefined): string {
  return formatDate(value, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  const [hourString, minute] = value.split(':')
  const hour = Number(hourString)
  if (Number.isNaN(hour)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${minute} ${suffix}`
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)}%`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function todayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDaysISO(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function actionLabel(action: string): string {
  return titleCase(action.replace(/_/g, ' '))
}
