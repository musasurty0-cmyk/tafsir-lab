"use client";

/**
 * FocusAnnotation — true infinite-canvas word/ayah annotation workspace.
 *
 * Architecture
 * ────────────
 * Everything that lives "on the page" exists in a single world-coordinate
 * space.  A viewport transform { x, y, zoom } maps world → screen:
 *
 *   screen = world × zoom + offset
 *
 * Two layers share the same transform so they stay in sync:
 *
 *   fa-world   — CSS-transformed div that holds the Arabic verse display.
 *                Its inline `transform: translate(vp.x, vp.y) scale(vp.zoom)`
 *                is driven by React state.
 *
 *   fa-canvas  — <canvas> element.  The render() function applies the same
 *                transform via ctx.translate / ctx.scale before drawing
 *                strokes.  viewportRef is used (not state) so RAF reads the
 *                latest value without waiting for a React render.
 *
 * Because both layers share the viewport, panning / zooming moves the Arabic
 * text AND all strokes together as one coherent world.
 *
 * Input handling
 * ──────────────
 * • Mouse / Apple Pencil   → React pointer events (onPointerDown/Move/Up)
 * • Finger touch pan       → native touchstart/move/end (single finger)
 * • Pinch-zoom             → native touch events (two fingers)
 * • Scroll-wheel zoom      → passive:false wheel listener
 * • Stylus touches         → skipped in native touch handler (pointer events
 *                            already cover them)
 *
 * Sidebar
 * ───────
 * The right notes panel collapses to zero width.  The toggle button floats
 * at the canvas's right edge and is always reachable.
 *
 * Storage
 * ───────
 * Strokes and text notes persist in localStorage keyed per word/ayah.
 * Viewport is reset on every open so the word is always centred initially.
 *
 * Keyboard
 *   H / P / L / A / E  — switch tool
 *   ⌘Z / Ctrl+Z        — undo last stroke
 *   Escape              — close
 */

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
} from "react";
import { createPortal } from "react-dom";
import { isTypingTarget } from "@/lib/is-typing";
import type { Verse } from "@/lib/types";
import type { DrawTool } from "./DrawingCanvas";
import CanvasToolRail, {
  DEFAULT_PEN_COLOR, DEFAULT_PEN_SIZE,
  DEFAULT_HIGHLIGHT_COLOR, DEFAULT_HIGHLIGHT_SIZE,
} from "./CanvasToolRail";

// ── Types ──────────────────────────────────────────────────────────────────

interface Point    { x: number; y: number; }
interface Viewport { x: number; y: number; zoom: number; }

interface Stroke {
  id:      string;
  tool:    Exclude<DrawTool, "hand" | "eraser">;
  points:  Point[];
  color:   string;
  width:   number;
  opacity: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ZOOM_MIN     = 0.15;
const ZOOM_MAX     = 5.0;
const ERASER_RADIUS = 15;

const TOOL_OPACITY: Record<"pen" | "highlight" | "arrow", number> = {
  pen:       1.00,
  highlight: 0.40,
  arrow:     1.00,
};

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ── Storage ────────────────────────────────────────────────────────────────

function storageKey(vk: string, wp: number | null) { return `tl-focus-${vk}-${wp ?? "ayah"}`; }

function loadStrokes(vk: string, wp: number | null): Stroke[] {
  try { const r = localStorage.getItem(storageKey(vk, wp)); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function saveStrokes(vk: string, wp: number | null, s: Stroke[]) {
  try { localStorage.setItem(storageKey(vk, wp), JSON.stringify(s)); }
  catch { /* quota */ }
}

// ── Math ───────────────────────────────────────────────────────────────────

function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function strokeHit(s: Stroke, cx: number, cy: number, r: number) {
  const p = s.points;
  if (!p.length) return false;
  if (p.length === 1) return Math.hypot(cx - p[0].x, cy - p[0].y) < r;
  for (let i = 0; i < p.length - 1; i++)
    if (distSeg(cx, cy, p[i].x, p[i].y, p[i + 1].x, p[i + 1].y) < r) return true;
  return false;
}

// ── Canvas rendering ───────────────────────────────────────────────────────

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (!s.points.length) return;
  ctx.save();
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = s.color;
  ctx.lineWidth   = s.width;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  if (s.tool === "arrow") {
    const p0 = s.points[0], p1 = s.points[s.points.length - 1];
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const hl  = Math.max(14, s.width * 5);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x - hl * Math.cos(ang - 0.38), p1.y - hl * Math.sin(ang - 0.38));
    ctx.lineTo(p1.x - hl * Math.cos(ang + 0.38), p1.y - hl * Math.sin(ang + 0.38));
    ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    if (s.points.length === 1) {
      ctx.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2);
      ctx.fillStyle = s.color; ctx.fill();
    } else if (s.points.length === 2) {
      ctx.lineTo(s.points[1].x, s.points[1].y); ctx.stroke();
    } else {
      for (let i = 1; i < s.points.length - 1; i++) {
        const mx = (s.points[i].x + s.points[i + 1].x) / 2;
        const my = (s.points[i].y + s.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(s.points[i].x, s.points[i].y, mx, my);
      }
      ctx.lineTo(s.points[s.points.length - 1].x, s.points[s.points.length - 1].y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  verses:         Verse[];
  verseKey:       string;
  wordPos:        number | null;
  onClose:        () => void;
  onOpenTafsir?:  (verseKey: string) => void; // kept for compat; button removed
}

// ── Component ─────────────────────────────────────────────────────────────

export default function FocusAnnotation({
  verses, verseKey, wordPos, onClose,
}: Props) {
  const [, ayahNumStr] = verseKey.split(":");
  const ayahNum = Number(ayahNumStr);
  const verse   = verses.find((v) => v.verse_key === verseKey) ?? verses[0];

  // ── Tool + colour/size settings ────────────────────────────────────────
  const [tool,     setTool]     = useState<DrawTool>("pen");
  const [penColor, setPenColor] = useState(DEFAULT_PEN_COLOR);
  const [penSize,  setPenSize]  = useState(DEFAULT_PEN_SIZE);
  const [hlColor,  setHlColor]  = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [hlSize,   setHlSize]   = useState(DEFAULT_HIGHLIGHT_SIZE);
  const toolRef = useRef(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);

  // ── Viewport (world-coordinate transform) ─────────────────────────────
  // viewportRef is used directly in render() and event handlers.
  // viewport state drives the CSS transform on fa-world and triggers React renders.
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const viewportRef = useRef<Viewport>(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  // ── Stroke state ───────────────────────────────────────────────────────
  const [strokes, setStrokes]  = useState<Stroke[]>([]);
  const strokesRef             = useRef<Stroke[]>([]);
  const activeStroke           = useRef<Stroke | null>(null);
  const isDrawing              = useRef(false);
  const canvasRef              = useRef<HTMLCanvasElement>(null);
  const bodyRef                = useRef<HTMLDivElement>(null); // fa-body (canvas area)
  const rafRef                 = useRef<number>(0);

  // ── Panning (pointer-event based, mouse + pen) ─────────────────────────
  const isPanning    = useRef(false);
  const panStartRef  = useRef<{ mx: number; my: number; vx: number; vy: number } | null>(null);

  // ── Stroke ↔ ref sync ──────────────────────────────────────────────────
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  // ── Load persisted data on mount / focus change ────────────────────────
  useEffect(() => {
    const loaded = loadStrokes(verseKey, wordPos);
    setStrokes(loaded);
    strokesRef.current = loaded;
  }, [verseKey, wordPos]);

  // ── Viewport initialisation — centre on the TAPPED WORD, fit to screen ─
  // The Arabic display is centred around world (0,0) via CSS
  // transform(-50%,-50%). Long ayahs make the block very tall, so centring
  // the block's MIDDLE used to push the tapped word (and the ayah marker)
  // off-screen on tablets. Instead:
  //   • zoom fits the block width inside the visible area (never > 1)
  //   • word mode  → the tapped word lands at the visual centre
  //   • ayah mode  → the START of the verse sits just below the toolbar
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();

    const display = el.querySelector<HTMLElement>(".fa-arabic-display");
    if (!display || !display.offsetWidth) {
      const init: Viewport = { x: width / 2, y: height / 2, zoom: 1 };
      viewportRef.current = init;
      setViewport(init);
      return;
    }

    // offsetWidth/Height ignore transforms → true world-unit block size
    const W = display.offsetWidth;
    const H = display.offsetHeight;
    // Floor 0.3 so even narrow phones can fit the full block width.
    const zoom = Math.max(0.3, Math.min(1, (width - 24) / W));

    // World coords of the block's top-left (block centred on world origin)
    const blockLeft = -W / 2;
    const blockTop  = -H / 2;

    let targetWX = 0; // world point to bring to screen focus
    let targetWY: number;

    const focusEl = display.querySelector<HTMLElement>(".fa-word--focus");
    if (focusEl) {
      targetWX = blockLeft + focusEl.offsetLeft + focusEl.offsetWidth / 2;
      targetWY = blockTop  + focusEl.offsetTop  + focusEl.offsetHeight / 2;
    } else {
      // Ayah mode: show the verse from its beginning
      targetWY = blockTop + Math.min(H / 2, height * 0.35 / zoom);
    }

    const init: Viewport = {
      x:    width / 2 - targetWX * zoom,
      y:    Math.min(height / 2, height * 0.45) - targetWY * zoom,
      zoom,
    };
    viewportRef.current = init;
    setViewport(init);
  // re-centre when the focus target changes; bodyRef is stable
   
  }, [verseKey, wordPos]);

  // ── Canvas render ──────────────────────────────────────────────────────
  // viewportRef is read directly so the RAF always sees the freshest value.

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const body   = bodyRef.current;
    if (!canvas || !body) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = body.getBoundingClientRect();
    const w = Math.round(width * dpr), h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w; canvas.height = h;
      canvas.style.width  = `${Math.round(width)}px`;
      canvas.style.height = `${Math.round(height)}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    // Apply world-space viewport transform — same formula as fa-world CSS
    const vp = viewportRef.current;
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.zoom, vp.zoom);
    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (activeStroke.current) drawStroke(ctx, activeStroke.current);
    ctx.restore();
  }, []);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }, [render, strokes]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(render);
    });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [render]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", prevent);
    return () => el.removeEventListener("contextmenu", prevent);
  }, []);

  // ── Wheel zoom ─────────────────────────────────────────────────────────

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      /* Exponential, matching the canvas and the board. The old linear form
         `zoom + zoom * delta * 10` multiplied by zero at deltaY=100 — one mouse
         notch snapped straight to the minimum instead of stepping. */
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const step = clamp(e.deltaY * unit * 0.0015, -0.18, 0.18);
      const prev    = viewportRef.current;
      const newZoom = clamp(prev.zoom * Math.exp(-step), ZOOM_MIN, ZOOM_MAX);
      const rect    = el!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const scale   = newZoom / prev.zoom;
      const next: Viewport = { zoom: newZoom, x: mx - (mx - prev.x) * scale, y: my - (my - prev.y) * scale };
      viewportRef.current = next;
      setViewport(next);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(render);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [render]);

  // ── Native touch events — pan (1 finger) + pinch-zoom (2 fingers) ─────
  // We use native touch events (not React pointer events) for touch input:
  //   • We can call preventDefault to block browser scroll / native zoom.
  //   • Apple Pencil sends touchType:"stylus" alongside pointer events;
  //     we skip those entirely so pointer events continue to handle drawing.

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const pts = new Map<number, { x: number; y: number }>();
    let touchPan:   { id: number; tx: number; ty: number; vx: number; vy: number } | null = null;
    let touchPinch: { dist: number; zoom: number; wx: number; wy: number } | null = null;

    function isInteractive(e: TouchEvent) {
      return !!(e.target as HTMLElement).closest(
        'button, a, input, select, textarea, [role="button"]',
      );
    }
    function isStylus(e: TouchEvent) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if ((e.changedTouches[i] as Touch & { touchType?: string }).touchType === "stylus") return true;
      }
      return false;
    }

    function onTouchStart(e: TouchEvent) {
      if (isStylus(e)) return; // pointer events handle stylus
      if (isInteractive(e)) return;
      e.preventDefault();
      for (const t of e.changedTouches) pts.set(t.identifier, { x: t.clientX, y: t.clientY });

      if (pts.size === 1) {
        touchPinch = null;
        const [[id, p]] = pts.entries();
        const vp = viewportRef.current;
        touchPan = { id, tx: p.x, ty: p.y, vx: vp.x, vy: vp.y };
      } else if (pts.size >= 2) {
        touchPan = null;
        const [a, b] = pts.values();
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const rect  = el!.getBoundingClientRect();
        const cx = (a.x + b.x) / 2 - rect.left;
        const cy = (a.y + b.y) / 2 - rect.top;
        const vp = viewportRef.current;
        touchPinch = {
          dist, zoom: vp.zoom,
          wx: (cx - vp.x) / vp.zoom,
          wy: (cy - vp.y) / vp.zoom,
        };
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (isStylus(e)) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (pts.has(t.identifier)) pts.set(t.identifier, { x: t.clientX, y: t.clientY });
      }

      if (pts.size >= 2 && touchPinch) {
        const [a, b] = pts.values();
        const dist   = Math.hypot(b.x - a.x, b.y - a.y);
        const rect   = el!.getBoundingClientRect();
        const cx = (a.x + b.x) / 2 - rect.left;
        const cy = (a.y + b.y) / 2 - rect.top;
        const newZoom = clamp(touchPinch.zoom * (dist / touchPinch.dist), ZOOM_MIN, ZOOM_MAX);
        const next: Viewport = {
          zoom: newZoom,
          x: cx - touchPinch.wx * newZoom,
          y: cy - touchPinch.wy * newZoom,
        };
        viewportRef.current = next;
        setViewport(next);
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(render);
      } else if (pts.size === 1 && touchPan) {
        const p = pts.get(touchPan.id);
        if (!p) return;
        const next: Viewport = {
          ...viewportRef.current,
          x: touchPan.vx + (p.x - touchPan.tx),
          y: touchPan.vy + (p.y - touchPan.ty),
        };
        viewportRef.current = next;
        setViewport(next);
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(render);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!isInteractive(e)) e.preventDefault();
      for (const t of e.changedTouches) pts.delete(t.identifier);
      if (pts.size < 2) touchPinch = null;
      if (pts.size === 0) touchPan = null;
    }

    el.addEventListener("touchstart",  onTouchStart,  { passive: false });
    el.addEventListener("touchmove",   onTouchMove,   { passive: false });
    el.addEventListener("touchend",    onTouchEnd,    { passive: false });
    el.addEventListener("touchcancel", onTouchEnd,    { passive: false });
    return () => {
      el.removeEventListener("touchstart",  onTouchStart);
      el.removeEventListener("touchmove",   onTouchMove);
      el.removeEventListener("touchend",    onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [render]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      /* Same defect as the canvas: contenteditable containers were not
         covered, so typing switched tools. */
      if (isTypingTarget(e)) return;
      if (e.key === "h") setTool("hand");
      if (e.key === "p") setTool("pen");
      if (e.key === "l") setTool("highlight");
      if (e.key === "a") setTool("arrow");
      if (e.key === "e") setTool("eraser");
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setStrokes((prev) => {
          const next = prev.slice(0, -1);
          strokesRef.current = next;
          saveStrokes(verseKey, wordPos, next);
          return next;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, verseKey, wordPos]);

  // ── Screen → world coordinate conversion ──────────────────────────────

  function toWorld(e: React.PointerEvent): Point {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const vp   = viewportRef.current;
    return {
      x: (e.clientX - rect.left - vp.x) / vp.zoom,
      y: (e.clientY - rect.top  - vp.y) / vp.zoom,
    };
  }

  // ── Eraser ─────────────────────────────────────────────────────────────

  function eraseAt(wx: number, wy: number) {
    setStrokes((prev) => {
      const next = prev.filter((s) => !strokeHit(s, wx, wy, ERASER_RADIUS / viewportRef.current.zoom));
      if (next.length !== prev.length) {
        strokesRef.current = next;
        saveStrokes(verseKey, wordPos, next);
      }
      return next;
    });
  }

  // ── Pointer events (mouse + Apple Pencil only — touch handled above) ───

  function onDown(e: React.PointerEvent) {
    if (e.pointerType === "touch") return; // handled by native touch events

    // Pan with hand tool
    if (tool === "hand") {
      isPanning.current = true;
      panStartRef.current = {
        mx: e.clientX, my: e.clientY,
        vx: viewportRef.current.x, vy: viewportRef.current.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = toWorld(e);
    if (tool === "eraser") { eraseAt(pt.x, pt.y); return; }

    const color   = tool === "highlight" ? hlColor : penColor;
    const width   = tool === "highlight" ? hlSize  : penSize;
    const opacity = TOOL_OPACITY[tool as "pen" | "highlight" | "arrow"] ?? 1.0;

    isDrawing.current    = true;
    activeStroke.current = {
      id: crypto.randomUUID(),
      tool:    tool as Exclude<DrawTool, "hand" | "eraser">,
      points:  [pt], color, width, opacity,
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }

  function onMove(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;

    if (isPanning.current && panStartRef.current) {
      const ps   = panStartRef.current;
      const next: Viewport = {
        ...viewportRef.current,
        x: ps.vx + (e.clientX - ps.mx),
        y: ps.vy + (e.clientY - ps.my),
      };
      viewportRef.current = next;
      setViewport(next);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(render);
      return;
    }

    if (!isDrawing.current || !activeStroke.current) return;
    const pt = toWorld(e);
    if (tool === "eraser") { if (e.buttons & 1) eraseAt(pt.x, pt.y); return; }
    if (activeStroke.current.tool === "arrow") {
      activeStroke.current = {
        ...activeStroke.current, points: [activeStroke.current.points[0], pt],
      };
    } else {
      activeStroke.current.points.push(pt);
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }

  function onUp() {
    if (isPanning.current) {
      isPanning.current = false; panStartRef.current = null; return;
    }
    if (!isDrawing.current || !activeStroke.current) return;
    isDrawing.current = false;
    const done = activeStroke.current;
    activeStroke.current = null;
    if (done.points.length >= 1) {
      setStrokes((prev) => {
        const next = [...prev, done];
        strokesRef.current = next;
        saveStrokes(verseKey, wordPos, next);
        return next;
      });
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }

  // ── Undo / clear ───────────────────────────────────────────────────────

  function undo() {
    setStrokes((prev) => {
      const next = prev.slice(0, -1);
      strokesRef.current = next;
      saveStrokes(verseKey, wordPos, next);
      return next;
    });
  }
  function clearAll() {
    setStrokes([]); strokesRef.current = [];
    saveStrokes(verseKey, wordPos, []);
  }

  // ── Derived ────────────────────────────────────────────────────────────

  const focusWord = wordPos != null
    ? verse?.words.find((w) => w.char_type_name === "word" && w.position === wordPos)
    : null;

  const cursor =
    tool === "hand"   ? (isPanning.current ? "grabbing" : "grab")
    : tool === "eraser" ? "cell"
    : "crosshair";

  // CSS transform that maps world → screen (applied to fa-world div)
  const worldTransform = `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})`;

  // ── Render ─────────────────────────────────────────────────────────────
  // Docked as a right-side panel over the SAME Mushaf page (no separate
  // screen, no dim). Portaled to <body> so no transformed/overflow ancestor
  // can hijack the fixed positioning (this was silently breaking tablets).

  return createPortal(
    <div className="fa-overlay">

      {/* ── Top bar ── */}
      <div className="fa-toolbar">
        <div className="fa-toolbar-label">
          {focusWord
            ? <><span dir="rtl" className="fa-label-ar">{focusWord.text}</span><span className="fa-label-ref">· {verseKey}</span></>
            : <span className="fa-label-ref">Ayah {ayahNum} · {verseKey}</span>
          }
        </div>
        <button className="fa-close-btn" onClick={onClose} title="Close (Esc)">×</button>
      </div>

      {/* ── Main row: rail | infinite canvas | collapsible sidebar ── */}
      <div className="fa-main">

        {/* Tool rail */}
        <div className="fa-rail">
          <CanvasToolRail
            activeTool={tool}
            onToolChange={setTool}
            penColor={penColor}
            onPenColorChange={setPenColor}
            highlightColor={hlColor}
            onHighlightColorChange={setHlColor}
            strokeSize={tool === "highlight" ? hlSize : penSize}
            onStrokeSizeChange={tool === "highlight" ? setHlSize : setPenSize}
            canUndo={strokes.length > 0}
            canRedo={false}
            onUndo={undo}
            onRedo={() => {}}
            onClear={clearAll}
          />
        </div>

        {/* ── Infinite canvas area ── */}
        <div
          ref={bodyRef}
          className="fa-body"
          style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as React.CSSProperties}
        >

          {/* World — CSS-transformed container holding the Arabic text.
              The canvas layer uses the same transform via ctx, so they stay in sync. */}
          <div
            className="fa-world"
            style={{ transform: worldTransform }}
            aria-hidden="true"
          >
            <div className="fa-arabic-display" dir="rtl">
              {verse?.words.map((w) => {
                if (w.char_type_name === "end") {
                  return (
                    <span key={`end-${w.position}`} className="fa-ayah-end">
                      ﴿{ayahNum}﴾{" "}
                    </span>
                  );
                }
                const isTarget = wordPos != null && w.position === wordPos;
                return (
                  <span key={w.position} className={`fa-word${isTarget ? " fa-word--focus" : ""}`}>
                    {w.text}{" "}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Drawing canvas — fills the visible area, renders strokes in world space */}
          <canvas
            ref={canvasRef}
            className="fa-canvas"
            style={{ cursor, zIndex: 2 }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>

      </div>
    </div>,
    document.body,
  );
}
