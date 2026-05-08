"use client";

/**
 * DrawingCanvas — high-quality freehand annotation overlay for Mode B.
 *
 * Rendering engine:
 *   • perfect-freehand converts raw pointer points (with pressure) into a
 *     smooth, tapered SVG-style outline path, rendered as a filled shape on
 *     a <canvas>.  This produces Miro/GoodNotes-quality ink.
 *   • Arrow and eraser tools fall back to simple 2D canvas paths.
 *   • Highlight uses the freehand engine at fixed pressure (no taper) with
 *     semi-transparent fill and a single batch compositing pass so overlapping
 *     strokes don't compound opacity.
 *
 * Performance:
 *   • Active stroke points are stored in a ref (never React state) so zero
 *     React re-renders happen during drawing.
 *   • A single RAF loop drives rendering while a stroke is in progress.
 *   • getCoalescedEvents() is used to capture every OS-level sample the
 *     digitiser provides, not just the ones that survived event batching.
 *   • Completed strokes are committed to React state (and saved) only on
 *     pointerup — one state update per stroke.
 *
 * Input rules (unchanged from previous version):
 *   pointerType "touch"  → returns immediately (touch pans canvas)
 *   pointerType "pen"    → draws with pressure
 *   pointerType "mouse"  → draws at constant pressure 0.5
 */

import {
  forwardRef, useCallback, useEffect, useImperativeHandle,
  useRef, useState,
} from "react";
import getStroke from "perfect-freehand";
import type { CanvasViewport } from "./ModeBPage";

// ── Public types ───────────────────────────────────────────────────────────

export type DrawTool = "hand" | "pen" | "highlight" | "arrow" | "eraser";

export interface DrawingCanvasHandle {
  undo:  () => void;
  redo:  () => void;
  clear: () => void;
}

// ── Stroke data model ──────────────────────────────────────────────────────
// Each point is [x, y, pressure] in world (canvas) coordinates.

type FreehandPoint = [number, number, number];

export interface Stroke {
  id:      string;
  tool:    "pen" | "highlight" | "arrow";
  points:  FreehandPoint[];
  color:   string;
  width:   number;       // base width (before pressure scaling)
  opacity: number;
}

interface DrawingLayer {
  authorId:   string;
  authorName: string;
  strokes:    Stroke[];
}

// ── perfect-freehand options per tool ─────────────────────────────────────

function freehandOpts(tool: "pen" | "highlight", width: number) {
  if (tool === "highlight") {
    return {
      size:        width,
      thinning:    0,          // flat, no taper
      smoothing:   0.5,
      streamline:  0.5,
      easing:      (t: number) => t,
      simulatePressure: true,
      last:        true,
    };
  }
  // pen
  return {
    size:        width,
    thinning:    0.55,         // pressure taper
    smoothing:   0.5,
    streamline:  0.45,
    easing:      (t: number) => Math.sin((t * Math.PI) / 2),
    simulatePressure: false,   // use real pressure from digitiser
    last:        true,
  };
}

// ── Convert perfect-freehand outline → canvas path ─────────────────────────

function outlineToPath(pts: number[][]): Path2D {
  const path = new Path2D();
  if (!pts.length) return path;
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    path.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  if (pts.length > 1) {
    const last = pts[pts.length - 1];
    path.lineTo(last[0], last[1]);
  }
  path.closePath();
  return path;
}

// ── Arrow (simple begin→end line with arrowhead) ───────────────────────────

function drawArrow(
  ctx: CanvasRenderingContext2D,
  pts: FreehandPoint[],
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

// ── Render a single committed stroke ──────────────────────────────────────

function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  alpha = 1,
) {
  if (!stroke.points.length) return;
  if (stroke.tool === "arrow") {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawArrow(ctx, stroke.points, stroke.color, stroke.width);
    ctx.restore();
    return;
  }
  const outline = getStroke(stroke.points, freehandOpts(stroke.tool, stroke.width));
  const path    = outlineToPath(outline);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = stroke.color;
  ctx.fill(path);
  ctx.restore();
}

// ── Eraser ─────────────────────────────────────────────────────────────────

const ERASER_RADIUS = 18;

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
  if (pts.length === 1) return Math.hypot(cx - pts[0][0], cy - pts[0][1]) < r;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(cx, cy, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < r) return true;
  }
  return false;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TOOL_OPACITY: Record<"pen" | "highlight" | "arrow", number> = {
  pen:       1.00,
  highlight: 0.38,
  arrow:     1.00,
};

const SAVE_DEBOUNCE = 1200; // ms

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  pageId:           string;
  tool:             DrawTool;
  strokeColor:      string;
  strokeWidth:      number;
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
  const hlCanvasRef     = useRef<HTMLCanvasElement | null>(null);

  // Active stroke — lives entirely in refs; zero re-renders during drawing
  const isDrawingRef    = useRef(false);
  const activePtsRef    = useRef<FreehandPoint[]>([]);  // world-space [x,y,pressure]
  const activeToolRef   = useRef<"pen" | "highlight" | "arrow">("pen");
  const activeColorRef  = useRef(strokeColor);
  const activeWidthRef  = useRef(strokeWidth);

  // RAF handle
  const rafRef          = useRef<number>(0);
  const dirtyRef        = useRef(false); // true when activePts changed since last paint

  // Committed strokes
  const viewportRef     = useRef(viewport);
  const myStrokesRef    = useRef<Stroke[]>([]);
  const redoStackRef    = useRef<Stroke[]>([]);
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = container.getBoundingClientRect();
    const w = Math.round(width * dpr), h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width        = w;
      canvas.height       = h;
      canvas.style.width  = `${Math.round(width)}px`;
      canvas.style.height = `${Math.round(height)}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const vp = viewportRef.current;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.zoom, vp.zoom);

    // ── Other users' strokes (faded) ──────────────────────────────────
    for (const layer of otherLayers) {
      for (const s of layer.strokes) {
        renderStroke(ctx, s, s.opacity * 0.7);
      }
    }

    // ── My committed strokes ──────────────────────────────────────────
    const allMine     = myStrokesRef.current;
    const highlights  = allMine.filter((s) => s.tool === "highlight");
    const nonHL       = allMine.filter((s) => s.tool !== "highlight");

    for (const s of nonHL) renderStroke(ctx, s, s.opacity);

    // Highlights: batch onto an offscreen canvas at full opacity,
    // then composite at 0.38 to prevent compounding at intersections.
    if (highlights.length > 0) {
      if (!hlCanvasRef.current) hlCanvasRef.current = document.createElement("canvas");
      const hl = hlCanvasRef.current;
      if (hl.width !== w || hl.height !== h) { hl.width = w; hl.height = h; }
      const hlCtx = hl.getContext("2d");
      if (hlCtx) {
        hlCtx.clearRect(0, 0, w, h);
        hlCtx.save();
        hlCtx.scale(dpr, dpr);
        hlCtx.translate(vp.x, vp.y);
        hlCtx.scale(vp.zoom, vp.zoom);
        for (const s of highlights) renderStroke(hlCtx, s, 1);
        hlCtx.restore();
        ctx.restore();
        ctx.globalAlpha = TOOL_OPACITY.highlight;
        ctx.drawImage(hl, 0, 0);
        ctx.globalAlpha = 1;
        // Active highlight stroke below (re-save transform)
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(vp.x, vp.y);
        ctx.scale(vp.zoom, vp.zoom);
      }
    }

    // ── Active (in-progress) stroke ───────────────────────────────────
    if (isDrawingRef.current && activePtsRef.current.length > 0) {
      const t = activeToolRef.current;
      if (t === "arrow") {
        drawArrow(ctx, activePtsRef.current, activeColorRef.current, activeWidthRef.current);
      } else if (t === "highlight") {
        // Highlight active stroke: draw on top of the composited layer
        const outline = getStroke(activePtsRef.current, freehandOpts("highlight", activeWidthRef.current));
        const path    = outlineToPath(outline);
        ctx.save();
        ctx.globalAlpha = TOOL_OPACITY.highlight;
        ctx.fillStyle   = activeColorRef.current;
        ctx.fill(path);
        ctx.restore();
      } else {
        const outline = getStroke(activePtsRef.current, freehandOpts("pen", activeWidthRef.current));
        const path    = outlineToPath(outline);
        ctx.fillStyle = activeColorRef.current;
        ctx.fill(path);
      }
    }

    ctx.restore();
  }, [otherLayers]);

  // Continuous RAF loop while drawing, static redraw otherwise
  const rafLoop = useCallback(() => {
    if (dirtyRef.current) {
      dirtyRef.current = false;
      render();
    }
    if (isDrawingRef.current) {
      rafRef.current = requestAnimationFrame(rafLoop);
    }
  }, [render]);

  // Non-drawing re-render (viewport change, stroke committed, etc.)
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!isDrawingRef.current) render();
  }, [render, viewport, myStrokes, otherLayers]);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!isDrawingRef.current) render();
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [render]);

  // ── Data loading ──────────────────────────────────────────────────────

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

  useEffect(() => {
    if (!pageId) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/pages/${pageId}/drawings`)
        .then((r) => r.ok ? r.json() : null)
        .then((d: { myStrokes?: Stroke[]; otherLayers?: DrawingLayer[] } | null) => {
          if (d?.otherLayers) setOtherLayers(d.otherLayers);
        })
        .catch(() => {});
    }, 6000);
    return () => clearInterval(id);
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

  // ── Suppress iOS long-press / copy / context-menu ─────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", prevent);
    el.addEventListener("selectstart", prevent);
    el.addEventListener("copy",        prevent);

    // Only preventDefault on finger touches, NOT stylus.
    // On iOS 13+, Apple Pencil fires TouchEvent (touchType:"stylus") alongside
    // PointerEvent (pointerType:"pen"). Preventing the stylus touchstart cancels
    // its companion pointer events and breaks drawing entirely.
    const preventFingerTouch = (e: TouchEvent) => {
      let hasFingerTouch = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i] as Touch & { touchType?: string };
        if (t.touchType !== "stylus") { hasFingerTouch = true; break; }
      }
      if (hasFingerTouch) e.preventDefault();
    };
    el.addEventListener("touchstart", preventFingerTouch, { passive: false });

    return () => {
      el.removeEventListener("contextmenu",  prevent);
      el.removeEventListener("selectstart",  prevent);
      el.removeEventListener("copy",         prevent);
      el.removeEventListener("touchstart",   preventFingerTouch);
    };
  }, []);

  // ── Imperative handle ─────────────────────────────────────────────────

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

  // ── World-space coordinate transform ─────────────────────────────────

  function toWorld(clientX: number, clientY: number): [number, number] {
    const el = containerRef.current;
    if (!el) return [0, 0];
    const rect = el.getBoundingClientRect();
    const vp   = viewportRef.current;
    return [
      (clientX - rect.left - vp.x) / vp.zoom,
      (clientY - rect.top  - vp.y) / vp.zoom,
    ];
  }

  // ── Eraser ────────────────────────────────────────────────────────────

  function eraseAt(wx: number, wy: number) {
    const prev = myStrokesRef.current;
    const next = prev.filter((s) => !strokeHit(s, wx, wy, ERASER_RADIUS / viewportRef.current.zoom));
    if (next.length !== prev.length) {
      redoStackRef.current = [];
      myStrokesRef.current = next;
      setMyStrokes(next);
      scheduleSave();
      notifyHistory();
    }
  }

  // ── Pointer event handlers ────────────────────────────────────────────

  function onDown(e: React.PointerEvent) {
    if (tool === "hand") return;
    if (e.pointerType === "touch") return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const [wx, wy] = toWorld(e.clientX, e.clientY);
    if (tool === "eraser") { eraseAt(wx, wy); return; }

    const drawTool = tool as "pen" | "highlight" | "arrow";
    // Real pressure from digitiser; fall back to 0.5 for mouse
    const pressure = e.pointerType === "pen" ? Math.max(0.1, e.pressure) : 0.5;

    isDrawingRef.current   = true;
    activeToolRef.current  = drawTool;
    activeColorRef.current = strokeColor;
    activeWidthRef.current = strokeWidth;
    activePtsRef.current   = [[wx, wy, pressure]];
    dirtyRef.current       = true;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(rafLoop);
  }

  function onMove(e: React.PointerEvent) {
    if (tool === "hand" || !isDrawingRef.current) return;
    if (e.pointerType === "touch") return;
    e.stopPropagation();

    // Collect all coalesced samples the OS buffered since last event
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events) {
      const [wx, wy] = toWorld(ev.clientX, ev.clientY);
      if (tool === "eraser") { if (e.buttons & 1) eraseAt(wx, wy); continue; }
      const pressure = ev.pointerType === "pen" ? Math.max(0.1, ev.pressure) : 0.5;
      activePtsRef.current.push([wx, wy, pressure]);
    }
    dirtyRef.current = true;
  }

  function onUp(e: React.PointerEvent) {
    if (e.pointerType !== "touch") e.preventDefault();
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    cancelAnimationFrame(rafRef.current);

    const pts = activePtsRef.current;
    activePtsRef.current = [];

    if (pts.length >= 1 && tool !== "eraser") {
      const drawTool = activeToolRef.current;
      const done: Stroke = {
        id:      crypto.randomUUID(),
        tool:    drawTool,
        points:  pts,
        color:   activeColorRef.current,
        width:   activeWidthRef.current,
        opacity: TOOL_OPACITY[drawTool],
      };
      redoStackRef.current = [];
      const next = [...myStrokesRef.current, done];
      myStrokesRef.current = next;
      setMyStrokes(next);   // one React update per stroke
      scheduleSave();
      notifyHistory();
    }
    // Final render with committed stroke
    render();
  }

  // Cursor
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
        pointerEvents:      tool === "hand" ? "none" : "auto",
        touchAction:        "none",
        WebkitTouchCallout: "none",
        WebkitUserSelect:   "none",
        userSelect:         "none",
      }}
    >
      <canvas
        ref={canvasRef}
        className="drawing-canvas-el"
        style={{ cursor }}
        onPointerDown={(e) => {
          if (tool !== "hand" && e.pointerType !== "touch") e.preventDefault();
          onDown(e);
        }}
        onPointerMove={onMove}
        onPointerUp={(e)     => onUp(e)}
        onPointerCancel={(e) => onUp(e)}
      />
    </div>
  );
});

export default DrawingCanvas;
