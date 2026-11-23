-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ParticipationMode" AS ENUM ('INDIVIDUAL', 'TEAM');

-- CreateEnum
CREATE TYPE "Eligibility" AS ENUM ('ALL_MEMBERS', 'STUDENTS_ONLY', 'ALUMNI_ONLY');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "translationHash" TEXT;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "titleTr" VARCHAR(120) NOT NULL,
    "titleEn" VARCHAR(200),
    "summaryTr" VARCHAR(280) NOT NULL,
    "summaryEn" VARCHAR(500),
    "descriptionTr" JSONB NOT NULL,
    "descriptionEn" JSONB,
    "translationHash" TEXT,
    "translatedAt" TIMESTAMP(3),
    "enManual" BOOLEAN NOT NULL DEFAULT false,
    "coverKey" TEXT,
    "locationName" VARCHAR(120),
    "locationAddress" VARCHAR(300),
    "mapUrl" VARCHAR(500),
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "onlineUrl" VARCHAR(500),
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "applyOpensAt" TIMESTAMP(3),
    "applyClosesAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPromoteWaitlist" BOOLEAN NOT NULL DEFAULT true,
    "autoAccept" BOOLEAN NOT NULL DEFAULT true,
    "mode" "ParticipationMode" NOT NULL DEFAULT 'INDIVIDUAL',
    "teamMinSize" INTEGER,
    "teamMaxSize" INTEGER,
    "eligibility" "Eligibility" NOT NULL DEFAULT 'ALL_MEMBERS',
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventImage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "alt" VARCHAR(200),
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_universityId_status_startAt_idx" ON "Event"("universityId", "status", "startAt");

-- CreateIndex
CREATE INDEX "Event_universityId_status_applyClosesAt_idx" ON "Event"("universityId", "status", "applyClosesAt");

-- CreateIndex
CREATE INDEX "Event_clubId_status_applyClosesAt_idx" ON "Event"("clubId", "status", "applyClosesAt");

-- CreateIndex
CREATE INDEX "Event_categoryId_idx" ON "Event"("categoryId");

-- CreateIndex
CREATE INDEX "Event_createdById_idx" ON "Event"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Event_clubId_slug_key" ON "Event"("clubId", "slug");

-- CreateIndex
CREATE INDEX "EventImage_eventId_order_idx" ON "EventImage"("eventId", "order");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventImage" ADD CONSTRAINT "EventImage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

