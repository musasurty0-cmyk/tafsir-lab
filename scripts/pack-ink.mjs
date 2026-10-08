/**
 * Re-encode stored ink into the compact form.
 *
 * New saves are packed by the drawings route, so this is only for drawings
 * nobody has touched since. Mirrors packStroke() in lib/ink.ts exactly — round
 * to 0.1px, pressure to 0.01, tuples not objects, every point kept.
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
const q  = (n) => Math.round(n * 10) / 10;
const qp = (n) => Math.round(n * 100) / 100;

function packStroke(s) {
  const raw = Array.isArray(s?.points) ? s.points : [];
  if (!raw.length) return s;
  const pts = (Array.isArray(raw[0])
    ? raw.map((p) => [p[0], p[1], p[2] ?? 0.5])
    : raw.map((p) => [p.x, p.y, 0.5])
  ).map((p) => [q(p[0]), q(p[1]), qp(p[2] ?? 0.5)]);
  return { ...s, points: pts };
}

const before = Number((await db.$queryRawUnsafe(
  `SELECT COALESCE(sum(pg_column_size(strokes)),0)::bigint AS b FROM "CanvasDrawing"`))[0].b);

const rows = await db.canvasDrawing.findMany({ select: { id: true, strokes: true, updatedAt: true } });
let touched = 0, raced = 0, ptsIn = 0, ptsOut = 0;

for (const r of rows) {
  const src = Array.isArray(r.strokes) ? r.strokes : [];
  if (!src.length) continue;
  const packed = src.map(packStroke);

  let nIn = 0, nOut = 0;
  for (const s of src)    nIn  += Array.isArray(s?.points) ? s.points.length : 0;
  for (const s of packed) nOut += Array.isArray(s?.points) ? s.points.length : 0;
  ptsIn += nIn; ptsOut += nOut;
  /* Checked BEFORE the row is written. If the count differs, something
     simplified the ink, and that is a data-loss bug, not a compression win. */
  if (nIn !== nOut || packed.length !== src.length) {
    console.error(`  ABORT on ${r.id}: ${src.length}/${nIn} strokes/points in, ${packed.length}/${nOut} out`);
    process.exit(1);
  }

  const a = JSON.stringify(src).length, b = JSON.stringify(packed).length;
  if (b >= a) continue;                       // already packed, or no gain
  touched++;
  if (DRY) continue;
  /* Only if nobody saved this row since it was read: a stroke drawn in the
     meantime would otherwise be overwritten by this older copy. The drawings
     route packs on every save, so a skipped row is packed the next time its
     owner draws on it anyway. */
  const w = await db.canvasDrawing.updateMany({
    where: { id: r.id, updatedAt: r.updatedAt },
    data:  { strokes: packed },
  });
  if (w.count === 0) { touched--; raced++; }
}

if (!DRY) await db.$executeRawUnsafe(`VACUUM FULL "CanvasDrawing"`).catch(() => {});
const after = Number((await db.$queryRawUnsafe(
  `SELECT COALESCE(sum(pg_column_size(strokes)),0)::bigint AS b FROM "CanvasDrawing"`))[0].b);

const mb = (n) => (n / 1048576).toFixed(2) + " MB";
console.log(`  drawings ${DRY ? "that would be " : ""}re-encoded : ${touched} of ${rows.length}`);
if (raced) console.log(`  skipped (saved by a user mid-run) : ${raced}`);
console.log(`  points                          : ${ptsIn.toLocaleString()} in, ${ptsOut.toLocaleString()} out — all kept`);
console.log(`  ink on disk                     : ${mb(before)} -> ${mb(after)}${DRY ? "  (dry run, unchanged)" : `   ${(before / after).toFixed(1)}x`}`);
await db.$disconnect();
