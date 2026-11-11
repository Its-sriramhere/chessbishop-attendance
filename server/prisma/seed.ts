import {
  AttendanceStatus,
  Level,
  PrismaClient,
  Role,
  SessionStatus,
  StudentStatus,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20261111)

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const DAY_LABEL: Record<string, string> = {
  SUNDAY: 'Sunday',
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function pick<T>(items: T[]) {
  return items[Math.floor(rand() * items.length)]
}

const facultySeed = [
  { employeeId: 'FAC-001', name: 'Aravind Kumar', email: 'aravind@chessbishop.in', phone: '+91 98400 11223' },
  { employeeId: 'FAC-002', name: 'Lakshmi Narayanan', email: 'lakshmi@chessbishop.in', phone: '+91 98400 44556' },
  { employeeId: 'FAC-003', name: 'Senthil Raj', email: 'senthil@chessbishop.in', phone: '+91 98400 77889' },
  { employeeId: 'FAC-004', name: 'Meera Iyer', email: 'meera@chessbishop.in', phone: '+91 98400 99001' },
]

const batchSeed = [
  {
    code: 'CH-B01',
    name: 'Beginner Batch',
    level: Level.BEGINNER,
    days: 'MONDAY,WEDNESDAY,FRIDAY',
    startTime: '17:00',
    endTime: '18:00',
    durationMin: 60,
    trainerIndex: 0,
    studentCount: 12,
  },
  {
    code: 'CH-B02',
    name: 'Intermediate Batch',
    level: Level.INTERMEDIATE,
    days: 'TUESDAY,THURSDAY,SATURDAY',
    startTime: '18:00',
    endTime: '19:15',
    durationMin: 75,
    trainerIndex: 1,
    studentCount: 10,
  },
  {
    code: 'CH-B03',
    name: 'Advanced Batch',
    level: Level.ADVANCED,
    days: 'MONDAY,WEDNESDAY',
    startTime: '19:15',
    endTime: '20:30',
    durationMin: 75,
    trainerIndex: 2,
    studentCount: 8,
  },
  {
    code: 'CH-B04',
    name: 'Tournament Training',
    level: Level.TOURNAMENT,
    days: 'SATURDAY,SUNDAY',
    startTime: '09:00',
    endTime: '11:00',
    durationMin: 120,
    trainerIndex: 3,
    studentCount: 6,
  },
]

const topicSeed = [
  { code: 'OPEN-01', name: 'Opening Principles', category: 'Openings', difficulty: Level.BEGINNER, minutes: 45 },
  { code: 'OPEN-02', name: 'Control of the Centre', category: 'Openings', difficulty: Level.BEGINNER, minutes: 40 },
  { code: 'OPEN-03', name: 'Piece Development', category: 'Openings', difficulty: Level.BEGINNER, minutes: 40 },
  { code: 'OPEN-04', name: 'Italian Game', category: 'Openings', difficulty: Level.INTERMEDIATE, minutes: 60 },
  { code: 'OPEN-05', name: 'Sicilian Defence', category: 'Openings', difficulty: Level.ADVANCED, minutes: 75 },
  { code: 'TACT-01', name: 'The Fork', category: 'Tactics', difficulty: Level.BEGINNER, minutes: 35 },
  { code: 'TACT-02', name: 'The Pin', category: 'Tactics', difficulty: Level.INTERMEDIATE, minutes: 40 },
  { code: 'TACT-03', name: 'The Skewer', category: 'Tactics', difficulty: Level.INTERMEDIATE, minutes: 35 },
  { code: 'TACT-04', name: 'Discovered Attack', category: 'Tactics', difficulty: Level.ADVANCED, minutes: 45 },
  { code: 'TACT-05', name: 'Double Attack', category: 'Tactics', difficulty: Level.ADVANCED, minutes: 45 },
  { code: 'MID-01', name: 'Positional Play', category: 'Middlegame', difficulty: Level.INTERMEDIATE, minutes: 60 },
  { code: 'MID-02', name: 'Pawn Structures', category: 'Middlegame', difficulty: Level.ADVANCED, minutes: 60 },
  { code: 'MID-03', name: 'Piece Coordination', category: 'Middlegame', difficulty: Level.INTERMEDIATE, minutes: 50 },
  { code: 'MID-04', name: 'Strategic Planning', category: 'Middlegame', difficulty: Level.ADVANCED, minutes: 70 },
  { code: 'END-01', name: 'King and Pawn Endgames', category: 'Endgames', difficulty: Level.BEGINNER, minutes: 45 },
  { code: 'END-02', name: 'Rook Endgames', category: 'Endgames', difficulty: Level.INTERMEDIATE, minutes: 55 },
  { code: 'END-03', name: 'The Opposition', category: 'Endgames', difficulty: Level.INTERMEDIATE, minutes: 40 },
  { code: 'END-04', name: 'Basic Checkmates', category: 'Endgames', difficulty: Level.BEGINNER, minutes: 40 },
  { code: 'PRAC-01', name: 'Tactical Puzzles', category: 'Practice & Assessment', difficulty: Level.BEGINNER, minutes: 30 },
  { code: 'PRAC-02', name: 'Practice Matches', category: 'Practice & Assessment', difficulty: Level.INTERMEDIATE, minutes: 60 },
  { code: 'PRAC-03', name: 'Mock Tournaments', category: 'Practice & Assessment', difficulty: Level.ADVANCED, minutes: 90 },
  { code: 'PRAC-04', name: 'Monthly Assessment', category: 'Practice & Assessment', difficulty: Level.INTERMEDIATE, minutes: 60 },
]

const firstNames = [
  'Aarav', 'Diya', 'Ishaan', 'Ananya', 'Vihaan', 'Saanvi', 'Aditya', 'Kiara',
  'Rohan', 'Myra', 'Karthik', 'Aadhya', 'Nikhil', 'Tara', 'Arjun', 'Nitya',
  'Siddharth', 'Ira', 'Vishal', 'Sneha', 'Dhruv', 'Pooja', 'Rahul', 'Kavya',
  'Pranav', 'Meghna', 'Sanjay', 'Riya', 'Harsha', 'Lavanya', 'Naveen', 'Anjali',
  'Varun', 'Divya', 'Akash', 'Shreya',
]

const lastNames = [
  'Sharma', 'Iyer', 'Reddy', 'Menon', 'Patel', 'Krishnan', 'Rao', 'Nair',
  'Verma', 'Pillai', 'Gupta', 'Shetty', 'Bhat', 'Chandran', 'Joshi', 'Kaur',
]

const remarksPool = [
  'Strong tactical awareness this session.',
  'Needs to revise endgame technique.',
  'Active participation throughout the class.',
  'Joined late due to school commitments.',
  'Informed the academy in advance.',
  'Good progress on opening principles.',
  'Struggled with the puzzle set, needs practice.',
]

const reliabilityByIndex = [
  0.96, 0.93, 0.9, 0.87, 0.84, 0.81, 0.78, 0.74, 0.7, 0.66, 0.61, 0.52,
  0.95, 0.91, 0.88, 0.85, 0.82, 0.79, 0.76, 0.72, 0.68, 0.63, 0.57, 0.47,
  0.94, 0.9, 0.86, 0.83, 0.8, 0.77, 0.73, 0.69, 0.64, 0.59, 0.54, 0.89,
]

async function main() {
  console.log('Resetting academy data...')
  await prisma.auditLog.deleteMany()
  await prisma.studentAttendance.deleteMany()
  await prisma.classSession.deleteMany()
  await prisma.batchStudent.deleteMany()
  await prisma.batch.deleteMany()
  await prisma.chessTopic.deleteMany()
  await prisma.student.deleteMany()
  await prisma.user.deleteMany()
  await prisma.faculty.deleteMany()
  await prisma.academySetting.deleteMany()

  await prisma.academySetting.create({
    data: { id: 'singleton', lateCountsAsPresent: true, excusedExcluded: true },
  })

  const adminPassword = await bcrypt.hash('Admin@123', 10)
  const coachPassword = await bcrypt.hash('Coach@123', 10)

  const admin = await prisma.user.create({
    data: {
      name: 'Academy Admin',
      email: 'admin@chessbishop.in',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  })

  const facultyRecords = []
  for (const item of facultySeed) {
    const faculty = await prisma.faculty.create({
      data: {
        employeeId: item.employeeId,
        name: item.name,
        email: item.email,
        phone: item.phone,
        joinedAt: addDays(startOfToday(), -Math.floor(rand() * 600) - 120),
      },
    })
    const firstName = item.name.split(' ')[0].toLowerCase()
    const user = await prisma.user.create({
      data: {
        name: item.name,
        email: firstName + '@chessbishop.in',
        passwordHash: coachPassword,
        role: Role.FACULTY,
        facultyId: faculty.id,
      },
    })
    facultyRecords.push({ ...faculty, userId: user.id })
  }

  const batches = []
  for (const item of batchSeed) {
    const batch = await prisma.batch.create({
      data: {
        code: item.code,
        name: item.name,
        level: item.level,
        days: item.days,
        startTime: item.startTime,
        endTime: item.endTime,
        durationMin: item.durationMin,
        trainerId: facultyRecords[item.trainerIndex].id,
      },
    })
    batches.push(batch)
  }

  const topics = []
  for (const item of topicSeed) {
    const topic = await prisma.chessTopic.create({
      data: {
        code: item.code,
        name: item.name,
        category: item.category,
        difficulty: item.difficulty,
        description: `${item.name} module for the ${item.category.toLowerCase()} syllabus.`,
        objectives: `Understand ${item.name.toLowerCase()} and apply it in guided practice.`,
        estimatedMinutes: item.minutes,
      },
    })
    topics.push(topic)
  }

  const students = []
  let studentIndex = 0
  for (let b = 0; b < batchSeed.length; b += 1) {
    const batchInfo = batchSeed[b]
    for (let i = 0; i < batchInfo.studentCount; i += 1) {
      const first = firstNames[studentIndex % firstNames.length]
      const last = lastNames[(studentIndex * 3 + b) % lastNames.length]
      const reliability = reliabilityByIndex[studentIndex % reliabilityByIndex.length]
      const joiningDate = addDays(startOfToday(), -Math.floor(rand() * 240) - 60)
      const status = studentIndex === 33 || studentIndex === 34 ? StudentStatus.INACTIVE : StudentStatus.ACTIVE
      const student = await prisma.student.create({
        data: {
          studentCode: `CHS-${String(studentIndex + 1).padStart(4, '0')}`,
          name: `${first} ${last}`,
          dob: addDays(startOfToday(), -Math.floor(rand() * 3000) - 3000),
          guardianName: `${pick(['Mr.', 'Mrs.'])} ${last}`,
          contact: `+91 98${String(40000000 + studentIndex * 137).slice(0, 8)}`,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${studentIndex + 1}@example.com`,
          level: batchInfo.level,
          joiningDate,
          status,
        },
      })
      await prisma.batchStudent.create({
        data: {
          studentId: student.id,
          batchId: batches[b].id,
          assignedAt: joiningDate,
        },
      })
      students.push({ ...student, batchId: batches[b].id, batchIndex: b, reliability })
      studentIndex += 1
    }
  }

  const today = startOfToday()
  let sessionCounter = 0
  const attendanceRows: {
    sessionId: string
    studentId: string
    status: AttendanceStatus
    remarks: string | null
    markedById: string
  }[] = []

  for (let offset = -70; offset <= 14; offset += 1) {
    const date = addDays(today, offset)
    const dayName = DAY_NAMES[date.getDay()]

    for (let b = 0; b < batches.length; b += 1) {
      const batch = batches[b]
      const batchDays = batch.days.split(',')
      if (!batchDays.includes(dayName)) continue

      const topic = topics[(sessionCounter + b * 3) % topics.length]
      let status: SessionStatus
      if (offset < 0) {
        status = rand() < 0.04 ? SessionStatus.CANCELLED : SessionStatus.COMPLETED
      } else if (offset === 0) {
        status = rand() < 0.5 ? SessionStatus.COMPLETED : SessionStatus.SCHEDULED
      } else {
        status = SessionStatus.SCHEDULED
      }

      const trainer = facultyRecords[batchSeed[b].trainerIndex]
      const trainerUser = trainer.userId

      const session = await prisma.classSession.create({
        data: {
          batchId: batch.id,
          trainerId: trainer.id,
          topicId: topic.id,
          date,
          startTime: batch.startTime,
          endTime: batch.endTime,
          description: `${topic.name} session for ${batch.name}.`,
          objectives: `Practice ${topic.name.toLowerCase()} with guided exercises and review.`,
          status,
        },
      })

      if (status === SessionStatus.COMPLETED) {
        const roster = students.filter((s) => s.batchIndex === b)
        for (const student of roster) {
          if (student.joiningDate > date) continue
          if (rand() < 0.02) continue // session not marked for this student

          const roll = rand()
          let attendanceStatus: AttendanceStatus
          if (roll < student.reliability - 0.04) {
            attendanceStatus = AttendanceStatus.PRESENT
          } else if (roll < student.reliability) {
            attendanceStatus = AttendanceStatus.LATE
          } else if (roll < student.reliability + 0.05) {
            attendanceStatus = AttendanceStatus.EXCUSED
          } else {
            attendanceStatus = AttendanceStatus.ABSENT
          }

          attendanceRows.push({
            sessionId: session.id,
            studentId: student.id,
            status: attendanceStatus,
            remarks: rand() < 0.12 ? pick(remarksPool) : null,
            markedById: trainerUser,
          })
        }
      }

      sessionCounter += 1
    }
  }

  for (let i = 0; i < attendanceRows.length; i += 500) {
    await prisma.studentAttendance.createMany({ data: attendanceRows.slice(i, i + 500) })
  }

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: admin.id,
        action: 'SEED_ACADEMY',
        entity: 'Academy',
        entityId: null,
        after: { students: students.length, faculty: facultyRecords.length, batches: batches.length, topics: topics.length },
      },
      {
        actorId: admin.id,
        action: 'SESSION_CREATED',
        entity: 'ClassSession',
        entityId: null,
        after: { note: 'Recurring class schedule generated for the term' },
      },
      {
        actorId: facultyRecords[0].userId,
        action: 'ATTENDANCE_SAVED',
        entity: 'StudentAttendance',
        entityId: null,
        after: { note: 'Beginner Batch attendance marked' },
      },
      {
        actorId: facultyRecords[1].userId,
        action: 'ATTENDANCE_SAVED',
        entity: 'StudentAttendance',
        entityId: null,
        after: { note: 'Intermediate Batch attendance marked' },
      },
      {
        actorId: admin.id,
        action: 'STUDENT_IMPORTED',
        entity: 'Student',
        entityId: null,
        after: { count: students.length },
      },
      {
        actorId: admin.id,
        action: 'TOPIC_CREATED',
        entity: 'ChessTopic',
        entityId: null,
        after: { categories: ['Openings', 'Tactics', 'Middlegame', 'Endgames', 'Practice & Assessment'] },
      },
    ],
  })

  console.log('Seed complete.')
  console.log(`Admin: admin@chessbishop.in / Admin@123`)
  console.log(`Faculty: aravind@chessbishop.in / Coach@123 (also lakshmi, senthil, meera)`)
  console.log(`Students: ${students.length}, Batches: ${batches.length}, Topics: ${topics.length}, Attendance rows: ${attendanceRows.length}`)
  console.log(`Day of week for today: ${DAY_LABEL[DAY_NAMES[today.getDay()]]}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
