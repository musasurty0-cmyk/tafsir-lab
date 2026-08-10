/**
 * Re-encode stored ink into the compact form.
 *
 * New saves are packed by the drawings route, so this is only for drawings
 * nobody has touched since. Mirrors packStroke() in lib/ink.ts exactly — round
 * to 0.1px, tuples not objects, every point kept.
 *
 * Safe to re-run: packing is idempotent, and a row is only written when it
 * actually gets smaller.
 *
 *   node scripts/pack-ink.mjs --dry     see what it would do
 *   node scripts/pack-ink.mjs           do it
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DRY = process.argv.includes("--dry");
const q = (n) => Math.round(n * 10) / 10;

function packStroke(s) {
  const raw = Array.isArray(s?.points) ? s.points : [];
  if (!raw.length) return s;
  const pts = (Array.isArray(raw[0])
    ? raw.map((p) => [p[0], p[1], p[2] ?? 0.5])
    : raw.map((p) => [p.x, p.y, 0.5])
  ).map((p) => [q(p[0]), q(p[1]), p[2] ?? 0.5]);
  return { ...s, points: pts };
}

const before = Number((await db.$queryRawUnsafe(
  `SELECT COALESCE(sum(pg_column_size(strokes)),0)::bigint AS b FROM "CanvasDrawing"`))[0].b);

const rows = await db.canvasDrawing.findMany({ select: { id: true, strokes: true } });
let touched = 0, ptsIn = 0, ptsOut = 0;

for (const r of rows) {
  const src = Array.isArray(r.strokes) ? r.strokes : [];
  if (!src.length) continue;
  const packed = src.map(packStroke);

  for (const s of src)    ptsIn  += Array.isArray(s?.points) ? s.points.length : 0;
  for (const s of packed) ptsOut += Array.isArray(s?.points) ? s.points.length : 0;

  const a = JSON.stringify(src).length, b = JSON.stringify(packed).length;
  if (b >= a) continue;                       // already packed, or no gain
  touched++;
  if (!DRY) await db.canvasDrawing.update({ where: { id: r.id }, data: { strokes: packed } });
}

/* The count must match exactly. If it does not, something simplified the ink,
   and that is a data-loss bug rather than a compression win. */
if (ptsIn !== ptsOut) {
  console.error(`  ABORT: point count changed ${ptsIn} -> ${ptsOut}`);
  process.exit(1);
}

if (!DRY) await db.$executeRawUnsafe(`VACUUM FULL "CanvasDrawing"`).catch(() => {});
const after = Number((await db.$queryRawUnsafe(
  `SELECT COALESCE(sum(pg_column_size(strokes)),0)::bigint AS b FROM "CanvasDrawing"`))[0].b);

const mb = (n) => (n / 1048576).toFixed(2) + " MB";
console.log(`  drawings ${DRY ? "that would be " : ""}re-encoded : ${touched} of ${rows.length}`);
console.log(`  points                          : ${ptsIn.toLocaleString()} in, ${ptsOut.toLocaleString()} out — all kept`);
console.log(`  ink on disk                     : ${mb(before)} -> ${mb(after)}${DRY ? "  (dry run, unchanged)" : `   ${(before / after).toFixed(1)}x`}`);
await db.$disconnect();
