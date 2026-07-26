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

/**
 * Build the closed outline polygon for a pressure stroke.
 *
 * - Centreline is the raw input path — no streamline/simplification, so the
 *   rendered ink follows the user's hand exactly at any size.
 * - Pressure (width) is zero-phase smoothed (forward+backward EMA) so width
 *   never jitters into beads, without shifting the path geometry.
 * - Both ends get sampled semicircular caps centred on the exact first and
 *   last points — nothing tapers away or gets cut off at pen-lift.
 */
function penOutline(raw: Pt[], base: number): [number, number][] {
  // 1. Resample to a MINIMUM spacing. A stylus sampling densely while you
  //    write slowly piles many points into a tiny area; each carries a little
  //    position noise, and offsetting them perpendicular to their (wildly
  //    swinging) local tangents spikes the edge into a sawtooth ("furry"
  //    ink). Enforcing a floor on point spacing removes the clusters that
  //    cause it, without simplifying the actual curve.
  const MIN_SP = Math.max(1.6, base * 0.5);
  const P: Pt[] = [];
  for (const p of raw) {
    const last = P[P.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= MIN_SP) P.push(p);
  }
  // Always keep the final sample so the ink reaches the exact pen-lift point.
  const tail = raw[raw.length - 1];
  const plast = P[P.length - 1];
  if (tail && plast && Math.hypot(tail[0] - plast[0], tail[1] - plast[1]) > 1e-3) P.push(tail);
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
  const TA = 0.32;
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

export function drawSmooth(
  ctx:     CanvasRenderingContext2D,
  pts:     Pt[],
  color:   string,
  width:   number,
  opacity: number,
  pressureSensitive = false,
) {
  if (!pts.length) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  if (pts.length === 1) {
    const r = pressureSensitive ? strokeRadius(width, pts[0][2]) : width / 2;
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (!pressureSensitive) {
    // Constant width — one continuous stroked path.
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 2) {
      ctx.lineTo(pts[1][0], pts[1][1]);
    } else {
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Pressure path — single filled outline polygon (no joints, no beads).
  const outline = penOutline(pts, width);

  if (outline.length < 3) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], strokeRadius(width, pts[0][2]), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);
  // Midpoint-quadratic around the outline keeps the polygon silky at any
  // zoom. Body points sit on the true offset curve and caps are 8-segment
  // arcs, so the smoothing rounds nothing off perceptibly.
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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

export function paintStroke(ctx: CanvasRenderingContext2D, s: InkStroke, alphaScale = 1) {
  const pts = normPts(s.points as unknown[]);
  if (s.tool === "arrow") { drawArrow(ctx, pts, s.color, s.width); return; }
  drawSmooth(ctx, pts, s.color, s.width, s.opacity * alphaScale, s.tool === "pen");
}
