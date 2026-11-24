-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPROVAL_RESULT', 'REGISTRATION_UPDATE', 'TEAM_UPDATE', 'MATCH_UPDATE', 'TICKET_REPLY', 'ELECTION', 'ANNOUNCEMENT', 'DEADLINE_REMINDER', 'SYSTEM');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "applyReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "startReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyTr" TEXT,
    "bodyEn" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
