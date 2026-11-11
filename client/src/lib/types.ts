export type Role = 'ADMIN' | 'FACULTY'
export type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'TOURNAMENT'
export type StudentStatus = 'ACTIVE' | 'INACTIVE'
export type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
export type RiskLevel = 'Excellent' | 'Good' | 'At Risk' | 'Critical' | 'No Data'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  facultyId: string | null
}

export interface Batch {
  id: string
  code: string
  name: string
  level: Level
  days: string[]
  daysLabel: string
  startTime: string
  endTime: string
  durationMin: number
  isActive: boolean
  trainer: { id: string; name: string } | null
  studentCount: number
  sessionCount: number
}

export interface Faculty {
  id: string
  employeeId: string
  name: string
  email: string
  phone: string | null
  joinedAt: string
  isActive: boolean
  hasLogin: boolean
  loginEmail: string | null
  batchCount: number
  sessionCount: number
}

export interface Topic {
  id: string
  code: string
  name: string
  category: string
  difficulty: Level
  description: string | null
  objectives: string | null
  estimatedMinutes: number | null
  parent: { id: string; name: string } | null
  sessionCount: number
  childCount: number
}

export interface Student {
  id: string
  studentCode: string
  name: string
  dob: string | null
  guardianName: string | null
  contact: string | null
  email: string | null
  level: Level
  joiningDate: string
  status: StudentStatus
  batches: { id: string; code: string; name: string; trainer?: { id: string; name: string } | null }[]
}

export interface StudentListItem extends Student {
  attendance: number | null
  risk: RiskLevel
  attended: number
  absent: number
  late: number
}

export interface StudentStats {
  id: string
  code: string
  name: string
  level: Level
  status: StudentStatus
  batches: string[]
  attendance: number | null
  risk: RiskLevel
  attended: number
  eligible: number
  denominator: number
  absent: number
  late: number
  excused: number
  unmarked: number
}

export interface AttendanceHistoryItem {
  id: string
  date: string
  sessionId: string
  batch: { id: string; code: string; name: string }
  topic: { id: string; name: string; category: string } | null
  trainer: { id: string; name: string }
  status: AttendanceStatus
  remarks: string | null
}

export interface StudentDetailResponse {
  student: Student
  stats: StudentStats | null
  batches: {
    id: string
    code: string
    name: string
    level: Level
    trainer: { id: string; name: string } | null
    assignedAt: string
    endedAt: string | null
  }[]
  history: AttendanceHistoryItem[]
}

export interface SessionSummary {
  id: string
  batchId: string
  trainerId: string
  topicId: string | null
  subtopicId: string | null
  date: string
  startTime: string
  endTime: string
  description: string | null
  objectives: string | null
  status: SessionStatus
  batch: { id: string; code: string; name: string }
  trainer: { id: string; name: string }
  topic: { id: string; name: string; category: string } | null
  subtopic: { id: string; name: string } | null
  attendanceCount: number
}

export interface SessionDetailResponse {
  session: SessionSummary
  roster: {
    student: { id: string; studentCode: string; name: string; level: Level; status: StudentStatus }
    attendance: {
      id: string
      status: AttendanceStatus
      remarks: string | null
      markedAt: string
    } | null
  }[]
  policy: {
    id?: string
    lateCountsAsPresent: boolean
    excusedExcluded: boolean
  } | null
}

export interface AttendanceAccumulator {
  attendance: number | null
  attended: number
  eligible: number
  denominator: number
  absent: number
  late: number
  excused: number
  sessions: number
  students: number
}

export interface BatchStats extends AttendanceAccumulator {
  id: string
  code: string
  name: string
}

export interface TopicStats extends AttendanceAccumulator {
  id: string
  name: string
  category: string
}

export interface MonthlyStats extends AttendanceAccumulator {
  key: string
  label: string
}

export interface FacultyStats extends AttendanceAccumulator {
  id: string
  name: string
}

export interface AnalyticsData {
  generatedAt: string
  filters: {
    from: string | null
    to: string | null
    topicId: string | null
    studentId: string | null
  }
  policy: { lateCountsAsPresent: boolean; excusedExcluded: boolean }
  totals: {
    students: number
    sessions: number
    attendance: number | null
    attended: number
    eligible: number
    absent: number
    late: number
    excused: number
    lowAttendance: number
  }
  risk: {
    excellent: number
    good: number
    atRisk: number
    critical: number
    noData: number
  }
  studentStats: StudentStats[]
  batchStats: BatchStats[]
  topicStats: TopicStats[]
  monthly: MonthlyStats[]
  facultyStats: FacultyStats[]
  lowAttendance: StudentStats[]
  topAbsentees: StudentStats[]
  lateArrivals: StudentStats[]
}

export interface DashboardData {
  stats: {
    totalStudents: number
    totalFaculty: number
    activeBatches: number
    classesConducted: number
    overallAttendance: number | null
    lowAttendance: number
    sessionsRecorded: number
    todayClasses: number
  }
  risk: {
    excellent: number
    good: number
    atRisk: number
    critical: number
    noData: number
  }
  todaySessions: {
    id: string
    date: string
    startTime: string
    endTime: string
    status: SessionStatus
    batch: { id: string; code: string; name: string }
    trainer: { id: string; name: string }
    topic: { id: string; name: string; category: string } | null
    attendanceCount: number
  }[]
  recentActivity: {
    id: string
    action: string
    entity: string
    entityId: string | null
    actor: { id: string; name: string } | null
    createdAt: string
    detail: unknown
  }[]
  batchAttendance: BatchStats[]
}

export interface StudentFormValues {
  name: string
  dob: string
  guardianName: string
  contact: string
  email: string
  level: Level
  joiningDate: string
  status: StudentStatus
  batchId: string
}

export type AttendanceImportAction = 'create' | 'reuse' | 'skip' | 'blocked'

export interface AttendanceImportIssue {
  severity: 'error' | 'warning'
  rowNumber?: number
  column?: string
  studentCode?: string
  batchCode?: string
  message: string
}

export interface AttendanceImportSession {
  date: string
  batchCode: string
  batchName: string
  topicCode: string | null
  topicName: string | null
  trainerName: string | null
  startTime: string
  endTime: string
  action: AttendanceImportAction
  newRecords: number
  skippedRecords: number
}

export interface AttendanceImportSummary {
  totalRows: number
  totalMarks: number
  validMarks: number
  newRecords: number
  skippedRecords: number
  sessionsToCreate: number
  sessionsToReuse: number
  sessionsSkipped: number
  errors: number
  warnings: number
}

export interface AttendanceImportPreview {
  summary: AttendanceImportSummary
  sessions: AttendanceImportSession[]
  issues: AttendanceImportIssue[]
}

export interface AttendanceImportResult {
  imported: number
  skipped: number
  createdSessions: number
  reusedSessions: number
  skippedSessions: number
  totalMarks: number
}
