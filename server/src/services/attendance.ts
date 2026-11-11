import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

export type RiskLevel = 'Excellent' | 'Good' | 'At Risk' | 'Critical' | 'No Data'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function riskFor(percent: number | null): RiskLevel {
  if (percent === null) return 'No Data'
  if (percent >= 90) return 'Excellent'
  if (percent >= 75) return 'Good'
  if (percent >= 50) return 'At Risk'
  return 'Critical'
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function percent(attended: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return round1((attended / denominator) * 100)
}

export interface ReportOptions {
  batchIds?: string[] | null
  from?: Date
  to?: Date
  topicId?: string
  studentId?: string
}

interface SessionWithRelations {
  id: string
  batchId: string
  trainerId: string
  topicId: string | null
  date: Date
  batch: { id: string; code: string; name: string }
  trainer: { id: string; name: string }
  topic: { id: string; name: string; category: string } | null
  attendance: { studentId: string; status: string }[]
}

interface Pair {
  studentId: string
  batchId: string
  batchCode: string
  batchName: string
  sessionId: string
  monthKey: string
  monthLabel: string
  topicId: string
  topicName: string
  category: string
  trainerId: string
  trainerName: string
  status: string
  attended: number
  denominator: number
  absent: number
  late: number
  excused: number
}

interface Accumulator {
  attended: number
  denominator: number
  eligible: number
  absent: number
  late: number
  excused: number
  sessions: Set<string>
  students: Set<string>
}

function emptyAccumulator(): Accumulator {
  return {
    attended: 0,
    denominator: 0,
    eligible: 0,
    absent: 0,
    late: 0,
    excused: 0,
    sessions: new Set<string>(),
    students: new Set<string>(),
  }
}

function accumulate(acc: Accumulator, pair: Pair): void {
  acc.attended += pair.attended
  acc.denominator += pair.denominator
  acc.eligible += 1
  acc.absent += pair.absent
  acc.late += pair.late
  acc.excused += pair.excused
  acc.sessions.add(pair.sessionId)
  acc.students.add(pair.studentId)
}

function finaliseAccumulator(acc: Accumulator) {
  return {
    attendance: percent(acc.attended, acc.denominator),
    attended: acc.attended,
    eligible: acc.eligible,
    denominator: acc.denominator,
    absent: acc.absent,
    late: acc.late,
    excused: acc.excused,
    sessions: acc.sessions.size,
    students: acc.students.size,
  }
}

export async function buildAttendanceReport(options: ReportOptions = {}) {
  const settings =
    (await prisma.academySetting.findUnique({ where: { id: 'singleton' } })) ?? {
      lateCountsAsPresent: true,
      excusedExcluded: true,
    }

  const { lateCountsAsPresent, excusedExcluded } = settings
  const scope = options.batchIds === undefined ? null : options.batchIds

  const studentWhere: Prisma.StudentWhereInput = {}
  if (options.studentId) studentWhere.id = options.studentId
  if (scope) studentWhere.batches = { some: { batchId: { in: scope } } }

  const students = await prisma.student.findMany({
    where: studentWhere,
    include: {
      batches: { include: { batch: { select: { id: true, code: true, name: true } } } },
    },
    orderBy: { studentCode: 'asc' },
  })

  const allowedBatchIds = new Set<string>()
  for (const student of students) {
    for (const assignment of student.batches) {
      if (scope && !scope.includes(assignment.batchId)) continue
      allowedBatchIds.add(assignment.batchId)
    }
  }

  if (options.studentId) {
    const ownBatches = students.flatMap((s) => s.batches.map((b) => b.batchId))
    for (const batchId of ownBatches) allowedBatchIds.add(batchId)
  }

  const batchFilter = Array.from(allowedBatchIds)
  const sessionWhere: Prisma.ClassSessionWhereInput = { status: 'COMPLETED' }
  if (batchFilter.length > 0) {
    sessionWhere.batchId = { in: batchFilter }
  } else if (scope) {
    sessionWhere.batchId = { in: [] }
  }
  if (options.from || options.to) {
    sessionWhere.date = {
      ...(options.from ? { gte: options.from } : {}),
      ...(options.to ? { lte: options.to } : {}),
    }
  }
  if (options.topicId) sessionWhere.topicId = options.topicId

  const sessions = (await prisma.classSession.findMany({
    where: sessionWhere,
    include: {
      batch: { select: { id: true, code: true, name: true } },
      trainer: { select: { id: true, name: true } },
      topic: { select: { id: true, name: true, category: true } },
      attendance: { select: { studentId: true, status: true } },
    },
    orderBy: { date: 'asc' },
  })) as unknown as SessionWithRelations[]

  const sessionsByBatch = new Map<string, SessionWithRelations[]>()
  for (const session of sessions) {
    const list = sessionsByBatch.get(session.batchId) ?? []
    list.push(session)
    sessionsByBatch.set(session.batchId, list)
  }

  const pairs: Pair[] = []
  const studentStats: {
    id: string
    code: string
    name: string
    level: string
    status: string
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
  }[] = []

  for (const student of students) {
    const relevantAssignments = student.batches.filter(
      (assignment) => !scope || scope.includes(assignment.batchId),
    )

    let eligible = 0
    let attended = 0
    let absent = 0
    let late = 0
    let excused = 0
    let unmarked = 0

    for (const assignment of relevantAssignments) {
      const batchSessions = sessionsByBatch.get(assignment.batchId) ?? []
      for (const session of batchSessions) {
        if (session.date < assignment.assignedAt) continue
        if (assignment.endedAt && session.date > assignment.endedAt) continue

        const record = session.attendance.find((entry) => entry.studentId === student.id)
        if (!record) {
          unmarked += 1
          continue
        }

        eligible += 1
        const isExcused = record.status === 'EXCUSED'
        const isLate = record.status === 'LATE'
        const isAbsent = record.status === 'ABSENT'
        const isPresent = record.status === 'PRESENT'

        if (isPresent) attended += 1
        if (isLate && lateCountsAsPresent) attended += 1
        if (isAbsent) absent += 1
        if (isLate) late += 1
        if (isExcused) excused += 1

        const excludedFromDenominator = isExcused && excusedExcluded
        const denominator = excludedFromDenominator ? 0 : 1
        const attendedValue = isPresent || (isLate && lateCountsAsPresent) ? 1 : 0

        const monthKey = `${session.date.getUTCFullYear()}-${String(session.date.getUTCMonth() + 1).padStart(2, '0')}`

        pairs.push({
          studentId: student.id,
          batchId: assignment.batchId,
          batchCode: assignment.batch.code,
          batchName: assignment.batch.name,
          sessionId: session.id,
          monthKey,
          monthLabel: `${MONTHS[session.date.getUTCMonth()]} ${session.date.getUTCFullYear()}`,
          topicId: session.topic?.id ?? 'unassigned',
          topicName: session.topic?.name ?? 'Unassigned',
          category: session.topic?.category ?? 'General',
          trainerId: session.trainer.id,
          trainerName: session.trainer.name,
          status: record.status,
          attended: attendedValue,
          denominator,
          absent: isAbsent ? 1 : 0,
          late: isLate ? 1 : 0,
          excused: isExcused ? 1 : 0,
        })
      }
    }

    const denominator = eligible - (excusedExcluded ? excused : 0)
    const attendance = percent(attended, denominator)

    studentStats.push({
      id: student.id,
      code: student.studentCode,
      name: student.name,
      level: student.level,
      status: student.status,
      batches: relevantAssignments.map((assignment) => assignment.batch.code),
      attendance,
      risk: riskFor(attendance),
      attended,
      eligible,
      denominator,
      absent,
      late,
      excused,
      unmarked,
    })
  }

  const overallAcc = emptyAccumulator()
  const batchAccs = new Map<string, { code: string; name: string; acc: Accumulator }>()
  const topicAccs = new Map<string, { name: string; category: string; acc: Accumulator }>()
  const monthAccs = new Map<string, { label: string; acc: Accumulator }>()
  const facultyAccs = new Map<string, { name: string; acc: Accumulator }>()

  for (const pair of pairs) {
    accumulate(overallAcc, pair)

    const batchEntry = batchAccs.get(pair.batchId) ?? {
      code: pair.batchCode,
      name: pair.batchName,
      acc: emptyAccumulator(),
    }
    accumulate(batchEntry.acc, pair)
    batchAccs.set(pair.batchId, batchEntry)

    const topicEntry = topicAccs.get(pair.topicId) ?? {
      name: pair.topicName,
      category: pair.category,
      acc: emptyAccumulator(),
    }
    accumulate(topicEntry.acc, pair)
    topicAccs.set(pair.topicId, topicEntry)

    const monthEntry = monthAccs.get(pair.monthKey) ?? {
      label: pair.monthLabel,
      acc: emptyAccumulator(),
    }
    accumulate(monthEntry.acc, pair)
    monthAccs.set(pair.monthKey, monthEntry)

    const facultyEntry = facultyAccs.get(pair.trainerId) ?? {
      name: pair.trainerName,
      acc: emptyAccumulator(),
    }
    accumulate(facultyEntry.acc, pair)
    facultyAccs.set(pair.trainerId, facultyEntry)
  }

  const risk = { excellent: 0, good: 0, atRisk: 0, critical: 0, noData: 0 }
  for (const stats of studentStats) {
    if (stats.risk === 'Excellent') risk.excellent += 1
    else if (stats.risk === 'Good') risk.good += 1
    else if (stats.risk === 'At Risk') risk.atRisk += 1
    else if (stats.risk === 'Critical') risk.critical += 1
    else risk.noData += 1
  }

  const overall = finaliseAccumulator(overallAcc)

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      from: options.from?.toISOString() ?? null,
      to: options.to?.toISOString() ?? null,
      topicId: options.topicId ?? null,
      studentId: options.studentId ?? null,
    },
    policy: { lateCountsAsPresent, excusedExcluded },
    totals: {
      students: studentStats.length,
      sessions: sessions.length,
      attendance: overall.attendance,
      attended: overall.attended,
      eligible: overall.eligible,
      absent: overall.absent,
      late: overall.late,
      excused: overall.excused,
      lowAttendance: studentStats.filter((s) => s.attendance !== null && s.attendance < 75).length,
    },
    risk,
    studentStats,
    batchStats: Array.from(batchAccs.entries())
      .map(([id, entry]) => ({ id, code: entry.code, name: entry.name, ...finaliseAccumulator(entry.acc) }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    topicStats: Array.from(topicAccs.entries())
      .map(([id, entry]) => ({ id, name: entry.name, category: entry.category, ...finaliseAccumulator(entry.acc) }))
      .sort((a, b) => b.eligible - a.eligible),
    monthly: Array.from(monthAccs.entries())
      .map(([key, entry]) => ({ key, label: entry.label, ...finaliseAccumulator(entry.acc) }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    facultyStats: Array.from(facultyAccs.entries())
      .map(([id, entry]) => ({ id, name: entry.name, ...finaliseAccumulator(entry.acc) }))
      .sort((a, b) => b.sessions - a.sessions),
    lowAttendance: studentStats
      .filter((s) => s.attendance !== null && s.attendance < 75)
      .sort((a, b) => (a.attendance ?? 0) - (b.attendance ?? 0)),
    topAbsentees: [...studentStats].sort((a, b) => b.absent - a.absent).slice(0, 10),
    lateArrivals: [...studentStats].sort((a, b) => b.late - a.late).slice(0, 10),
  }
}

export type AttendanceReport = Awaited<ReturnType<typeof buildAttendanceReport>>
