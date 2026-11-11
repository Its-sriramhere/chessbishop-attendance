import type { AttendanceStatus, Level, RiskLevel, SessionStatus } from './types'

export function riskBadgeClass(risk: RiskLevel): string {
  switch (risk) {
    case 'Excellent':
      return 'bg-emerald-50 text-emerald-700'
    case 'Good':
      return 'bg-sky-50 text-sky-700'
    case 'At Risk':
      return 'bg-amber-50 text-amber-700'
    case 'Critical':
      return 'bg-red-50 text-red-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export function riskDotClass(risk: RiskLevel): string {
  switch (risk) {
    case 'Excellent':
      return 'bg-emerald-500'
    case 'Good':
      return 'bg-sky-500'
    case 'At Risk':
      return 'bg-amber-500'
    case 'Critical':
      return 'bg-red-500'
    default:
      return 'bg-slate-400'
  }
}

export function attendanceBadgeClass(status: AttendanceStatus): string {
  switch (status) {
    case 'PRESENT':
      return 'bg-emerald-50 text-emerald-700'
    case 'ABSENT':
      return 'bg-red-50 text-red-700'
    case 'LATE':
      return 'bg-amber-50 text-amber-700'
    case 'EXCUSED':
      return 'bg-violet-50 text-violet-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export function sessionBadgeClass(status: SessionStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700'
    case 'SCHEDULED':
      return 'bg-sky-50 text-sky-700'
    case 'CANCELLED':
      return 'bg-red-50 text-red-700'
    case 'RESCHEDULED':
      return 'bg-amber-50 text-amber-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export function levelLabel(level: Level): string {
  switch (level) {
    case 'BEGINNER':
      return 'Beginner'
    case 'INTERMEDIATE':
      return 'Intermediate'
    case 'ADVANCED':
      return 'Advanced'
    case 'TOURNAMENT':
      return 'Tournament'
    default:
      return level
  }
}

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function attendanceTone(value: number | null): 'emerald' | 'sky' | 'amber' | 'red' | 'slate' {
  if (value === null) return 'slate'
  if (value >= 90) return 'emerald'
  if (value >= 75) return 'sky'
  if (value >= 50) return 'amber'
  return 'red'
}

export const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
  { value: 'TOURNAMENT', label: 'Tournament' },
]

export const DAY_OPTIONS = [
  { value: 'MONDAY', label: 'Mon' },
  { value: 'TUESDAY', label: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wed' },
  { value: 'THURSDAY', label: 'Thu' },
  { value: 'FRIDAY', label: 'Fri' },
  { value: 'SATURDAY', label: 'Sat' },
  { value: 'SUNDAY', label: 'Sun' },
]

export const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' },
  { value: 'EXCUSED', label: 'Excused' },
]

export const SESSION_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'RESCHEDULED', label: 'Rescheduled' },
]
