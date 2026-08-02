-- CreateTable
CREATE TABLE "QuranConnection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commentary" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "QuranConnection_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "QuranConnection_workspaceId_sourceKey_idx" ON "QuranConnection"("workspaceId", "sourceKey");
-- CreateIndex
CREATE INDEX "QuranConnection_workspaceId_targetKey_idx" ON "QuranConnection"("workspaceId", "targetKey");
-- CreateIndex
CREATE INDEX "QuranConnection_workspaceId_category_idx" ON "QuranConnection"("workspaceId", "category");
-- CreateIndex
CREATE INDEX "QuranConnection_workspaceId_updatedAt_idx" ON "QuranConnection"("workspaceId", "updatedAt");
-- CreateIndex
CREATE UNIQUE INDEX "QuranConnection_workspaceId_pairKey_key" ON "QuranConnection"("workspaceId", "pairKey");
-- AddForeignKey
ALTER TABLE "QuranConnection" ADD CONSTRAINT "QuranConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "QuranConnection" ADD CONSTRAINT "QuranConnection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
