-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('DRAFT', 'CANDIDACY', 'VOTING', 'CLOSED', 'RESULT_PENDING', 'FINALIZED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
    "candidacyOpensAt" TIMESTAMP(3) NOT NULL,
    "candidacyClosesAt" TIMESTAMP(3) NOT NULL,
    "votingOpensAt" TIMESTAMP(3) NOT NULL,
    "votingClosesAt" TIMESTAMP(3) NOT NULL,
    "eligibleSnapshotAt" TIMESTAMP(3),
    "winnerUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statementTr" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BallotReceipt" (
    "electionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BallotReceipt_pkey" PRIMARY KEY ("electionId","userId")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Election_clubId_status_idx" ON "Election"("clubId", "status");

-- CreateIndex
CREATE INDEX "Election_universityId_status_idx" ON "Election"("universityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_electionId_userId_key" ON "Candidate"("electionId", "userId");

-- CreateIndex
CREATE INDEX "Vote_electionId_candidateId_idx" ON "Vote"("electionId", "candidateId");

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BallotReceipt" ADD CONSTRAINT "BallotReceipt_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
