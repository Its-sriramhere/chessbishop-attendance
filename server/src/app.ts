import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { config } from './config'
import { errorHandler, notFound } from './middleware/error'
import analyticsRoutes from './routes/analytics'
import attendanceImportRoutes from './routes/attendance-import'
import authRoutes from './routes/auth'
import batchRoutes from './routes/batches'
import dashboardRoutes from './routes/dashboard'
import facultyRoutes from './routes/faculty'
import reportRoutes from './routes/reports'
import sessionRoutes from './routes/sessions'
import studentRoutes from './routes/students'
import topicRoutes from './routes/topics'

const app = express()

const isVercel = Boolean(process.env.VERCEL)
const allowedOrigins = new Set(
  [
    ...config.clientUrl.split(',').map((origin) => origin.trim()),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
  ].filter(Boolean),
)

app.disable('x-powered-by')
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || (!isVercel && !config.isProduction)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/attendance-import', attendanceImportRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/faculty', facultyRoutes)
app.use('/api/batches', batchRoutes)
app.use('/api/topics', topicRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/reports', reportRoutes)

app.use(notFound)
app.use(errorHandler)

export default app
