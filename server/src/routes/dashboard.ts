import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { buildAttendanceReport } from '../services/attendance'
import { getScopedBatchIds } from '../services/scope'
import { asyncHandler } from '../utils/async-handler'
import { endOfDay, startOfDay } from '../utils/date'

const router = Router()
router.use(authenticate)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!
    const scope = await getScopedBatchIds(user)
    const todayStart = startOfDay()
    const todayEnd = endOfDay()
    const batchWhere = scope ? { batchId: { in: scope } } : {}

    const report = await buildAttendanceReport({ batchIds: scope })

    const studentWhere = scope
      ? { status: 'ACTIVE' as const, batches: { some: { batchId: { in: scope }, endedAt: null } } }
      : { status: 'ACTIVE' as const }

    const [totalStudents, totalFaculty, activeBatches, classesConducted, todaySessions, recentActivity] =
      await Promise.all([
        prisma.student.count({ where: studentWhere }),
        user.role === 'ADMIN' ? prisma.faculty.count({ where: { isActive: true } }) : Promise.resolve(1),
        prisma.batch.count({
          where: { isActive: true, ...(scope ? { id: { in: scope } } : {}) },
        }),
        prisma.classSession.count({
          where: { status: 'COMPLETED', ...(scope ? { batchId: { in: scope } } : {}) },
        }),
        prisma.classSession.findMany({
          where: { date: { gte: todayStart, lte: todayEnd }, ...batchWhere },
          include: {
            batch: { select: { id: true, code: true, name: true } },
            trainer: { select: { id: true, name: true } },
            topic: { select: { id: true, name: true, category: true } },
            _count: { select: { attendance: true } },
          },
          orderBy: { startTime: 'asc' },
        }),
        prisma.auditLog.findMany({
          where: user.role === 'ADMIN' ? {} : { actorId: user.id },
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ])

    res.json({
      stats: {
        totalStudents,
        totalFaculty,
        activeBatches,
        classesConducted,
        overallAttendance: report.totals.attendance,
        lowAttendance: report.totals.lowAttendance,
        sessionsRecorded: report.totals.sessions,
        todayClasses: todaySessions.length,
      },
      risk: report.risk,
      todaySessions: todaySessions.map((session) => ({
        id: session.id,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        batch: session.batch,
        trainer: session.trainer,
        topic: session.topic,
        attendanceCount: session._count.attendance,
      })),
      recentActivity: recentActivity.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        actor: entry.actor,
        createdAt: entry.createdAt,
        detail: entry.after,
      })),
      batchAttendance: report.batchStats,
    })
  }),
)

export default router
