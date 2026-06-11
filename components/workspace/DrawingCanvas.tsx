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
 * Canvas sizing (fix #4 — pixelation)
 * ────────────────────────────────────
 * Canvas physical dimensions = container.offsetWidth/Height × devicePixelRatio.
 * offsetWidth/Height are always integer CSS pixels → no fractional rounding.
 * We never set canvas.style.width/height from JS — CSS width:100%;height:100%
 * handles display size.  After setting width/height attributes the context is
 * reset automatically; applyVP re-applies the DPR + viewport transform each frame.
 *
 * Page-scoped drawings (fix #8)
 * ─────────────────────────────
 * Each Stroke now carries an optional `mushafPage` field.  On render, only
 * strokes whose mushafPage === currentMushafahPage (or whose mushafPage is
 * absent, for legacy data) are shown.  New strokes are tagged with the current
 * page on creation.
 *
 * Input routing (fix #6)
 * ──────────────────────
 * • touch  → returns immediately; ModeBPage handles panning via touch events
 * • pen    → draws (real pressure from e.pressure)
 * • mouse  → draws (constant pressure 0.5)
 * • hand tool → always returns early regardless of pointer type
 */

import {
  forwardRef, useCallback, useEffect, useImperativeHandle,
  useRef, useState,
} from "react";
import type { CanvasViewport } from "./ModeBPage";

// ── Public types ───────────────────────────────────────────────────────────

export type DrawTool = "hand" | "pen" | "highlight" | "arrow" | "eraser" | "text";

export interface DrawingCanvasHandle {
  undo:  () => void;
  redo:  () => void;
  clear: () => void;
}

// [x, y, pressure] in world (canvas) coordinates
type Pt = [number, number, number];

export interface Stroke {
  id:          string;
  tool:        "pen" | "highlight" | "arrow";
  points:      Pt[];
  color:       string;
  width:       number;
  opacity:     number;
  mushafPage?: number; // which Mushaf page this stroke belongs to (fix #8)
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

  if (pts.length === 1) {
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
  pageId:            string;
  mushafPage:        number;  // current Mushaf page — used to scope drawings (fix #8)
  tool:              DrawTool;
  strokeColor:       string;
  strokeWidth:       number;
  viewport:          CanvasViewport;
  roomSocket?:       import("partysocket").default | null;
  onHistoryChange?:  (canUndo: boolean, canRedo: boolean) => void;
  /** Text tool: called with world-space coordinates when the user clicks
   *  the canvas to place a free text box. */
  onTextPlace?:      (worldX: number, worldY: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(function DrawingCanvas(
  { pageId, mushafPage, tool, strokeColor, strokeWidth, viewport, roomSocket, onHistoryChange, onTextPlace },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const hlCanvasRef  = useRef<HTMLCanvasElement | null>(null);
  const rafRef       = useRef<number>(0);

  // ── tool ref — always current, safe in event-handler closures (fix #6) ──
  const toolRef = useRef(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);

  // ── Active stroke — entirely in refs, zero re-renders during drawing ──
  const isDrawingRef   = useRef(false);
  const activePtsRef   = useRef<Pt[]>([]);
  const activeToolRef  = useRef<"pen" | "highlight" | "arrow">("pen");
  const activeColorRef = useRef(strokeColor);
  const activeWidthRef = useRef(strokeWidth);

  // ── Committed strokes ─────────────────────────────────────────────────
  const viewportRef    = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  const mushafPageRef  = useRef(mushafPage);
  useEffect(() => { mushafPageRef.current = mushafPage; }, [mushafPage]);

  const allMyStrokesRef = useRef<Stroke[]>([]);  // all strokes including other pages
  const myStrokesRef    = useRef<Stroke[]>([]);   // filtered to current mushafPage
  const [myStrokes, setMyStrokes] = useState<Stroke[]>([]);
  useEffect(() => { myStrokesRef.current = myStrokes; }, [myStrokes]);

  const otherLayersRef = useRef<DrawingLayer[]>([]);
  const [otherLayers, setOtherLayers] = useState<DrawingLayer[]>([]);
  useEffect(() => { otherLayersRef.current = otherLayers; }, [otherLayers]);

  // In-progress strokes from remote peers, keyed by connection id
  const remoteActiveRef = useRef<Map<string, {
    points:      Pt[];
    mushafPage?: number;
    color:       string;
    width:       number;
  }>>(new Map());

  const redoStackRef = useRef<Stroke[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onHistoryRef = useRef(onHistoryChange);
  useEffect(() => { onHistoryRef.current = onHistoryChange; }, [onHistoryChange]);

  // Filter strokes for the current Mushaf page.
  // Strokes without mushafPage (legacy, pre-migration) pass through so they
  // remain visible until the migration tags them.
  function filterForPage(strokes: Stroke[], page: number): Stroke[] {
    return strokes.filter(s => s.mushafPage === undefined || s.mushafPage === page);
  }

  // Silently tag + re-save any strokes that lack mushafPage.
  // Called once on initial load.  Fire-and-forget — no UI feedback needed.
  function migrateLegacyStrokes(strokes: Stroke[], toPage: number): {
    migrated: Stroke[];
    changed: boolean;
  } {
    let changed = false;
    const migrated = strokes.map((s) => {
      if (s.mushafPage !== undefined) return s;
      changed = true;
      return { ...s, mushafPage: toPage };
    });
    return { migrated, changed };
  }

  // ── render — stable, reads only from refs ─────────────────────────────
  //
  // Fix #4 (pixelation): use canvas.offsetWidth/Height (always integer CSS
  // pixels) instead of getBoundingClientRect (can return fractions).  Never
  // set canvas.style.width/height from JS — the CSS width:100%;height:100%
  // handles display size.  After setting canvas.width the context transform
  // is reset; applyVP then scales by dpr so all drawing is in CSS-px space.

  const render = useCallback(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Use integer CSS pixel dimensions to avoid sub-pixel rounding (fix #4)
    const dpr  = window.devicePixelRatio || 1;
    const cssW = canvas.offsetWidth  || container.offsetWidth;
    const cssH = canvas.offsetHeight || container.offsetHeight;
    if (!cssW || !cssH) return;

    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);

    // Resize canvas buffer only when dimensions change.
    // Setting .width/.height resets the context — applyVP re-applies transform.
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
      // DO NOT set canvas.style.width/height — CSS width:100%;height:100% owns it
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Global quality settings (affect drawImage for highlight composite)
    ctx.imageSmoothingEnabled = true;
    (ctx as CanvasRenderingContext2D & { imageSmoothingQuality?: string }).imageSmoothingQuality = "high";

    const vp = viewportRef.current;

    // Apply DPR + viewport transform onto any context
    function applyVP(c: CanvasRenderingContext2D) {
      c.scale(dpr, dpr);
      c.translate(vp.x, vp.y);
      c.scale(vp.zoom, vp.zoom);
    }

    ctx.clearRect(0, 0, w, h);

    // ── Pass 1: other users' committed strokes (filtered to current page) ──
    ctx.save(); applyVP(ctx);
    const curPage = mushafPageRef.current;
    for (const layer of otherLayersRef.current) {
      for (const s of layer.strokes) {
        if (s.mushafPage === undefined || s.mushafPage === curPage) {
          paintStroke(ctx, s, 0.7);
        }
      }
    }
    // ── Pass 1b: remote peers' in-progress strokes (live, translucent) ───
    for (const seg of remoteActiveRef.current.values()) {
      const onThisPage = seg.mushafPage === undefined || seg.mushafPage === curPage;
      if (onThisPage && seg.points.length > 0) {
        drawSmooth(ctx, seg.points, seg.color, seg.width, 0.55);
      }
    }
    ctx.restore();

    // ── Pass 2: my non-highlight strokes + active non-highlight ───────────
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

    // ── Pass 3: highlight composite ───────────────────────────────────────
    const hlStrokes  = myStrokesRef.current.filter(s => s.tool === "highlight");
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

  // Re-render when committed strokes, viewport, mushafPage, or other layers change
  useEffect(() => { scheduleRender(); }, [viewport, myStrokes, otherLayers, mushafPage, scheduleRender]);

  // ResizeObserver — re-render on container resize
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
          const curPage = mushafPageRef.current;

          // ── Legacy migration (one-time, silent) ────────────────────────
          // Strokes saved before the mushafPage scoping fix have no
          // mushafPage field.  Tag them to whichever Mushaf page is open
          // now (always the first page of the surah on a fresh load).
          // Re-save immediately — after this the strokes are permanently
          // scoped and will never bleed across pages again.
          const { migrated, changed } = migrateLegacyStrokes(d.myStrokes, curPage);

          allMyStrokesRef.current = migrated;
          const filtered = filterForPage(migrated, curPage);
          setMyStrokes(filtered);
          myStrokesRef.current = filtered;
          onHistoryRef.current?.(filtered.length > 0, false);

          if (changed) {
            // Fire-and-forget — intentionally no error handling / loading state
            fetch(`/api/pages/${pageId}/drawings`, {
              method:  "PUT",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ strokes: migrated }),
            }).catch(() => {});
          }
        }

        if (d.otherLayers) setOtherLayers(d.otherLayers);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // Re-filter when mushaf page changes (fix #8)
  useEffect(() => {
    const filtered = filterForPage(allMyStrokesRef.current, mushafPage);
    setMyStrokes(filtered);
    myStrokesRef.current = filtered;
    onHistoryRef.current?.(filtered.length > 0, redoStackRef.current.length > 0);
  }, [mushafPage]);

  // ── Reconciliation poll (slow) ────────────────────────────────────────
  // Live additions arrive via the socket, but erasures / undo / clear by
  // peers are only persisted to the DB — this poll picks those up and also
  // heals any missed socket messages.
  useEffect(() => {
    if (!pageId) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/pages/${pageId}/drawings`)
        .then(r => r.ok ? r.json() : null)
        .then((d: { otherLayers?: DrawingLayer[] } | null) => {
          if (d?.otherLayers) setOtherLayers(d.otherLayers);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [pageId]);

  // ── Real-time remote strokes via PartyKit socket ──────────────────────
  // • stroke-segment: peer is actively drawing — update remoteActiveRef
  // • stroke-complete: peer finished a stroke — add to otherLayers, clear active
  // Falls back gracefully when no socket is provided (solo / offline).
  useEffect(() => {
    if (!roomSocket) return;

    function onMessage(evt: MessageEvent) {
      if (typeof evt.data !== "string") return;
      let msg: {
        type: string; connectionId?: string; points?: Pt[]; stroke?: Stroke;
        authorId?: string; authorName?: string;
        mushafPage?: number; color?: string; width?: number;
      } = { type: "" };
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === "stroke-segment" && msg.connectionId && msg.points) {
        remoteActiveRef.current.set(msg.connectionId, {
          points:     msg.points,
          mushafPage: msg.mushafPage,
          color:      msg.color ?? "#3b82f6",
          width:      msg.width ?? 3,
        });
        scheduleRender();
        return;
      }

      if (msg.type === "stroke-complete" && msg.connectionId && msg.stroke) {
        remoteActiveRef.current.delete(msg.connectionId);
        setOtherLayers((prev) => {
          const connId     = msg.connectionId!;
          const authorId   = msg.authorId   ?? connId;
          const authorName = msg.authorName ?? "Peer";
          const existing = prev.find((l) => l.authorId === authorId);
          if (existing) {
            return prev.map((l) =>
              l.authorId === authorId
                ? { ...l, strokes: [...l.strokes, msg.stroke!] }
                : l
            );
          }
          return [...prev, { authorId, authorName, strokes: [msg.stroke!] }];
        });
        return;
      }

      if (msg.type === "presence-leave" && msg.connectionId) {
        remoteActiveRef.current.delete(msg.connectionId);
        scheduleRender();
      }
    }

    roomSocket.addEventListener("message", onMessage);
    return () => roomSocket.removeEventListener("message", onMessage);
  }, [roomSocket, scheduleRender]);

  // ── Debounced save ─────────────────────────────────────────────────────

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch(`/api/pages/${pageId}/drawings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ strokes: allMyStrokesRef.current }),
      }).catch(() => {});
    }, SAVE_DEBOUNCE);
  }, [pageId]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    cancelAnimationFrame(rafRef.current);
  }, []);

  // ── iOS / browser interference suppression (fix #6) ────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", prevent);
    el.addEventListener("selectstart", prevent);
    el.addEventListener("copy",        prevent);

    // Prevent finger touches from generating pointer events (which could
    // accidentally trigger draw).  Apple Pencil fires touchType:"stylus" —
    // skip preventDefault for those so their companion PointerEvents still fire.
    const preventFingerTouch = (e: TouchEvent) => {
      // If the current tool is "hand", let ModeBPage's touch handler manage panning
      // without interference.  We only block touch→pointer promotion for drawing tools.
      if (toolRef.current === "hand") return;
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
      // Operate on the current-page view; rebuild allMyStrokes around it
      const prev = myStrokesRef.current;
      if (!prev.length) return;
      const removed = prev[prev.length - 1];
      redoStackRef.current = [...redoStackRef.current, removed];
      const nextPage = prev.slice(0, -1);
      // Remove from allMyStrokes too
      allMyStrokesRef.current = allMyStrokesRef.current.filter(s => s.id !== removed.id);
      myStrokesRef.current = nextPage;
      setMyStrokes(nextPage);
      scheduleSave(); notifyHistory();
    },
    redo() {
      const stack = redoStackRef.current;
      if (!stack.length) return;
      const stroke = stack[stack.length - 1];
      redoStackRef.current = stack.slice(0, -1);
      allMyStrokesRef.current = [...allMyStrokesRef.current, stroke];
      const nextPage = [...myStrokesRef.current, stroke];
      myStrokesRef.current = nextPage;
      setMyStrokes(nextPage);
      scheduleSave(); notifyHistory();
    },
    clear() {
      // Clear only strokes belonging to the current Mushaf page
      const curPage = mushafPageRef.current;
      allMyStrokesRef.current = allMyStrokesRef.current.filter(
        s => s.mushafPage !== undefined && s.mushafPage !== curPage,
      );
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
      // Sync erasures back to allMyStrokes
      const survivingIds = new Set(next.map(s => s.id));
      allMyStrokesRef.current = allMyStrokesRef.current.filter(s => survivingIds.has(s.id) || s.mushafPage !== mushafPageRef.current);
      redoStackRef.current = [];
      myStrokesRef.current = next;
      setMyStrokes(next);
      scheduleSave(); notifyHistory();
    }
  }

  // ── Pointer handlers (fix #6 — touch is always rejected) ──────────────

  function onDown(e: React.PointerEvent) {
    // touch → always handled by ModeBPage native touch handlers (panning)
    if (e.pointerType === "touch") return;
    // hand tool → never draw
    if (toolRef.current === "hand") return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const [wx, wy] = toWorld(e.clientX, e.clientY);
    if (toolRef.current === "text")   { onTextPlace?.(wx, wy); return; }
    if (toolRef.current === "eraser") { eraseAt(wx, wy); return; }

    const pressure = e.pointerType === "pen" ? Math.max(0.1, e.pressure) : 0.5;
    isDrawingRef.current   = true;
    activeToolRef.current  = toolRef.current as "pen" | "highlight" | "arrow";
    activeColorRef.current = strokeColor;
    activeWidthRef.current = strokeWidth;
    activePtsRef.current   = [[wx, wy, pressure]];
    scheduleRender();
  }

  function onMove(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (toolRef.current === "hand") return;
    if (!isDrawingRef.current) return;
    e.stopPropagation();

    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events) {
      const [wx, wy] = toWorld(ev.clientX, ev.clientY);
      if (toolRef.current === "eraser") { if (e.buttons & 1) eraseAt(wx, wy); continue; }
      const pressure = ev.pointerType === "pen" ? Math.max(0.1, ev.pressure) : 0.5;
      activePtsRef.current.push([wx, wy, pressure]);
    }

    // Broadcast active points to peers so they see the stroke in real time
    if (roomSocket?.readyState === WebSocket.OPEN) {
      roomSocket.send(JSON.stringify({
        type:       "stroke-segment",
        points:     activePtsRef.current,
        mushafPage: mushafPageRef.current,
        color:      activeColorRef.current,
        width:      activeWidthRef.current,
      }));
    }

    scheduleRender();
  }

  function onUp(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    e.preventDefault();
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    const pts = activePtsRef.current;
    activePtsRef.current = [];

    if (pts.length >= 1 && toolRef.current !== "eraser") {
      const drawTool = activeToolRef.current;
      const done: Stroke = {
        id:         crypto.randomUUID(),
        tool:       drawTool,
        points:     pts,
        color:      activeColorRef.current,
        width:      activeWidthRef.current,
        opacity:    TOOL_OPACITY[drawTool],
        mushafPage: mushafPageRef.current,
      };
      redoStackRef.current = [];
      allMyStrokesRef.current = [...allMyStrokesRef.current, done];
      const next = [...myStrokesRef.current, done];
      myStrokesRef.current = next;
      setMyStrokes(next);
      scheduleSave();
      notifyHistory();

      // Broadcast completed stroke to peers
      if (roomSocket?.readyState === WebSocket.OPEN) {
        roomSocket.send(JSON.stringify({
          type:   "stroke-complete",
          stroke: done,
        }));
      }
    }

    scheduleRender();
  }

  return (
    <div
      ref={containerRef}
      className="drawing-canvas-wrap"
      style={{
        // hand tool: let pointer events fall through to the Mushaf page below
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
        style={{
          cursor: tool === "pen" || tool === "arrow" ? "crosshair"
                : tool === "highlight"               ? "cell"
                : tool === "eraser"                  ? "cell"
                : tool === "text"                    ? "text"
                : "default",
        }}
        onPointerDown={e => {
          // Don't intercept touch or hand-tool gestures
          if (e.pointerType !== "touch" && tool !== "hand") e.preventDefault();
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
