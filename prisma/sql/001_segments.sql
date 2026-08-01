-- AlterTable
ALTER TABLE "StructuredNote" ADD COLUMN     "segmentId" UUID;
-- CreateTable
CREATE TABLE "QuranSegment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "startAyah" INTEGER NOT NULL,
    "endAyah" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "QuranSegment_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "QuranSegment_workspaceId_surahNumber_idx" ON "QuranSegment"("workspaceId", "surahNumber");
-- AddForeignKey
ALTER TABLE "QuranSegment" ADD CONSTRAINT "QuranSegment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "QuranSegment" ADD CONSTRAINT "QuranSegment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
