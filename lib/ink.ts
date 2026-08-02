/**
 * lib/ink — shared freehand ink engine.
 *
 * Extracted from DrawingCanvas so the Mode B Mushaf canvas and the Mode A
 * editor ink overlay render strokes identically (same midpoint-quadratic
 * smoothing, same pressure model) without duplicating the math.
 *
 * Stroke surfaces:
 *   "canvas" (default) — world-space strokes on the Mushaf canvas
 *   "editor"           — content-space strokes over the typed notebook
 */

// [x, y, pressure] — space depends on the surface (world vs content px)
export type Pt = [number, number, number];

export interface InkStroke {
  id:          string;
  tool:        "pen" | "highlight" | "arrow";
  points:      Pt[];
  color:       string;
  width:       number;
  opacity:     number;
  /** Mushaf page this stroke belongs to (canvas surface only) */
  mushafPage?: number;
  /** Which drawing surface owns this stroke; absent = "canvas" (legacy) */
  surface?:    "canvas" | "editor";
  /** Annotation-layer owner: "w:1:2:5" (word) or "a:1:2" (ayah).
   *  Absent = page-level stroke, always visible. Anchored strokes render
   *  only while their word/ayah annotation layer is active. */
  anchor?:     string;
}

export function strokeSurface(s: { surface?: string }): "canvas" | "editor" {
  return s.surface === "editor" ? "editor" : "canvas";
}

// ── Backwards compatibility ────────────────────────────────────────────────
// Old strokes were stored as {x, y} objects; new ones as [x, y, pressure].

export function normPts(raw: unknown[]): Pt[] {
  if (!raw.length) return [];
  if (Array.isArray(raw[0])) return raw as Pt[];
  return (raw as { x: number; y: number }[]).map((p) => [p.x, p.y, 0.5]);
}

// ── Geometry ───────────────────────────────────────────────────────────────

export function distToSeg(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function hitTest(pts: Pt[], cx: number, cy: number, r: number): boolean {
  if (!pts.length) return false;
  if (pts.length === 1) return Math.hypot(cx - pts[0][0], cy - pts[0][1]) < r;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSeg(cx, cy, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < r) return true;
  }
  return false;
}

// ── Rendering ──────────────────────────────────────────────────────────────
//
// Constant-width strokes (highlighter etc.): one continuous midpoint-
// quadratic path.
//
// Pressure strokes (pen): a variable-width OUTLINE polygon built directly
// from the stored samples and filled once. Earlier versions used
// perfect-freehand, but its `streamline` interpolation visibly straightened
// curves ("warped" handwriting) and its size-relative corner threshold plus
// pressure `thinning` truncated the ends of small letters. The custom
// outline below offsets the RAW centreline by a per-point radius (real
// pressure, zero-phase smoothed) and closes both ends with true semicircular
// caps at the exact first/last sample — the stroke follows the stylus path
// faithfully and is never clipped.

export function pressureWidth(base: number, p: number): number {
  // Kept for callers that need a scalar width from pressure.
  // Floor is PROPORTIONAL for thin pens (fine-liner at high zoom) but keeps
  // the old 1.5px crispness clamp once the base width is big enough for it.
  return Math.max(Math.min(1.5, base * 0.55), base * (0.45 + 1.1 * p));
}

/** Rendered stroke radius for a base width at pressure p. ×1.9 keeps the
 *  on-screen thickness of previously saved strokes (perfect-freehand drew
 *  at size ≈ width×1.9). */
function strokeRadius(base: number, p: number): number {
  return (pressureWidth(base, p) * 1.9) / 2;
}

/** Streamline strength, 0..1. The proportion of the previous point retained
 *  when each new sample arrives — the core of how perfect-freehand (and so
 *  tldraw) turns raw stylus input into a flowing line. Higher is smoother but
 *  lags the pen tip more; this sits just below tldraw's default because the
 *  Mushaf is annotated with small, deliberate marks where lag is felt sooner
 *  than on an open canvas. */
const STREAMLINE = 0.42;

/**
 * Build the closed outline polygon for a pressure stroke.
 *
 * Centreline is STREAMLINED, not raw. A stylus reports several hundred samples
 * a second and every one carries a little position noise; following them
 * exactly renders that noise as visible wobble, which is what made the pen
 * feel like it was fighting the hand rather than flowing with it. Each sample
 * is now pulled a fraction of the way from the previous point toward the raw
 * reading — a first-order low-pass on position, the same technique
 * perfect-freehand uses.
 *
 * This replaces the old minimum-spacing filter, which DISCARDED samples closer
 * than half the pen width. That removed the noisy clusters but quantised the
 * path to a floor of ~1.6px, so drawing slowly — exactly when you are being
 * careful — produced the most visibly stepped line. Smoothing the samples
 * keeps every one of them and removes the noise instead of the detail.
 *
 * Pressure (width) is zero-phase smoothed (forward+backward EMA) so width
 * never jitters into beads, without shifting the path geometry. Both ends get
 * sampled semicircular caps centred on the exact first and last points —
 * nothing tapers away or gets cut off at pen-lift.
 */
function penOutline(raw: Pt[], base: number): [number, number][] {
  if (raw.length < 2) return [];

  // 1. Streamline. Applied at RENDER time, so the stored points stay the true
  //    input: smoothing is a presentation choice we can retune later, and
  //    strokes drawn before this existed pick it up too.
  const t = 1 - STREAMLINE;
  const S: Pt[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const prev = S[S.length - 1];
    S.push([
      prev[0] + (raw[i][0] - prev[0]) * t,
      prev[1] + (raw[i][1] - prev[1]) * t,
      raw[i][2],
    ]);
  }
  // The filter always trails the input, so the smoothed path stops short of
  // where the pen actually lifted. Pin the true endpoint back on, or short
  // strokes visibly fall short of the mark the user made.
  const rawTail = raw[raw.length - 1];
  const sTail   = S[S.length - 1];
  if (Math.hypot(rawTail[0] - sTail[0], rawTail[1] - sTail[1]) > 1e-3) {
    S.push([rawTail[0], rawTail[1], rawTail[2]]);
  }

  // 2. Upsample long gaps. Streamlining fixes noise but not SPARSITY: move the
  //    pen quickly and consecutive samples land far apart, so the outline
  //    polygon spans them with one long chord. The wider the pen, the further
  //    those chords sit from the true offset curve, which is what shows up as
  //    a faceted or broken edge on fast strokes at large thicknesses.
  //
  //    The cap scales with pen width but is bounded: a hairline does not need
  //    sub-pixel sampling, and a thick pen gains nothing past ~4px. Points are
  //    only ever ADDED where a gap exceeds the cap, so a slow stroke — already
  //    densely sampled — is untouched and cannot bead up from over-sampling.
  const MAX_GAP = Math.max(1.5, Math.min(4, base * 0.8));
  const D: Pt[] = [S[0]];
  for (let i = 1; i < S.length; i++) {
    const a = D[D.length - 1], b = S[i];
    const gap = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (gap > MAX_GAP) {
      const steps = Math.min(Math.ceil(gap / MAX_GAP), 64); // bounded: never stall a frame
      for (let k = 1; k < steps; k++) {
        const f = k / steps;
        D.push([
          a[0] + (b[0] - a[0]) * f,
          a[1] + (b[1] - a[1]) * f,
          a[2] + (b[2] - a[2]) * f,   // pressure eased across the gap too
        ]);
      }
    }
    D.push(b);
  }

  // 3. Drop only genuinely coincident samples. Degenerate spacing makes the
  //    local tangent undefined; anything above that threshold is real detail
  //    and is kept, unlike the old width-proportional decimation.
  const MIN_SP = 0.35;
  const P: Pt[] = [];
  for (const p of D) {
    const last = P[P.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= MIN_SP) P.push(p);
  }
  if (P.length < 2 && D.length >= 2) { P.length = 0; P.push(D[0], D[D.length - 1]); }
  const n = P.length;
  if (n < 2) return [];

  // Zero-phase pressure smoothing: forward EMA and backward EMA, averaged.
  // Smooths WIDTH only — the path geometry is never touched.
  const ALPHA = 0.3;
  const fwd = new Float32Array(n);
  const bwd = new Float32Array(n);
  let acc = P[0][2];
  for (let i = 0; i < n; i++) { acc += (P[i][2] - acc) * ALPHA; fwd[i] = acc; }
  acc = P[n - 1][2];
  for (let i = n - 1; i >= 0; i--) { acc += (P[i][2] - acc) * ALPHA; bwd[i] = acc; }

  // 2. Tangent DIRECTION per sample, zero-phase smoothed as unit vectors
  //    (cos/sin, so no angle-wraparound artefacts). The offset direction is
  //    what draws the stroke's edge, so stabilising it — WITHOUT moving the
  //    centreline — is what actually removes the sawtooth. The centreline
  //    stays the raw path, so curves are never warped.
  const rawTx = new Float32Array(n), rawTy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const m = Math.hypot(dx, dy) || 1;
    rawTx[i] = dx / m; rawTy[i] = dy / m;
  }
  // Tangent EMA weight. Higher = follows the true direction more closely.
  // This was 0.32 — heavy smoothing, needed when the centreline was raw and
  // noisy. With the path streamlined the noise is already gone, and that much
  // smoothing only rounded off genuine direction changes, blunting corners
  // and deliberate flicks. Lighter now, so intent survives.
  const TA = 0.5;
  const fX = new Float32Array(n), fY = new Float32Array(n);
  const bX = new Float32Array(n), bY = new Float32Array(n);
  let ax = rawTx[0], ay = rawTy[0];
  for (let i = 0; i < n; i++) { ax += (rawTx[i] - ax) * TA; ay += (rawTy[i] - ay) * TA; fX[i] = ax; fY[i] = ay; }
  ax = rawTx[n - 1]; ay = rawTy[n - 1];
  for (let i = n - 1; i >= 0; i--) { ax += (rawTx[i] - ax) * TA; ay += (rawTy[i] - ay) * TA; bX[i] = ax; bY[i] = ay; }

  // Offset points per sample, using the smoothed tangent.
  const left:  [number, number][] = [];
  const right: [number, number][] = [];
  const theta = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let ux = (fX[i] + bX[i]) / 2, uy = (fY[i] + bY[i]) / 2;
    const m = Math.hypot(ux, uy) || 1; ux /= m; uy /= m;
    theta[i] = Math.atan2(uy, ux);
    const r = strokeRadius(base, (fwd[i] + bwd[i]) / 2);
    left.push ([P[i][0] + r * Math.cos(theta[i] - Math.PI / 2), P[i][1] + r * Math.sin(theta[i] - Math.PI / 2)]);
    right.push([P[i][0] + r * Math.cos(theta[i] + Math.PI / 2), P[i][1] + r * Math.sin(theta[i] + Math.PI / 2)]);
  }

  // Ring: left side forward → end cap → right side backward → start cap.
  const CAP_STEPS = 8;
  const ring: [number, number][] = [...left];
  const rEnd = strokeRadius(base, (fwd[n - 1] + bwd[n - 1]) / 2);
  for (let k = 1; k < CAP_STEPS; k++) {
    const a = theta[n - 1] - Math.PI / 2 + (k / CAP_STEPS) * Math.PI;
    ring.push([P[n - 1][0] + rEnd * Math.cos(a), P[n - 1][1] + rEnd * Math.sin(a)]);
  }
  for (let i = n - 1; i >= 0; i--) ring.push(right[i]);
  const rStart = strokeRadius(base, (fwd[0] + bwd[0]) / 2);
  for (let k = 1; k < CAP_STEPS; k++) {
    const a = theta[0] + Math.PI / 2 + (k / CAP_STEPS) * Math.PI;
    ring.push([P[0][0] + rStart * Math.cos(a), P[0][1] + rStart * Math.sin(a)]);
  }
  return ring;
}

/** A stroke's geometry, ready to paint. Built once per stroke and reused. */
export interface BuiltPath { path: Path2D; mode: "fill" | "stroke"; lineWidth: number }

/**
 * Build the Path2D for a stroke. Split out of drawSmooth so the result can be
 * CACHED: this is the expensive half (outline maths plus hundreds of curve
 * segments) and for a committed stroke it produces the same path every time.
 */
export function buildStrokePath(
  pts: Pt[], width: number, pressureSensitive: boolean,
): BuiltPath | null {
  if (!pts.length) return null;
  const path = new Path2D();

  if (pts.length === 1) {
    const r = pressureSensitive ? strokeRadius(width, pts[0][2]) : width / 2;
    path.arc(pts[0][0], pts[0][1], r, 0, Math.PI * 2);
    return { path, mode: "fill", lineWidth: width };
  }

  if (!pressureSensitive) {
    path.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 2) {
      path.lineTo(pts[1][0], pts[1][1]);
    } else {
      for (let i = 1; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      }
      path.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    }
    return { path, mode: "stroke", lineWidth: width };
  }

  const outline = penOutline(pts, width);
  if (outline.length < 3) {
    path.arc(pts[0][0], pts[0][1], strokeRadius(width, pts[0][2]), 0, Math.PI * 2);
    return { path, mode: "fill", lineWidth: width };
  }

  path.moveTo(outline[0][0], outline[0][1]);
  // Midpoint-quadratic around the outline keeps the polygon silky at any
  // zoom. Body points sit on the true offset curve and caps are 8-segment
  // arcs, so the smoothing rounds nothing off perceptibly.
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return { path, mode: "fill", lineWidth: width };
}

/** Paint a prebuilt path with the given ink settings. */
export function paintBuiltPath(
  ctx: CanvasRenderingContext2D, b: BuiltPath,
  color: string, opacity: number,
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  if (b.mode === "stroke") { ctx.lineWidth = b.lineWidth; ctx.stroke(b.path); }
  else                     { ctx.fill(b.path); }
  ctx.restore();
}

export function drawSmooth(
  ctx:     CanvasRenderingContext2D,
  pts:     Pt[],
  color:   string,
  width:   number,
  opacity: number,
  pressureSensitive = false,
) {
  // Used for the ACTIVE stroke, which changes every frame — no cache here.
  const b = buildStrokePath(pts, width, pressureSensitive);
  if (b) paintBuiltPath(ctx, b, color, opacity);
}

export function drawArrow(
  ctx:   CanvasRenderingContext2D,
  pts:   Pt[],
  color: string,
  width: number,
) {
  if (pts.length < 2) return;
  const [x0, y0] = pts[0];
  const [x1, y1] = pts[pts.length - 1];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = width;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const hl  = Math.max(14, width * 5);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - hl * Math.cos(ang - 0.38), y1 - hl * Math.sin(ang - 0.38));
  ctx.lineTo(x1 - hl * Math.cos(ang + 0.38), y1 - hl * Math.sin(ang + 0.38));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* Committed strokes are immutable — the arrays that hold them are rebuilt on
   edit, but the stroke objects themselves are carried over — so their geometry
   can be built once and reused.

   This matters a lot. paintStroke runs for EVERY stroke on EVERY frame, and
   the canvas repaints continuously while drawing. Rebuilding each time meant
   re-running normPts and penOutline per stroke per frame — six Float32Arrays
   and three point arrays each — which is sustained allocation churn and
   showed up as periodic freezes when the collector ran.

   Keyed by the stroke object in a WeakMap, so entries disappear with the
   strokes and nothing has to be invalidated by hand. Width and tool are
   stored alongside: if either changes the stroke is a different shape and
   the path is rebuilt. */
const pathCache = new WeakMap<object, { built: BuiltPath | null; w: number; tool: string }>();

/**
 * Dark-mode ink.
 *
 * The sheet is black in dark mode, and the default pen is near-black, so
 * strokes drawn on a light sheet would vanish the moment the theme flipped —
 * including every stroke ALREADY saved. Remapping at paint time rather than at
 * save time fixes those too, and stores nothing: the file keeps the colour the
 * author picked, and flipping back to light restores it exactly.
 *
 * Only near-neutral dark inks are touched. A red or blue annotation is a
 * deliberate choice and reads fine on black, so it is left alone.
 */
const DARK_PAPER_INK = "#f4f4f5";

function inkFor(color: string): string {
  if (typeof document === "undefined") return color;
  if (document.documentElement.getAttribute("data-theme") !== "dark") return color;
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  // dark and close to neutral => it was meant to be "black ink"
  return max <= 90 && max - min <= 24 ? DARK_PAPER_INK : color;
}

export function paintStroke(ctx: CanvasRenderingContext2D, s: InkStroke, alphaScale = 1) {
  if (s.tool === "arrow") {
    drawArrow(ctx, normPts(s.points as unknown[]), inkFor(s.color), s.width);
    return;
  }

  let entry = pathCache.get(s as unknown as object);
  if (!entry || entry.w !== s.width || entry.tool !== s.tool) {
    const pts = normPts(s.points as unknown[]);
    entry = {
      built: buildStrokePath(pts, s.width, s.tool === "pen"),
      w: s.width,
      tool: s.tool,
    };
    pathCache.set(s as unknown as object, entry);
  }
  if (entry.built) paintBuiltPath(ctx, entry.built, inkFor(s.color), s.opacity * alphaScale);
}
