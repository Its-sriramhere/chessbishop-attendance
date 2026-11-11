import bcrypt from 'bcryptjs'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { config } from '../config'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../utils/async-handler'
import { HttpError } from '../utils/http-error'

const router = Router()

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    })

    if (!user || !user.isActive) {
      throw new HttpError(401, 'Invalid email or password')
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash)
    if (!valid) {
      throw new HttpError(401, 'Invalid email or password')
    }

    const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '7d' })

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    })

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        facultyId: user.facultyId,
      },
    })
  }),
)

router.post('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' })
  res.json({ success: true })
})

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user })
})

export default router
