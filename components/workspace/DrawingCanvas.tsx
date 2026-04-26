"use client";

/**
 * DrawingCanvas — freehand annotation overlay for Mode B.
 *
 * Positioned as a full-cover sibling of mode-b-inner inside mode-b-canvas.
 * The same viewport transform is applied to the 2D canvas context so strokes
 * sit correctly over the Mushaf card at any zoom/pan.
 *
 * Props:
 *   strokeColor  — current colour chosen by CanvasToolRail
 *   strokeWidth  — current width chosen by CanvasToolRail
 *   (opacity is fixed per tool: pen/arrow = 1.0, highlight = 0.35)
 *
 * Imperative handle:
 *   undo()   — removes the most-recent confirmed stroke; pushes to redo stack
 *   redo()   — replays the most-recently undone stroke; clears on new stroke
 *   clear()  — wipes all of the current user's strokes
 *
 * History callback:
 *   onHistoryChange(canUndo, canRedo) — fired whenever the history state changes
 *
 * Persistence:
 *   GET /api/pages/[pageId]/drawings  → { myStrokes, otherLayers }
 *   PUT /api/pages/[pageId]/drawings  → { strokes }
 *   Saves are debounced 1.2 s after the last stroke completes.
 */

import {
  forwardRef, useCallback, useEffect, useImperativeHandle,
  useRef, useState,
} from "react";
import type { CanvasViewport } from "./ModeBPage";

// ── Public types ───────────────────────────────────────────────────────────

export type DrawTool = "hand" | "pen" | "highlight" | "arrow" | "eraser";

export interface DrawingCanvasHandle {
  undo:  () => void;
  redo:  () => void;
  clear: () => void;
}

// ── Internal types ─────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

export interface Stroke {
  id:      string;
  tool:    "pen" | "highlight" | "arrow";
  points:  Point[];
  color:   string;
  width:   number;
  opacity: number;
}

interface DrawingLayer {
  authorId:   string;
  authorName: string;
  strokes:    Stroke[];
}

// ── Tool opacity (color/width come from props; opacity is fixed per tool) ──

const TOOL_OPACITY: Record<"pen" | "highlight" | "arrow", number> = {
  pen:       1.00,
  highlight: 0.35,
  arrow:     1.00,
};

const ERASER_RADIUS = 15;   // canvas-space units
const SAVE_DEBOUNCE = 1200; // ms
const MIN_DIST_SQ   = 4;    // minimum squared distance between recorded points (2 px)

// ── Geometry ──────────────────────────────────────────────────────────────

function distToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function strokeHit(stroke: Stroke, cx: number, cy: number, r: number): boolean {
  const pts = stroke.points;
  if (!pts.length) return false;
  if (pts.length === 1) return Math.hypot(cx - pts[0].x, cy - pts[0].y) < r;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(cx, cy, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < r) return true;
  }
  return false;
}

// ── Chaikin curve smoothing ────────────────────────────────────────────────

function chaikin(pts: Point[], iterations = 2): Point[] {
  if (pts.length < 3) return pts;
  let result = pts;
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: Point[] = [result[0]];
    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i], p1 = result[i + 1];
      smoothed.push(
        { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y },
        { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y },
      );
    }
    smoothed.push(result[result.length - 1]);
    result = smoothed;
  }
  return result;
}

// ── Rendering ──────────────────────────────────────────────────────────────

/** Draw a single stroke. For highlight strokes, caller must set globalAlpha externally. */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, overrideAlpha?: number) {
  if (!stroke.points.length) return;
  ctx.save();
  ctx.globalAlpha = overrideAlpha ?? stroke.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth   = stroke.width;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  if (stroke.tool === "arrow") {
    const p0 = stroke.points[0];
    const p1 = stroke.points[stroke.points.length - 1];
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const hl  = Math.max(14, stroke.width * 5);
    ctx.fillStyle = stroke.color;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x - hl * Math.cos(ang - 0.38), p1.y - hl * Math.sin(ang - 0.38));
    ctx.lineTo(p1.x - hl * Math.cos(ang + 0.38), p1.y - hl * Math.sin(ang + 0.38));
    ctx.closePath(); ctx.fill();
  } else {
    const pts = stroke.points.length >= 3 ? chaikin(stroke.points) : stroke.points;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1].x + pts[i].x) / 2;
      const my = (pts[i - 1].y + pts[i].y) / 2;
      ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  pageId:           string;
  tool:             DrawTool;
  strokeColor:      string;   // current colour from CanvasToolRail
  strokeWidth:      number;   // current width from CanvasToolRail
  viewport:         CanvasViewport;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(function DrawingCanvas(
  { pageId, tool, strokeColor, strokeWidth, viewport, onHistoryChange },
  ref,
) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const hlCanvasRef     = useRef<HTMLCanvasElement | null>(null);  // offscreen canvas for highlight batching
  const activeStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef    = useRef(false);
  const viewportRef     = useRef(viewport);
  const myStrokesRef    = useRef<Stroke[]>([]);
  const redoStackRef    = useRef<Stroke[]>([]);
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef          = useRef<number>(0);

  // Keep a stable ref to the callback so imperative handle closures don't go stale.
  const onHistoryRef = useRef(onHistoryChange);
  useEffect(() => { onHistoryRef.current = onHistoryChange; }, [onHistoryChange]);

  const [myStrokes,   setMyStrokes]   = useState<Stroke[]>([]);
  const [otherLayers, setOtherLayers] = useState<DrawingLayer[]>([]);

  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { myStrokesRef.current = myStrokes; }, [myStrokes]);

  function notifyHistory() {
    onHistoryRef.current?.(
      myStrokesRef.current.length > 0,
      redoStackRef.current.length > 0,
    );
  }

  // ── Render loop ───────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    const w = Math.round(width), h = Math.round(height);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const vp = viewportRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.zoom, vp.zoom);

    // ── Other users' strokes — slightly faded ─────────────────────────
    ctx.globalAlpha = 0.7;
    for (const layer of otherLayers) {
      for (const s of layer.strokes) drawStroke(ctx, s);
    }
    ctx.globalAlpha = 1;

    // ── Collect all "my" strokes (committed + in-progress) ────────────
    const allMine: Stroke[] = [
      ...myStrokesRef.current,
      ...(activeStrokeRef.current ? [activeStrokeRef.current] : []),
    ];

    const nonHighlights = allMine.filter((s) => s.tool !== "highlight");
    const highlights    = allMine.filter((s) => s.tool === "highlight");

    // Non-highlight strokes drawn normally
    for (const s of nonHighlights) drawStroke(ctx, s);

    // Highlight strokes batched to an offscreen canvas at full opacity,
    // then composited at 0.35 — prevents compounding at intersections.
    if (highlights.length > 0) {
      if (!hlCanvasRef.current) hlCanvasRef.current = document.createElement("canvas");
      const hl = hlCanvasRef.current;
      if (hl.width !== w || hl.height !== h) { hl.width = w; hl.height = h; }
      const hlCtx = hl.getContext("2d");
      if (hlCtx) {
        hlCtx.clearRect(0, 0, w, h);
        hlCtx.save();
        hlCtx.translate(vp.x, vp.y);
        hlCtx.scale(vp.zoom, vp.zoom);
        for (const s of highlights) drawStroke(hlCtx, s, 1);
        hlCtx.restore();
        ctx.restore(); // pop the transform before drawImage (drawImage works in screen space)
        ctx.globalAlpha = 0.35;
        ctx.drawImage(hl, 0, 0);
        ctx.globalAlpha = 1;
        return; // already restored
      }
    }

    ctx.restore();
  }, [otherLayers]);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(render);
    });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [render]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }, [render, viewport, myStrokes, otherLayers]);

  // ── Load saved strokes ─────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/pages/${pageId}/drawings`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: { myStrokes?: Stroke[]; otherLayers?: DrawingLayer[] } | null) => {
        if (!d) return;
        if (d.myStrokes) {
          setMyStrokes(d.myStrokes);
          myStrokesRef.current = d.myStrokes;
          onHistoryRef.current?.(d.myStrokes.length > 0, false);
        }
        if (d.otherLayers) setOtherLayers(d.otherLayers);
      })
      .catch(() => {});
  }, [pageId]);

  // ── Debounced save ────────────────────────────────────────────────────

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch(`/api/pages/${pageId}/drawings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ strokes: myStrokesRef.current }),
      }).catch(() => {});
    }, SAVE_DEBOUNCE);
  }, [pageId]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Imperative handle (undo / redo / clear) ───────────────────────────

  useImperativeHandle(ref, () => ({
    undo() {
      const prev = myStrokesRef.current;
      if (!prev.length) return;
      const last = prev[prev.length - 1];
      const next = prev.slice(0, -1);
      redoStackRef.current = [...redoStackRef.current, last];
      myStrokesRef.current = next;
      setMyStrokes(next);
      scheduleSave();
      notifyHistory();
    },

    redo() {
      const stack = redoStackRef.current;
      if (!stack.length) return;
      const stroke = stack[stack.length - 1];
      redoStackRef.current = stack.slice(0, -1);
      const next = [...myStrokesRef.current, stroke];
      myStrokesRef.current = next;
      setMyStrokes(next);
      scheduleSave();
      notifyHistory();
    },

    clear() {
      redoStackRef.current = [];
      myStrokesRef.current = [];
      setMyStrokes([]);
      scheduleSave();
      onHistoryRef.current?.(false, false);
    },
  }), [scheduleSave]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Canvas-space coord helper ─────────────────────────────────────────

  function toCanvas(e: React.PointerEvent): Point {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const vp   = viewportRef.current;
    return {
      x: (e.clientX - rect.left - vp.x) / vp.zoom,
      y: (e.clientY - rect.top  - vp.y) / vp.zoom,
    };
  }

  // ── Eraser ────────────────────────────────────────────────────────────

  function eraseAt(cx: number, cy: number) {
    const prev = myStrokesRef.current;
    const next = prev.filter((s) => !strokeHit(s, cx, cy, ERASER_RADIUS));
    if (next.length !== prev.length) {
      redoStackRef.current = []; // erasing collapses redo history
      myStrokesRef.current = next;
      setMyStrokes(next);
      scheduleSave();
      notifyHistory();
    }
  }

  // ── Pointer events ────────────────────────────────────────────────────

  function onDown(e: React.PointerEvent) {
    if (tool === "hand") return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = toCanvas(e);
    if (tool === "eraser") { eraseAt(pt.x, pt.y); return; }

    const drawTool = tool as "pen" | "highlight" | "arrow";
    isDrawingRef.current    = true;
    activeStrokeRef.current = {
      id:      crypto.randomUUID(),
      tool:    drawTool,
      points:  [pt],
      color:   strokeColor,
      width:   strokeWidth,
      opacity: TOOL_OPACITY[drawTool],
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }

  function onMove(e: React.PointerEvent) {
    if (tool === "hand" || !isDrawingRef.current || !activeStrokeRef.current) return;
    e.stopPropagation();
    const pt = toCanvas(e);
    if (tool === "eraser") { if (e.buttons & 1) eraseAt(pt.x, pt.y); return; }
    if (activeStrokeRef.current.tool === "arrow") {
      activeStrokeRef.current = {
        ...activeStrokeRef.current,
        points: [activeStrokeRef.current.points[0], pt],
      };
    } else {
      // Minimum distance threshold: skip redundant points (important at high sample rates)
      const pts  = activeStrokeRef.current.points;
      const last = pts[pts.length - 1];
      const dx = pt.x - last.x, dy = pt.y - last.y;
      if (dx * dx + dy * dy < MIN_DIST_SQ) return;
      activeStrokeRef.current.points.push(pt);
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }

  function onUp() {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    isDrawingRef.current = false;
    const done = activeStrokeRef.current;
    activeStrokeRef.current = null;

    if (done.points.length >= 1) {
      redoStackRef.current = []; // new stroke collapses redo
      const next = [...myStrokesRef.current, done];
      myStrokesRef.current = next;
      setMyStrokes(next);
      scheduleSave();
      notifyHistory();
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }

  const cursor =
    tool === "pen" || tool === "arrow" ? "crosshair"
    : tool === "highlight"             ? "cell"
    : tool === "eraser"                ? "cell"
    : "default";

  return (
    <div
      ref={containerRef}
      className="drawing-canvas-wrap"
      style={{
        pointerEvents: tool === "hand" ? "none" : "auto",
        touchAction:   tool === "hand" ? "auto" : "none",
      }}
    >
      <canvas
        ref={canvasRef}
        className="drawing-canvas-el"
        style={{ cursor }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
    </div>
  );
});

export default DrawingCanvas;
