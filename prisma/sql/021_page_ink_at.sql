-- When a page first got ink. Ink now lives in the page's realtime room on
-- Cloudflare (party/ink.ts), not in the database; this is the one thing the
-- database still needs to know about it — a sūrah counts as started if any of
-- its pages has notes, text or ink. Set once, by the first stroke. Additive.
ALTER TABLE "Page" ADD COLUMN "inkAt" TIMESTAMPTZ(6);

UPDATE "Page" p SET "inkAt" = h.first
FROM (SELECT "pageId", MIN("updatedAt") AS first FROM "InkHead" GROUP BY "pageId") h
WHERE h."pageId" = p."id"
  AND EXISTS (SELECT 1 FROM "InkStroke" k WHERE k."pageId" = p."id");
