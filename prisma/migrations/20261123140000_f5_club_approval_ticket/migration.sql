-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED', 'BANNED');

-- CreateEnum
CREATE TYPE "ClubStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StaffPermission" AS ENUM ('EVENT_MANAGE', 'REGISTRATION_VIEW', 'REGISTRATION_MANAGE', 'TOURNAMENT_MANAGE', 'MEMBER_INVITE', 'ANNOUNCEMENT_POST', 'TICKET_OPEN');

-- CreateEnum
CREATE TYPE "ChangeRequestType" AS ENUM ('CLUB_UPDATE', 'EVENT_PUBLISH', 'EVENT_UPDATE', 'EVENT_CANCEL', 'MEMBER_REMOVE', 'MEMBER_BAN', 'STAFF_ASSIGN', 'STAFF_REMOVE', 'ALUMNI_VERIFY', 'ELECTION_RESULT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketScope" AS ENUM ('CLUB_TO_ADMIN', 'ADMIN_TO_PLATFORM');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('EVENT', 'APPROVAL', 'MEMBERSHIP', 'TOURNAMENT', 'TECHNICAL', 'OTHER');


-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescTr" VARCHAR(200) NOT NULL,
    "shortDescEn" VARCHAR(200),
    "descriptionTr" JSONB,
    "descriptionEn" JSONB,
    "translationHash" TEXT,
    "logoKey" TEXT,
    "coverKey" TEXT,
    "contactEmail" TEXT,
    "instagram" TEXT,
    "presidentId" TEXT,
    "status" "ClubStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "bannedUntil" TIMESTAMP(3),
    "joinedVia" TEXT,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubInvite" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAssignment" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "permissions" "StaffPermission"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT,
    "bodyTr" JSONB NOT NULL,
    "bodyEn" JSONB,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "clubId" TEXT,
    "type" "ChangeRequestType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "changeRequestId" TEXT,
    "ticketMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "clubId" TEXT,
    "scope" "TicketScope" NOT NULL,
    "category" "TicketCategory" NOT NULL DEFAULT 'OTHER',
    "subject" VARCHAR(160) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "changeRequestId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_presidentId_key" ON "Club"("presidentId");

-- CreateIndex
CREATE INDEX "Club_universityId_categoryId_idx" ON "Club"("universityId", "categoryId");

-- CreateIndex
CREATE INDEX "Club_universityId_status_name_idx" ON "Club"("universityId", "status", "name");

-- CreateIndex
CREATE INDEX "Club_categoryId_idx" ON "Club"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Club_universityId_slug_key" ON "Club"("universityId", "slug");

-- CreateIndex
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");

-- CreateIndex
CREATE INDEX "Membership_clubId_status_joinedAt_idx" ON "Membership"("clubId", "status", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_clubId_userId_key" ON "Membership"("clubId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubInvite_code_key" ON "ClubInvite"("code");

-- CreateIndex
CREATE INDEX "ClubInvite_clubId_createdAt_idx" ON "ClubInvite"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "ClubInvite_createdById_idx" ON "ClubInvite"("createdById");

-- CreateIndex
CREATE INDEX "StaffAssignment_userId_idx" ON "StaffAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAssignment_clubId_userId_key" ON "StaffAssignment"("clubId", "userId");

-- CreateIndex
CREATE INDEX "Announcement_clubId_createdAt_idx" ON "Announcement"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_authorId_idx" ON "Announcement"("authorId");

-- CreateIndex
CREATE INDEX "ChangeRequest_universityId_status_createdAt_idx" ON "ChangeRequest"("universityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeRequest_targetId_type_status_idx" ON "ChangeRequest"("targetId", "type", "status");

-- CreateIndex
CREATE INDEX "ChangeRequest_clubId_createdAt_idx" ON "ChangeRequest"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeRequest_requestedById_idx" ON "ChangeRequest"("requestedById");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_changeRequestId_idx" ON "Attachment"("changeRequestId");

-- CreateIndex
CREATE INDEX "Attachment_ticketMessageId_idx" ON "Attachment"("ticketMessageId");

-- CreateIndex
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");

-- CreateIndex
CREATE INDEX "Ticket_universityId_scope_status_updatedAt_idx" ON "Ticket"("universityId", "scope", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Ticket_clubId_updatedAt_idx" ON "Ticket"("clubId", "updatedAt");

-- CreateIndex
CREATE INDEX "Ticket_openedById_idx" ON "Ticket"("openedById");

-- CreateIndex
CREATE INDEX "Ticket_scope_status_updatedAt_idx" ON "Ticket"("scope", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketMessage_authorId_idx" ON "TicketMessage"("authorId");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ClubCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_presidentId_fkey" FOREIGN KEY ("presidentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubInvite" ADD CONSTRAINT "ClubInvite_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ticketMessageId_fkey" FOREIGN KEY ("ticketMessageId") REFERENCES "TicketMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Onay motoru: aynı hedef + tip için aynı anda tek PENDING talep (APPROVALS-TICKETS §4)
CREATE UNIQUE INDEX "ChangeRequest_one_pending_per_target" ON "ChangeRequest"("type", "targetId") WHERE "status" = 'PENDING';

-- Veri taşıma (F4 → F5): mevcut mezun belgeleri Attachment + ChangeRequest(ALUMNI_VERIFY) olur.
INSERT INTO "ChangeRequest" ("id", "universityId", "type", "targetId", "payload", "status", "requestedById", "decisionNote", "decidedAt", "createdAt", "updatedAt")
SELECT 'cr' || md5(av."id"), av."universityId", 'ALUMNI_VERIFY', av."userId", '{}'::jsonb, av."status", av."userId", av."rejectReason", av."decidedAt", av."submittedAt", av."submittedAt"
FROM "AlumniVerification" av;

INSERT INTO "Attachment" ("id", "storageKey", "fileName", "mimeType", "sizeBytes", "isPrivate", "uploadedById", "changeRequestId", "createdAt")
SELECT 'at' || md5(av."id"), av."storageKey", av."fileName", av."mimeType", av."sizeBytes", true, av."userId", 'cr' || md5(av."id"), av."submittedAt"
FROM "AlumniVerification" av;

UPDATE "AlumniVerification" SET "changeRequestId" = 'cr' || md5("id");

-- AlterTable (belge alanları Attachment'a taşındı)
ALTER TABLE "AlumniVerification" DROP COLUMN "fileName",
DROP COLUMN "mimeType",
DROP COLUMN "sizeBytes",
DROP COLUMN "storageKey";
