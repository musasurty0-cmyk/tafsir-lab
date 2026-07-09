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
// drawSmooth: one continuous curve via the midpoint-quadratic technique.
// Pressure (pen tool): p=0.5 maps to exactly 1.0× width, so mouse strokes
// and legacy points render identically to constant width.

export function pressureWidth(base: number, p: number): number {
  return base * (0.45 + 1.1 * p); // p=0.1 → 0.56×, p=0.5 → 1.0×, p=1 → 1.55×
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
    const r = (pressureSensitive ? pressureWidth(width, pts[0][2]) : width) / 2;
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (!pressureSensitive) {
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

  // Pressure path — per-segment width; round caps make joints seamless.
  let px = pts[0][0], py = pts[0][1];
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.beginPath();
    ctx.lineWidth = pressureWidth(width, (pts[i][2] + pts[i + 1][2]) / 2);
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    ctx.stroke();
    px = mx; py = my;
  }
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.lineWidth = pressureWidth(width, last[2]);
  ctx.moveTo(px, py);
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
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
