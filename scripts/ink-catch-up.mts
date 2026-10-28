/**
 * Bring across ink saved to the old CanvasDrawing table after
 * prisma/sql/020 copied it into InkStroke/InkHead.
 *
 *   npx tsx scripts/ink-catch-up.mts            # report only
 *   APPLY=1 npx tsx scripts/ink-catch-up.mts    # copy
 *
 * The copy ran just before the code that writes InkStroke went live; a tab
 * still running the old code could save to CanvasDrawing in between. Any
 * author's page whose CanvasDrawing row is newer than its InkHead (or has no
 * head) is replaced wholesale from CanvasDrawing — the old table was the only
 * writer for it until then. Once the new code is live nothing writes
 * CanvasDrawing, so a second run finds nothing.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const stale = await db.$queryRaw<{ pageId: string; authorId: string; strokes: number }[]>`
  SELECT d."pageId", d."authorId", jsonb_array_length(d."strokes")::int AS strokes
  FROM "CanvasDrawing" d
  LEFT JOIN "InkHead" h ON h."pageId" = d."pageId" AND h."authorId" = d."authorId"
  WHERE jsonb_typeof(d."strokes") = 'array' AND (h."updatedAt" IS NULL OR d."updatedAt" > h."updatedAt")`;
console.log(`${stale.length} author-pages newer in CanvasDrawing than in InkStroke`);
for (const s of stale) console.log(`  page ${s.pageId.slice(0, 8)} author ${s.authorId.slice(0, 8)}: ${s.strokes} strokes`);

if (process.env.APPLY && stale.length) {
  for (const s of stale) {
    await db.$transaction([
      db.$executeRaw`DELETE FROM "InkStroke" WHERE "pageId" = ${s.pageId}::uuid AND "authorId" = ${s.authorId}::uuid`,
      db.$executeRaw`
        INSERT INTO "InkStroke" ("pageId", "authorId", "id", "surface", "data", "updatedAt")
        SELECT d."pageId", d."authorId", e.value->>'id',
               CASE WHEN e.value->>'surface' = 'editor' THEN 'editor' ELSE 'canvas' END, e.value, d."updatedAt"
        FROM "CanvasDrawing" d
        CROSS JOIN LATERAL jsonb_array_elements(d."strokes") WITH ORDINALITY AS e(value, ord)
        WHERE d."pageId" = ${s.pageId}::uuid AND d."authorId" = ${s.authorId}::uuid AND e.value->>'id' IS NOT NULL
        ORDER BY e.ord
        ON CONFLICT DO NOTHING`,
      db.$executeRaw`
        INSERT INTO "InkHead" ("pageId", "authorId", "updatedAt")
        SELECT "pageId", "authorId", "updatedAt" FROM "CanvasDrawing"
        WHERE "pageId" = ${s.pageId}::uuid AND "authorId" = ${s.authorId}::uuid
        ON CONFLICT ("pageId", "authorId") DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt"`,
    ]);
  }
  console.log("copied");
}
await db.$disconnect();
