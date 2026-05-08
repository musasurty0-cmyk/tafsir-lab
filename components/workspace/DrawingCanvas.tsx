"use client";

/**
 * DrawingCanvas — smooth freehand annotation overlay for Mode B.
 *
 * Rendering strategy
 * ──────────────────
 * Every active stroke is stored as an array of [x, y, pressure] world-space
 * points in a ref.  On every RAF tick we CLEAR the canvas and redraw the
 * entire accumulated path from scratch using the midpoint-quadratic algorithm:
 *
 *   moveTo(p[0])
 *   for i = 1 … n-2:  quadraticCurveTo(p[i], mid(p[i], p[i+1]))
 *   lineTo(p[n-1])
 *
 * Each pointer sample is a bezier CONTROL point, and each midpoint is the
 * through-point.  This chains quadratic arcs into one continuous smooth curve
 * with no visible joints between samples — identical to Miro/GoodNotes.
 *
 * Performance
 * ───────────
 * • All active-stroke data lives in refs → zero React re-renders during drawing.
 * • scheduleRender() = cancelAnimationFrame + requestAnimationFrame(render).
 *   Only one paint per browser frame regardless of pointer-event frequency.
 * • getCoalescedEvents() collects every OS digitiser sample between events.
 * • React state is updated exactly once per stroke, on pointerup.
 *
 * Input routing (unchanged)
 * ─────────────────────────
 * • touch  → returns immediately; ModeBPage handles panning via touch events
 * • pen    → draws (real pressure from e.pressure)
 * • mouse  → draws (constant pressure 0.5)
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

// [x, y, pressure] in world (canvas) coordinates
type Pt = [number, number, number];

export interface Stroke {
  id:      string;
  tool:    "pen" | "highlight" | "arrow";
  points:  Pt[];
  color:   string;
  width:   number;
  opacity: number;
}

interface DrawingLayer {
  authorId:   string;
  authorName: string;
  strokes:    Stroke[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const TOOL_OPACITY: Record<"pen" | "highlight" | "arrow", number> = {
  pen:       1.00,
  highlight: 0.40,
  arrow:     1.00,
};

const ERASER_RADIUS = 20;
const SAVE_DEBOUNCE = 1200;

// ── Backwards compatibility ────────────────────────────────────────────────
// Old strokes were stored as {x, y} objects; new ones as [x, y, pressure].

function normPts(raw: unknown[]): Pt[] {
  if (!raw.length) return [];
  if (Array.isArray(raw[0])) return raw as Pt[];
  return (raw as { x: number; y: number }[]).map(p => [p.x, p.y, 0.5]);
}

// ── Geometry helpers ───────────────────────────────────────────────────────

function distToSeg(
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

function hitTest(pts: Pt[], cx: number, cy: number, r: number): boolean {
  if (!pts.length) return false;
  if (pts.length === 1) return Math.hypot(cx - pts[0][0], cy - pts[0][1]) < r;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSeg(cx, cy, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < r) return true;
  }
  return false;
}

// ── Core rendering ─────────────────────────────────────────────────────────
//
// drawSmooth: renders pts as one continuous smooth curve using the midpoint-
// quadratic technique.  lineCap/lineJoin = "round" ensures seamless joins.
// This is the only rendering path for pen and highlight — no segment-by-segment
// drawing, no incremental appending.

function drawSmooth(
  ctx:     CanvasRenderingContext2D,
  pts:     Pt[],
  color:   string,
  width:   number,
  opacity: number,
) {
  if (!pts.length) return;
  ctx.save();
  ctx.globalAlpha   = opacity;
  ctx.strokeStyle   = color;
  ctx.fillStyle     = color;
  ctx.lineWidth     = width;
  ctx.lineCap       = "round";
  ctx.lineJoin      = "round";
  ctx.imageSmoothingEnabled = true;

  if (pts.length === 1) {
    // Isolated tap → filled circle so it's visible
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);

  if (pts.length === 2) {
    ctx.lineTo(pts[1][0], pts[1][1]);
  } else {
    // Chain quadratic arcs: control = pts[i], through-point = mid(pts[i], pts[i+1])
    // This makes the line pass smoothly THROUGH every midpoint with no joints.
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  }

  ctx.stroke();
  ctx.restore();
}

function drawArrow(
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

function paintStroke(ctx: CanvasRenderingContext2D, s: Stroke, alphaScale = 1) {
  const pts = normPts(s.points as unknown[]);
  if (s.tool === "arrow") { drawArrow(ctx, pts, s.color, s.width); return; }
  drawSmooth(ctx, pts, s.color, s.width, s.opacity * alphaScale);
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const hlCanvasRef  = useRef<HTMLCanvasElement | null>(null);
  const rafRef       = useRef<number>(0);

  // ── Active stroke — entirely in refs, zero re-renders during drawing ──
  const isDrawingRef   = useRef(false);
  const activePtsRef   = useRef<Pt[]>([]);
  const activeToolRef  = useRef<"pen" | "highlight" | "arrow">("pen");
  const activeColorRef = useRef(strokeColor);
  const activeWidthRef = useRef(strokeWidth);

  // ── Committed strokes ─────────────────────────────────────────────────
  const viewportRef    = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  const myStrokesRef   = useRef<Stroke[]>([]);
  const [myStrokes, setMyStrokes] = useState<Stroke[]>([]);
  useEffect(() => { myStrokesRef.current = myStrokes; }, [myStrokes]);

  const otherLayersRef = useRef<DrawingLayer[]>([]);
  const [otherLayers, setOtherLayers] = useState<DrawingLayer[]>([]);
  useEffect(() => { otherLayersRef.current = otherLayers; }, [otherLayers]);

  const redoStackRef = useRef<Stroke[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onHistoryRef = useRef(onHistoryChange);
  useEffect(() => { onHistoryRef.current = onHistoryChange; }, [onHistoryChange]);

  // ── render — stable, reads only from refs ─────────────────────────────
  //
  // Called via scheduleRender (RAF) so it never runs more than once per frame.
  // Redraws the entire scene from scratch:
  //   1. Other users' strokes (faded)
  //   2. My non-highlight strokes + active non-highlight stroke
  //   3. All highlight strokes (mine + active) composited via offscreen canvas
  //      at TOOL_OPACITY.highlight to prevent opacity compounding at overlaps

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

    // Helper: apply DPR + viewport transform onto any context
    function applyVP(c: CanvasRenderingContext2D) {
      c.scale(dpr, dpr);
      c.translate(vp.x, vp.y);
      c.scale(vp.zoom, vp.zoom);
    }

    ctx.clearRect(0, 0, w, h);

    // ── Pass 1: other users' strokes ──────────────────────────────────
    ctx.save(); applyVP(ctx);
    for (const layer of otherLayersRef.current) {
      for (const s of layer.strokes) paintStroke(ctx, s, 0.7);
    }
    ctx.restore();

    // ── Pass 2: my non-highlight strokes + active non-highlight ───────
    ctx.save(); applyVP(ctx);
    for (const s of myStrokesRef.current) {
      if (s.tool !== "highlight") paintStroke(ctx, s);
    }
    if (
      isDrawingRef.current &&
      activeToolRef.current !== "highlight" &&
      activePtsRef.current.length > 0
    ) {
      const t = activeToolRef.current;
      if (t === "arrow") {
        drawArrow(ctx, activePtsRef.current, activeColorRef.current, activeWidthRef.current);
      } else {
        drawSmooth(ctx, activePtsRef.current, activeColorRef.current, activeWidthRef.current, TOOL_OPACITY[t]);
      }
    }
    ctx.restore();

    // ── Pass 3: highlight composite ───────────────────────────────────
    // All highlight strokes (committed + active) go onto an offscreen canvas
    // at full opacity, then the whole thing is composited at 0.40 alpha.
    // This prevents consecutive highlight strokes from compounding opacity.
    const hlStrokes = myStrokesRef.current.filter(s => s.tool === "highlight");
    const activeIsHL = isDrawingRef.current && activeToolRef.current === "highlight" && activePtsRef.current.length > 0;

    if (hlStrokes.length > 0 || activeIsHL) {
      if (!hlCanvasRef.current) hlCanvasRef.current = document.createElement("canvas");
      const hl = hlCanvasRef.current;
      if (hl.width !== w || hl.height !== h) { hl.width = w; hl.height = h; }
      const hCtx = hl.getContext("2d");
      if (hCtx) {
        hCtx.clearRect(0, 0, w, h);
        hCtx.save(); applyVP(hCtx);
        for (const s of hlStrokes) {
          const pts = normPts(s.points as unknown[]);
          drawSmooth(hCtx, pts, s.color, s.width, 1);
        }
        if (activeIsHL) {
          drawSmooth(hCtx, activePtsRef.current, activeColorRef.current, activeWidthRef.current, 1);
        }
        hCtx.restore();
        ctx.globalAlpha = TOOL_OPACITY.highlight;
        ctx.drawImage(hl, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
  }, []); // empty deps — reads only from refs, never stale

  // scheduleRender: deduplicates; at most one paint per animation frame
  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }, [render]);

  // Re-render when committed strokes, viewport or other layers change
  useEffect(() => { scheduleRender(); }, [viewport, myStrokes, otherLayers, scheduleRender]);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(scheduleRender);
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [scheduleRender]);

  // ── Data loading ───────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/pages/${pageId}/drawings`)
      .then(r => r.ok ? r.json() : null)
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
        .then(r => r.ok ? r.json() : null)
        .then((d: { myStrokes?: Stroke[]; otherLayers?: DrawingLayer[] } | null) => {
          if (d?.otherLayers) setOtherLayers(d.otherLayers);
        })
        .catch(() => {});
    }, 6000);
    return () => clearInterval(id);
  }, [pageId]);

  // ── Debounced save ─────────────────────────────────────────────────────

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

  // ── iOS suppression ────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", prevent);
    el.addEventListener("selectstart", prevent);
    el.addEventListener("copy",        prevent);
    const preventFingerTouch = (e: TouchEvent) => {
      let hasFinger = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i] as Touch & { touchType?: string };
        if (t.touchType !== "stylus") { hasFinger = true; break; }
      }
      if (hasFinger) e.preventDefault();
    };
    el.addEventListener("touchstart", preventFingerTouch, { passive: false });
    return () => {
      el.removeEventListener("contextmenu",  prevent);
      el.removeEventListener("selectstart",  prevent);
      el.removeEventListener("copy",         prevent);
      el.removeEventListener("touchstart",   preventFingerTouch);
    };
  }, []);

  // ── Imperative handle ──────────────────────────────────────────────────

  function notifyHistory() {
    onHistoryRef.current?.(
      myStrokesRef.current.length > 0,
      redoStackRef.current.length > 0,
    );
  }

  useImperativeHandle(ref, () => ({
    undo() {
      const prev = myStrokesRef.current;
      if (!prev.length) return;
      redoStackRef.current = [...redoStackRef.current, prev[prev.length - 1]];
      const next = prev.slice(0, -1);
      myStrokesRef.current = next;
      setMyStrokes(next);
      scheduleSave(); notifyHistory();
    },
    redo() {
      const stack = redoStackRef.current;
      if (!stack.length) return;
      const stroke = stack[stack.length - 1];
      redoStackRef.current = stack.slice(0, -1);
      const next = [...myStrokesRef.current, stroke];
      myStrokesRef.current = next;
      setMyStrokes(next);
      scheduleSave(); notifyHistory();
    },
    clear() {
      redoStackRef.current = [];
      myStrokesRef.current = [];
      setMyStrokes([]);
      scheduleSave();
      onHistoryRef.current?.(false, false);
    },
  }), [scheduleSave]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Coordinate helpers ─────────────────────────────────────────────────

  function toWorld(clientX: number, clientY: number): [number, number] {
    const el = containerRef.current!;
    const rect = el.getBoundingClientRect();
    const vp   = viewportRef.current;
    return [
      (clientX - rect.left - vp.x) / vp.zoom,
      (clientY - rect.top  - vp.y) / vp.zoom,
    ];
  }

  // ── Eraser ─────────────────────────────────────────────────────────────

  function eraseAt(wx: number, wy: number) {
    const r    = ERASER_RADIUS / viewportRef.current.zoom;
    const prev = myStrokesRef.current;
    const next = prev.filter(s => !hitTest(normPts(s.points as unknown[]), wx, wy, r));
    if (next.length !== prev.length) {
      redoStackRef.current = [];
      myStrokesRef.current = next;
      setMyStrokes(next);
      scheduleSave(); notifyHistory();
    }
  }

  // ── Pointer handlers ───────────────────────────────────────────────────

  function onDown(e: React.PointerEvent) {
    if (tool === "hand" || e.pointerType === "touch") return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const [wx, wy] = toWorld(e.clientX, e.clientY);
    if (tool === "eraser") { eraseAt(wx, wy); return; }

    const pressure = e.pointerType === "pen" ? Math.max(0.1, e.pressure) : 0.5;
    isDrawingRef.current   = true;
    activeToolRef.current  = tool as "pen" | "highlight" | "arrow";
    activeColorRef.current = strokeColor;
    activeWidthRef.current = strokeWidth;
    activePtsRef.current   = [[wx, wy, pressure]];
    scheduleRender();
  }

  function onMove(e: React.PointerEvent) {
    if (tool === "hand" || e.pointerType === "touch") return;
    if (!isDrawingRef.current) return;
    e.stopPropagation();

    // Collect every OS digitiser sample buffered between pointer events
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events) {
      const [wx, wy] = toWorld(ev.clientX, ev.clientY);
      if (tool === "eraser") { if (e.buttons & 1) eraseAt(wx, wy); continue; }
      const pressure = ev.pointerType === "pen" ? Math.max(0.1, ev.pressure) : 0.5;
      activePtsRef.current.push([wx, wy, pressure]);
    }

    scheduleRender(); // redraws full accumulated stroke on next frame
  }

  function onUp(e: React.PointerEvent) {
    if (e.pointerType !== "touch") e.preventDefault();
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
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
      setMyStrokes(next); // one React update per completed stroke
      scheduleSave();
      notifyHistory();
    }

    scheduleRender();
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
        onPointerDown={e => {
          if (tool !== "hand" && e.pointerType !== "touch") e.preventDefault();
          onDown(e);
        }}
        onPointerMove={onMove}
        onPointerUp={e     => onUp(e)}
        onPointerCancel={e => onUp(e)}
      />
    </div>
  );
});

export default DrawingCanvas;
