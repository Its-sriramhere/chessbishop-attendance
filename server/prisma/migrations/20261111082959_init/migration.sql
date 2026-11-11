-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FACULTY');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'TOURNAMENT');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FACULTY',
    "facultyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "Level" NOT NULL DEFAULT 'BEGINNER',
    "days" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "trainerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "guardianName" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "level" "Level" NOT NULL DEFAULT 'BEGINNER',
    "joiningDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchStudent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "BatchStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChessTopic" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" "Level" NOT NULL DEFAULT 'BEGINNER',
    "description" TEXT,
    "objectives" TEXT,
    "estimatedMinutes" INTEGER,
    "parentId" TEXT,

    CONSTRAINT "ChessTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "topicId" TEXT,
    "subtopicId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "description" TEXT,
    "objectives" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remarks" TEXT,
    "markedById" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademySetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lateCountsAsPresent" BOOLEAN NOT NULL DEFAULT true,
    "excusedExcluded" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademySetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_facultyId_key" ON "User"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_employeeId_key" ON "Faculty"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_email_key" ON "Faculty"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_code_key" ON "Batch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentCode_key" ON "Student"("studentCode");

-- CreateIndex
CREATE INDEX "BatchStudent_studentId_idx" ON "BatchStudent"("studentId");

-- CreateIndex
CREATE INDEX "BatchStudent_batchId_idx" ON "BatchStudent"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ChessTopic_code_key" ON "ChessTopic"("code");

-- CreateIndex
CREATE INDEX "ClassSession_batchId_date_idx" ON "ClassSession"("batchId", "date");

-- CreateIndex
CREATE INDEX "ClassSession_trainerId_idx" ON "ClassSession"("trainerId");

-- CreateIndex
CREATE INDEX "StudentAttendance_studentId_idx" ON "StudentAttendance"("studentId");

-- CreateIndex
CREATE INDEX "StudentAttendance_status_idx" ON "StudentAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttendance_sessionId_studentId_key" ON "StudentAttendance"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchStudent" ADD CONSTRAINT "BatchStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchStudent" ADD CONSTRAINT "BatchStudent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChessTopic" ADD CONSTRAINT "ChessTopic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChessTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ChessTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "ChessTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
