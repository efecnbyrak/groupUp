-- CreateEnum
CREATE TYPE "BracketSide" AS ENUM ('WINNERS', 'LOSERS', 'FINAL');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "awayAgg" INTEGER,
ADD COLUMN     "ffaResults" JSONB,
ADD COLUMN     "homeAgg" INTEGER,
ADD COLUMN     "loserMatchId" TEXT,
ADD COLUMN     "loserSlot" TEXT,
ADD COLUMN     "side" "BracketSide",
ADD COLUMN     "venueId" TEXT;

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "matchMinutes" INTEGER NOT NULL,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Venue_tournamentId_idx" ON "Venue"("tournamentId");

-- CreateIndex
CREATE INDEX "TimeSlot_venueId_idx" ON "TimeSlot"("venueId");

-- CreateIndex
CREATE INDEX "Match_loserMatchId_idx" ON "Match"("loserMatchId");

-- CreateIndex
CREATE INDEX "Match_venueId_idx" ON "Match"("venueId");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
