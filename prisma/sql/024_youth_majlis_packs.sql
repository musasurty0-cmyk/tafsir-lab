-- Prep pack PDFs for a Youth Majlis session, uploaded by organisers and read
-- or downloaded by the cohort. The files themselves are in the private R2
-- bucket behind the realtime worker (key "youth-majlis/<id>.pdf"), never in
-- the database: a PDF served from here would come out of the egress quota.
CREATE TABLE IF NOT EXISTS "YouthMajlisPack" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    -- false until the browser's upload to R2 has been checked
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YouthMajlisPack_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "YouthMajlisPack_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "YouthMajlisSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "YouthMajlisPack_key_key" ON "YouthMajlisPack"("key");
CREATE INDEX IF NOT EXISTS "YouthMajlisPack_sessionId_idx" ON "YouthMajlisPack"("sessionId");

-- Links handed out per month, to keep R2 inside its free plan (as /dunya does).
CREATE TABLE IF NOT EXISTS "YouthMajlisPackReads" (
    "month" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "YouthMajlisPackReads_pkey" PRIMARY KEY ("month")
);
