-- /dunya: how many file links have been handed out this calendar month, so
-- downloads can never run past Cloudflare R2's free tier (see
-- app/api/dunya/file/route.ts). Additive only.
ALTER TABLE "DunyaPlan" ADD COLUMN "fileReads" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DunyaPlan" ADD COLUMN "fileReadsMonth" TEXT;
