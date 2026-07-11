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
// Pressure strokes (pen): a perfect-freehand OUTLINE polygon filled once.
// This is how GoodNotes-class apps render ink. The previous approach —
// stroking each tiny segment separately with a per-segment lineWidth and
// round caps — beaded into visible "dots" the moment real stylus pressure
// jittered between samples (thick caps bulging past thin neighbours).
// A single filled outline has no joints, no caps, no beading, and renders
// identically on every device because it's a pure function of the stored
// world-space points.

import { getStroke } from "perfect-freehand";

export function pressureWidth(base: number, p: number): number {
  // Kept for callers that need a scalar width from pressure.
  return Math.max(1.5, base * (0.45 + 1.1 * p));
}

/** perfect-freehand options for a given base width. streamline smooths
 *  input jitter; thinning maps pressure to width. */
function freehandOptions(width: number) {
  return {
    size:             Math.max(2.5, width * 1.9),
    thinning:         0.55,
    smoothing:        0.6,
    streamline:       0.45,
    simulatePressure: false, // we store REAL pressure per point
    last:             true,
  };
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
  const outline = getStroke(
    pts.map((p) => [p[0], p[1], p[2]] as [number, number, number]),
    freehandOptions(width),
  );

  if (outline.length < 3) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], pressureWidth(width, pts[0][2]) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);
  // Midpoint-quadratic around the outline keeps the polygon silky at any zoom.
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
