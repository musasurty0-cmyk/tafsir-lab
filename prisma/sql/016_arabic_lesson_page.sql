-- Arabic study: each lesson can have a board — the same notes document and
-- canvas a blank board has — made the first time it is opened. It lives on
-- the workspace's board container (surah 0) like any other board; this
-- column remembers which one is the lesson's. Additive only.
ALTER TABLE "ArabicLesson" ADD COLUMN "pageId" UUID;
ALTER TABLE "ArabicLesson" ADD CONSTRAINT "ArabicLesson_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;
