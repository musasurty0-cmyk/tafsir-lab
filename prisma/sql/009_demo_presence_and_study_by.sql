-- 1. Demo accounts are deleted once they are closed, not after 24 hours.
--    An open demo checks in (seenAt); closing the tab stamps closedAt. A demo
--    closed and not reopened, or silent for ten minutes, is discarded.
CREATE TABLE "DemoPresence" (
    "userId" UUID NOT NULL,
    "seenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(6),
    CONSTRAINT "DemoPresence_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "DemoPresence" ADD CONSTRAINT "DemoPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. A Youth Majlis session can go through the sūrah āyah by āyah, or
--    through the notes point by point (1-10). Existing sessions stay 'ayat'.
ALTER TABLE "YouthMajlisSession" ADD COLUMN "studyBy" TEXT NOT NULL DEFAULT 'ayat';
ALTER TABLE "YouthMajlisSession" ADD COLUMN "pointFrom" INTEGER;
ALTER TABLE "YouthMajlisSession" ADD COLUMN "pointTo" INTEGER;
