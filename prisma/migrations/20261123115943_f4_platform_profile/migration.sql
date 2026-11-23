-- CreateTable
CREATE TABLE "AlumniVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "changeRequestId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "AlumniVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameTr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCategory" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "nameTr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlumniVerification_userId_key" ON "AlumniVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniVerification_changeRequestId_key" ON "AlumniVerification"("changeRequestId");

-- CreateIndex
CREATE INDEX "AlumniVerification_universityId_status_submittedAt_idx" ON "AlumniVerification"("universityId", "status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClubCategory_slug_key" ON "ClubCategory"("slug");

-- CreateIndex
CREATE INDEX "ClubCategory_order_idx" ON "ClubCategory"("order");

-- CreateIndex
CREATE UNIQUE INDEX "EventCategory_slug_key" ON "EventCategory"("slug");

-- CreateIndex
CREATE INDEX "EventCategory_parentId_order_idx" ON "EventCategory"("parentId", "order");

-- AddForeignKey
ALTER TABLE "AlumniVerification" ADD CONSTRAINT "AlumniVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCategory" ADD CONSTRAINT "EventCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "EventCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
