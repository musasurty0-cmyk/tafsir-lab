/**
 * lib/ink-pack — a stroke's storage form, and reading the old one.
 *
 * Its own module, with no DOM in it, so the realtime worker (party/), which
 * stores the ink since it moved off the database, packs strokes exactly as
 * the app always has. lib/ink re-exports all of it.
 */

// [x, y, pressure] — space depends on the surface (world vs content px)
export type Pt = [number, number, number];

// ── Backwards compatibility ────────────────────────────────────────────────
// Old strokes were stored as {x, y} objects; new ones as [x, y, pressure].

export function normPts(raw: unknown[]): Pt[] {
  if (!raw.length) return [];
  if (Array.isArray(raw[0])) return raw as Pt[];
  return (raw as { x: number; y: number }[]).map((p) => [p.x, p.y, 0.5]);
}

/* ── Storage form ──────────────────────────────────────────────────────────
   A point was being stored as {"x":574.2222290039062,"y":81.33333206176758}:
   float64 precision, with the keys repeated once per point. At 34 points a
   stroke and 548 strokes a drawing that came to 0.71 MB per ayah on disk —
   about 4.3 GB for one person annotating the whole Qur'an.

   Rounding to 0.1px and storing bare tuples measured 10.3x smaller on the real
   strokes in the database, with EVERY point kept. Nothing is simplified away:
   Douglas-Peucker was tried and bought only 19% more while discarding 96% of
   the points, which flattens handwriting into polylines. 0.1px is below what
   any display can resolve, so this cannot change the shape of a stroke.

   normPts above already reads both shapes, so old drawings keep working and
   are re-encoded the next time they are saved.

   PRESSURE was left at full precision, and it turned out to be the larger
   half: a Pencil reports it as a float32, which serialises as
   "0.3333333432674408" -- 18 characters of a 32-character point. On the
   biggest board that was ~2 MB of 4.5, and 4.5 MB is where Vercel refuses a
   request or a response outright, so the board stopped saving and loading.
   Hundredths are finer than any width difference a stroke can show.        */

/** Round to a tenth of a pixel. Sub-0.1px precision is unrenderable. */
const q = (n: number) => Math.round(n * 10) / 10;
/** Round pressure to a hundredth: a 1% change in width is invisible. */
const qp = (n: number) => Math.round(n * 100) / 100;

/**
 * Put one stroke into its storage form. Idempotent — a stroke already packed
 * passes through unchanged, so it is safe to run on merged old-and-new data.
 */
export function packStroke<T extends { points?: unknown }>(s: T): T {
  const raw = Array.isArray(s.points) ? s.points : [];
  if (!raw.length) return s;
  const pts = normPts(raw as unknown[]).map(
    (p) => [q(p[0]), q(p[1]), qp(p[2] ?? 0.5)] as Pt,
  );
  return { ...s, points: pts };
}

/** Every stroke in a drawing, in storage form. */
export function packStrokes<T extends { points?: unknown }>(strokes: T[]): T[] {
  return strokes.map(packStroke);
}

