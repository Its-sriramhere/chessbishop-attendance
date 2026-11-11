import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { buildAttendanceReport } from '../services/attendance'
import { getScopedBatchIds } from '../services/scope'
import { asyncHandler } from '../utils/async-handler'
import { endOfDay, parseDateOnly, startOfDay } from '../utils/date'
import { HttpError } from '../utils/http-error'

const router = Router()
router.use(authenticate)

router.get(
  '/attendance',
  asyncHandler(async (req, res) => {
    const scope = await getScopedBatchIds(req.user!)
    const batchId = typeof req.query.batchId === 'string' && req.query.batchId ? req.query.batchId : null
    const topicId = typeof req.query.topicId === 'string' && req.query.topicId ? req.query.topicId : undefined

    if (batchId && scope && !scope.includes(batchId)) {
      throw new HttpError(403, 'You can only view analytics for your assigned batches')
    }

    const fromDate = parseDateOnly(typeof req.query.from === 'string' ? req.query.from : null)
    const toDate = parseDateOnly(typeof req.query.to === 'string' ? req.query.to : null)

    const report = await buildAttendanceReport({
      batchIds: batchId ? [batchId] : scope,
      from: fromDate ? startOfDay(fromDate) : undefined,
      to: toDate ? endOfDay(toDate) : undefined,
      topicId,
    })

    res.json(report)
  }),
)

export default router
