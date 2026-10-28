-- Handwriting, one row per stroke.
--
-- Ink was one JSON array per author per page ("CanvasDrawing"), up to 2.8 MB,
-- and every save rewrote the whole array: megabytes of disk writes for one
-- new stroke. Supabase warned that this was exhausting the database's Disk
-- IO budget (an exhausted budget can leave the instance unresponsive, and it
-- had already gone down once that night). A save now writes only the strokes
-- it touches.
--
-- "InkHead" is one tiny row per author per page, moved on every save
-- (including one that only erases), so a reader can ask "has this changed?"
-- without touching the strokes.
--
-- Additive: "CanvasDrawing" is copied, not dropped. Run
-- scripts/ink-catch-up.mts after the code that writes here is live, to bring
-- across anything saved to the old table in between.

CREATE TABLE "InkStroke" (
    "pageId"    UUID NOT NULL REFERENCES "Page"("id") ON DELETE CASCADE,
    "authorId"  UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "id"        TEXT NOT NULL,
    "surface"   TEXT NOT NULL DEFAULT 'canvas',
    "data"      JSONB NOT NULL,
    -- Drawing order, so later strokes paint over earlier ones as before.
    "seq"       BIGSERIAL NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "InkStroke_pkey" PRIMARY KEY ("pageId", "authorId", "id")
);
CREATE INDEX "InkStroke_pageId_seq_idx" ON "InkStroke" ("pageId", "seq");

CREATE TABLE "InkHead" (
    "pageId"    UUID NOT NULL REFERENCES "Page"("id") ON DELETE CASCADE,
    "authorId"  UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "InkHead_pkey" PRIMARY KEY ("pageId", "authorId")
);

INSERT INTO "InkStroke" ("pageId", "authorId", "id", "surface", "data", "updatedAt")
SELECT d."pageId", d."authorId", e.value->>'id',
       CASE WHEN e.value->>'surface' = 'editor' THEN 'editor' ELSE 'canvas' END,
       e.value, d."updatedAt"
FROM "CanvasDrawing" d
CROSS JOIN LATERAL jsonb_array_elements(d."strokes") WITH ORDINALITY AS e(value, ord)
WHERE jsonb_typeof(d."strokes") = 'array' AND e.value->>'id' IS NOT NULL
ORDER BY d."pageId", d."authorId", e.ord
ON CONFLICT DO NOTHING;

INSERT INTO "InkHead" ("pageId", "authorId", "updatedAt")
SELECT "pageId", "authorId", "updatedAt" FROM "CanvasDrawing"
ON CONFLICT DO NOTHING;
