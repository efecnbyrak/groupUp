-- DropIndex
DROP INDEX "Club_universityId_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");
