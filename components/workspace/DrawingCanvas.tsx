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
import {
  type Pt, type InkStroke,
  normPts, hitTest, drawSmooth, drawArrow, paintStroke, strokeSurface,
} from "@/lib/ink";

// ── Public types ───────────────────────────────────────────────────────────

export type DrawTool = "hand" | "pen" | "highlight" | "arrow" | "eraser" | "text";

export interface DrawingCanvasHandle {
  undo:  () => void;
  redo:  () => void;
  clear: () => void;
}

// Stroke shape + rendering live in lib/ink (shared with the editor ink
// overlay). Canvas strokes are world-space, tagged surface:"canvas".
export type Stroke = InkStroke;

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

// (normPts / hitTest / drawSmooth / drawArrow / paintStroke now live in lib/ink)

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  pageId:            string;
  mushafPage:        number;  // current Mushaf page — used to scope drawings (fix #8)
  tool:              DrawTool;
  strokeColor:       string;
  strokeWidth:       number;
  viewport:          CanvasViewport;
  roomSocket?:       import("partysocket").default | null;
  /** Active annotation layer ("w:1:2:5" word / "a:1:2" ayah) or null for
   *  the normal page. Anchored strokes render only when their layer is
   *  active; new strokes are tagged with the active layer. */
  activeAnchor?:     string | null;
  onHistoryChange?:  (canUndo: boolean, canRedo: boolean) => void;
  /** Text tool: called with world-space coordinates when the user clicks
   *  the canvas to place a free text box. */
  onTextPlace?:      (worldX: number, worldY: number) => void;
  /** Eraser hit radius in SCREEN pixels (ring is drawn at this size). */
  eraserRadius?:     number;
  /** Reports which annotation anchors have at least one stroke (mine or a
   *  collaborator's) — drives the persistent word/ayah highlights. */
  onAnchorsChange?:  (anchors: Set<string>) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(function DrawingCanvas(
  { pageId, mushafPage, tool, strokeColor, strokeWidth, viewport, roomSocket, activeAnchor = null, onHistoryChange, onTextPlace, onAnchorsChange, eraserRadius = ERASER_RADIUS },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const hlCanvasRef  = useRef<HTMLCanvasElement | null>(null);
  const rafRef       = useRef<number>(0);

  // ── tool ref — always current, safe in event-handler closures (fix #6) ──
  const toolRef = useRef(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);

  // Stroke style refs for the native (capture-phase) stylus handlers
  const strokeColorRef = useRef(strokeColor);
  useEffect(() => { strokeColorRef.current = strokeColor; }, [strokeColor]);
  const strokeWidthRef = useRef(strokeWidth);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);

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

  const anchorRef = useRef<string | null>(activeAnchor);
  useEffect(() => { anchorRef.current = activeAnchor; }, [activeAnchor]);

  // Adjustable eraser size (screen px) — ref so native handlers stay fresh
  const eraserRadiusRef = useRef(eraserRadius);
  useEffect(() => { eraserRadiusRef.current = eraserRadius; }, [eraserRadius]);

  // onTextPlace via ref: the native stylus handlers are registered once, so a
  // direct closure captured the MOUNT-TIME callback — text boxes placed with a
  // pen inside a word/ayah layer were anchored to the stale (no-layer) state
  // and appeared on the main board instead of inside the layer.
  const onTextPlaceRef = useRef(onTextPlace);
  useEffect(() => { onTextPlaceRef.current = onTextPlace; }, [onTextPlace]);

  /** EXCLUSIVE layer visibility:
   *  normal mode    → only unanchored strokes (the Main Notes);
   *  word/ayah mode → ONLY that anchor's strokes (Main Notes hidden). */
  function anchorVisible(a?: string): boolean {
    return (a ?? null) === anchorRef.current;
  }

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
    anchor?:     string;
  }>>(new Map());

  const redoStackRef = useRef<Stroke[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Persistence-safety bookkeeping ────────────────────────────────────
  // tombstones: ids the user deleted this session (undo / eraser / clear).
  //   Sent with every PUT so the server can remove them; the server merge is
  //   otherwise ADDITIVE by id, so a save can never wipe strokes it doesn't
  //   know about (draw-before-load, or the same user on a second device).
  // savedIds: ids known to exist on the server (returned by a GET, or
  //   included in a PUT that succeeded). A stroke we know was on the server
  //   that later vanishes from a GET was deleted elsewhere → drop it locally.
  const tombstonesRef = useRef<Set<string>>(new Set());
  const savedIdsRef   = useRef<Set<string>>(new Set());
  const loadedRef     = useRef(false);

  /** Two-way reconcile of MY strokes against a fresh server read:
   *  add server strokes we don't have (drawn on another device), drop local
   *  strokes the server no longer has but once did (deleted on another
   *  device). Unsaved local strokes are always kept. */
  const syncMyStrokes = useCallback((serverMine: Stroke[]) => {
    const canvasServer = serverMine.filter((s) => strokeSurface(s) === "canvas");
    const serverIds    = new Set(canvasServer.map((s) => s.id));
    for (const id of serverIds) savedIdsRef.current.add(id);

    const have  = new Set(allMyStrokesRef.current.map((s) => s.id));
    const added = canvasServer.filter(
      (s) => !have.has(s.id) && !tombstonesRef.current.has(s.id),
    );
    const kept = allMyStrokesRef.current.filter(
      (s) => serverIds.has(s.id) || !savedIdsRef.current.has(s.id),
    );
    if (added.length === 0 && kept.length === allMyStrokesRef.current.length) return;

    allMyStrokesRef.current = [...kept, ...added];
    const filtered = filterForPage(allMyStrokesRef.current, mushafPageRef.current);
    myStrokesRef.current = filtered;
    setMyStrokes(filtered);
    onHistoryRef.current?.(filtered.length > 0, redoStackRef.current.length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onHistoryRef = useRef(onHistoryChange);
  useEffect(() => { onHistoryRef.current = onHistoryChange; }, [onHistoryChange]);

  // Report which anchors own strokes whenever committed strokes change
  // (creation-order preserved: my strokes first, then collaborators').
  const onAnchorsRef = useRef(onAnchorsChange);
  useEffect(() => { onAnchorsRef.current = onAnchorsChange; }, [onAnchorsChange]);
  useEffect(() => {
    if (!onAnchorsRef.current) return;
    const anchors = new Set<string>();
    for (const s of allMyStrokesRef.current) if (s.anchor) anchors.add(s.anchor);
    for (const layer of otherLayers) for (const s of layer.strokes) if (s.anchor) anchors.add(s.anchor);
    onAnchorsRef.current(anchors);
  }, [myStrokes, otherLayers]);

  // Filter strokes for the current Mushaf page.
  // Strokes without mushafPage (legacy, pre-migration) pass through so they
  // remain visible until the migration tags them. Editor-surface strokes
  // belong to the Mode A ink overlay and never render here.
  function filterForPage(strokes: Stroke[], page: number): Stroke[] {
    return strokes.filter(s =>
      strokeSurface(s) === "canvas" &&
      (s.mushafPage === undefined || s.mushafPage === page) &&
      anchorVisible(s.anchor));
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
    // Rendered at EXACT stored opacity — no viewer-side dimming. A stroke
    // must look identical on every device and to every collaborator.
    ctx.save(); applyVP(ctx);
    const curPage = mushafPageRef.current;
    for (const layer of otherLayersRef.current) {
      for (const s of layer.strokes) {
        if (strokeSurface(s) === "canvas" &&
            (s.mushafPage === undefined || s.mushafPage === curPage) &&
            anchorVisible(s.anchor)) {
          paintStroke(ctx, s);
        }
      }
    }
    // ── Pass 1b: remote peers' in-progress strokes (live, translucent) ───
    for (const seg of remoteActiveRef.current.values()) {
      const onThisPage  = seg.mushafPage === undefined || seg.mushafPage === curPage;
      const sameLayer   = (seg.anchor ?? null) === anchorRef.current;
      if (onThisPage && sameLayer && seg.points.length > 0) {
        drawSmooth(ctx, seg.points, seg.color, seg.width, 0.55, true);
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
        drawSmooth(ctx, activePtsRef.current, activeColorRef.current, activeWidthRef.current, TOOL_OPACITY[t], t === "pen");
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
    let alive   = true;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    loadedRef.current = false;

    // Fresh page context — a previous pageId's strokes/tombstones must never
    // merge into (or delete from) this page's set.
    allMyStrokesRef.current = [];
    myStrokesRef.current    = [];
    redoStackRef.current    = [];
    tombstonesRef.current   = new Set();
    savedIdsRef.current     = new Set();
    setMyStrokes([]);

    function load() {
      fetch(`/api/pages/${pageId}/drawings`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { myStrokes?: Stroke[]; otherLayers?: DrawingLayer[] }) => {
          if (!alive) return;
          loadedRef.current = true;

          if (d.myStrokes) {
            const curPage = mushafPageRef.current;

            // Editor-surface strokes belong to the Mode A overlay — this
            // component only owns canvas-surface strokes.
            const mine = d.myStrokes.filter((s) => strokeSurface(s) === "canvas");

            // ── Legacy migration (one-time, silent) ────────────────────────
            // Strokes saved before the mushafPage scoping fix have no
            // mushafPage field.  Tag them to whichever Mushaf page is open
            // now (always the first page of the surah on a fresh load).
            const { migrated, changed } = migrateLegacyStrokes(mine, curPage);

            for (const s of migrated) savedIdsRef.current.add(s.id);

            // MERGE with anything drawn before the load finished — replacing
            // would silently discard those strokes from local state.
            const serverIds = new Set(migrated.map((s) => s.id));
            const localOnly = allMyStrokesRef.current.filter((s) => !serverIds.has(s.id));
            allMyStrokesRef.current = [
              ...migrated.filter((s) => !tombstonesRef.current.has(s.id)),
              ...localOnly,
            ];
            const filtered = filterForPage(allMyStrokesRef.current, curPage);
            setMyStrokes(filtered);
            myStrokesRef.current = filtered;
            onHistoryRef.current?.(filtered.length > 0, redoStackRef.current.length > 0);

            if (changed) {
              // Fire-and-forget — server merges by id, so this only updates
              // the migrated copies and can't clobber anything else.
              fetch(`/api/pages/${pageId}/drawings`, {
                method:  "PUT",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ strokes: allMyStrokesRef.current, surface: "canvas" }),
              }).catch(() => {});
            }
          }

          if (d.otherLayers) setOtherLayers(d.otherLayers);
        })
        .catch(() => {
          // A failed initial load must NOT be silent — without the server
          // copy in memory, later behaviour degrades. Retry with backoff.
          if (!alive) return;
          attempt++;
          if (attempt <= 6) retryTimer = setTimeout(load, Math.min(15000, 1000 * 2 ** attempt));
        });
    }
    load();

    return () => { alive = false; if (retryTimer) clearTimeout(retryTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // Re-filter when the mushaf page OR the active annotation layer changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const filtered = filterForPage(allMyStrokesRef.current, mushafPage);
    setMyStrokes(filtered);
    myStrokesRef.current = filtered;
    onHistoryRef.current?.(filtered.length > 0, redoStackRef.current.length > 0);
  }, [mushafPage, activeAnchor]);

  // ── Reconciliation poll (slow) ────────────────────────────────────────
  // Live additions arrive via the socket, but erasures / undo / clear by
  // peers are only persisted to the DB — this poll picks those up and also
  // heals any missed socket messages. It reconciles MY strokes too, so the
  // same account on a second device converges instead of diverging.
  useEffect(() => {
    if (!pageId) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/pages/${pageId}/drawings`)
        .then(r => r.ok ? r.json() : null)
        .then((d: { myStrokes?: Stroke[]; otherLayers?: DrawingLayer[] } | null) => {
          if (!d) return;
          if (d.otherLayers) setOtherLayers(d.otherLayers);
          if (d.myStrokes && loadedRef.current) syncMyStrokes(d.myStrokes);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [pageId, syncMyStrokes]);

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
        mushafPage?: number; color?: string; width?: number; anchor?: string;
      } = { type: "" };
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === "stroke-segment" && msg.connectionId && msg.points) {
        remoteActiveRef.current.set(msg.connectionId, {
          points:     msg.points,
          mushafPage: msg.mushafPage,
          color:      msg.color ?? "#3b82f6",
          width:      msg.width ?? 3,
          anchor:     msg.anchor,
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

  // On socket RECONNECT, pull persisted drawings immediately so strokes a peer
  // made while we were briefly disconnected show up without a manual refresh
  // (the slow poll would eventually catch them; this makes it instant).
  useEffect(() => {
    if (!roomSocket) return;
    let first = true;
    const onOpen = () => {
      if (first) { first = false; return; } // skip the initial connect
      fetch(`/api/pages/${pageId}/drawings`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { myStrokes?: Stroke[]; otherLayers?: DrawingLayer[] } | null) => {
          if (!d) return;
          if (d.otherLayers) setOtherLayers(d.otherLayers);
          if (d.myStrokes && loadedRef.current) syncMyStrokes(d.myStrokes);
        })
        .catch(() => {});
    };
    roomSocket.addEventListener("open", onOpen);
    return () => roomSocket.removeEventListener("open", onOpen);
  }, [roomSocket, pageId, syncMyStrokes]);

  // ── Debounced save ─────────────────────────────────────────────────────
  // Previously fire-and-forget: a failed PUT was silently swallowed and the
  // in-memory strokes were the only copy. Now: one retry after 3 s, and a
  // keepalive flush when the tab is hidden/closed (mosque Wi-Fi reality).

  const putStrokes = useCallback((keepalive = false) => {
    // surface:"canvas" → the server merges by id within this surface,
    // preserving editor-surface strokes AND any canvas strokes this client
    // doesn't have (other device, draw-before-load). deletedIds carries the
    // user's explicit deletions so those still propagate.
    const snapshot = allMyStrokesRef.current;
    const body = JSON.stringify({
      strokes:    snapshot,
      surface:    "canvas",
      deletedIds: [...tombstonesRef.current],
    });
    return fetch(`/api/pages/${pageId}/drawings`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive,
    }).then((r) => {
      if (r.ok) for (const s of snapshot) savedIdsRef.current.add(s.id);
      return r;
    });
  }, [pageId]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      putStrokes().catch(() => {
        // One retry — covers transient network blips during a lesson.
        setTimeout(() => { putStrokes().catch(() => {}); }, 3000);
      });
    }, SAVE_DEBOUNCE);
  }, [putStrokes]);

  // Flush pending saves before the tab suspends; refresh peers on refocus.
  useEffect(() => {
    function flushPending() {
      if (!saveTimerRef.current) return;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      putStrokes(true).catch(() => {});
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        flushPending();
      } else {
        // Back from suspension — don't wait up to 15 s for the poll.
        fetch(`/api/pages/${pageId}/drawings`)
          .then(r => r.ok ? r.json() : null)
          .then((d: { myStrokes?: Stroke[]; otherLayers?: DrawingLayer[] } | null) => {
            if (!d) return;
            if (d.otherLayers) setOtherLayers(d.otherLayers);
            if (d.myStrokes && loadedRef.current) syncMyStrokes(d.myStrokes);
          })
          .catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushPending);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushPending);
    };
  }, [pageId, putStrokes, syncMyStrokes]);

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
      // A pen is in contact: kill its Android compat-touches (no touchType
      // there) so the browser can't claim the stylus for panning.
      if (el.parentElement?.dataset.penActive === "1") { e.preventDefault(); return; }
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
      tombstonesRef.current.add(removed.id);
      myStrokesRef.current = nextPage;
      setMyStrokes(nextPage);
      scheduleSave(); notifyHistory();
    },
    redo() {
      const stack = redoStackRef.current;
      if (!stack.length) return;
      const stroke = stack[stack.length - 1];
      redoStackRef.current = stack.slice(0, -1);
      tombstonesRef.current.delete(stroke.id); // it's alive again
      allMyStrokesRef.current = [...allMyStrokesRef.current, stroke];
      const nextPage = [...myStrokesRef.current, stroke];
      myStrokesRef.current = nextPage;
      setMyStrokes(nextPage);
      scheduleSave(); notifyHistory();
    },
    clear() {
      // Clear ONLY the strokes currently visible (this page + active layer),
      // by id — clearing the main Mushaf must never touch strokes hidden in
      // word/ayah annotation layers on the same page.
      const visibleIds = new Set(myStrokesRef.current.map(s => s.id));
      if (!visibleIds.size) return;
      for (const id of visibleIds) tombstonesRef.current.add(id);
      allMyStrokesRef.current = allMyStrokesRef.current.filter(s => !visibleIds.has(s.id));
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

  // ── Stylus input matrix (native capture listeners) ────────────────────
  // Professional-whiteboard rules: the STYLUS always draws — even with the
  // hand tool selected it falls back to the pen tool. Finger always pans
  // (ModeBPage touch handlers). Mouse follows the selected tool (React
  // handlers above). Registered capture-phase on the canvas container so
  // they win over pan handlers, and independent of the wrapper's
  // pointer-events (which is "none" in hand mode).
  useEffect(() => {
    const parent = containerRef.current?.parentElement; // .mode-b-canvas
    if (!parent) return;

    // Stylus draws even in the hand (pan) tool, but the TEXT tool is explicit —
    // a pen tap there must place a text box, not draw.
    function penTool(): "pen" | "highlight" | "arrow" | "eraser" | "text" {
      const t = toolRef.current;
      if (t === "hand") return "pen";
      return t;
    }

    function down(e: PointerEvent) {
      if (e.pointerType !== "pen") return;
      // Interactive elements (tool rail, note cards, word taps) keep working.
      // The WHOLE rail + HUD areas are excluded, not just their buttons — the
      // rail is floating icons with gaps, and unlike finger taps (which iOS
      // snaps to the nearest button), pencil taps are exact: a tap 2px off a
      // button used to land on the canvas and draw a line.
      if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"], .anc-note, .free-textbox, .canvas-tool-rail, .mode-b-zoom-controls, .fa-toolbar')) return;
      parent!.dataset.penActive = "1"; // suppress Android compat-touch panning
      e.preventDefault();
      e.stopPropagation();

      const eff = penTool();
      const [wx, wy] = toWorld(e.clientX, e.clientY);
      // Text tool: a pen tap drops a container instead of drawing.
      // MUST go through the ref — these handlers are registered once, so a
      // direct prop call would use the mount-time callback and anchor the
      // box to the wrong (no-layer) state.
      if (eff === "text") { parent!.dataset.penActive = ""; onTextPlaceRef.current?.(wx, wy); return; }
      if (eff === "eraser") { eraseAt(wx, wy); return; }

      try { parent!.setPointerCapture(e.pointerId); } catch { /* ok */ }
      isDrawingRef.current   = true;
      activeToolRef.current  = eff;
      activeColorRef.current = strokeColorRef.current;
      activeWidthRef.current = strokeWidthRef.current;
      activePtsRef.current   = [[wx, wy, Math.max(0.1, e.pressure || 0.5)]];
      scheduleRender();
    }

    function move(e: PointerEvent) {
      if (e.pointerType !== "pen") return;
      if (penTool() === "eraser") {
        moveEraserRing(e.clientX, e.clientY); // stylus hover shows the rubber
        if (e.buttons & 1) { const [wx, wy] = toWorld(e.clientX, e.clientY); eraseAt(wx, wy); }
        return;
      }
      if (!isDrawingRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const events = e.getCoalescedEvents?.() ?? [e];
      for (const ev of events) {
        const [wx, wy] = toWorld(ev.clientX, ev.clientY);
        activePtsRef.current.push([wx, wy, Math.max(0.1, ev.pressure || 0.5)]);
      }

      if (roomSocket?.readyState === WebSocket.OPEN) {
        roomSocket.send(JSON.stringify({
          type:       "stroke-segment",
          points:     activePtsRef.current,
          mushafPage: mushafPageRef.current,
          color:      activeColorRef.current,
          width:      activeWidthRef.current,
          anchor:     anchorRef.current ?? undefined,
        }));
      }
      scheduleRender();
    }

    function up(e: PointerEvent) {
      if (e.pointerType !== "pen") return;
      parent!.dataset.penActive = "";
      if (!isDrawingRef.current) return;
      e.preventDefault();
      appendFinalPoint(e.clientX, e.clientY);
      commitActiveStroke();
    }

    parent.addEventListener("pointerdown",   down, { capture: true });
    parent.addEventListener("pointermove",   move, { capture: true });
    parent.addEventListener("pointerup",     up,   { capture: true });
    parent.addEventListener("pointercancel", up,   { capture: true });
    return () => {
      parent.removeEventListener("pointerdown",   down, { capture: true } as EventListenerOptions);
      parent.removeEventListener("pointermove",   move, { capture: true } as EventListenerOptions);
      parent.removeEventListener("pointerup",     up,   { capture: true } as EventListenerOptions);
      parent.removeEventListener("pointercancel", up,   { capture: true } as EventListenerOptions);
      delete parent.dataset.penActive;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleRender, scheduleSave, roomSocket]);

  // ── Eraser ─────────────────────────────────────────────────────────────

  // Visual eraser: a round "rubber" ring that follows the pointer so the
  // tool reads as an eraser, not a generic crosshair. Positioned via direct
  // style writes (no re-render per move).
  const eraserRingRef = useRef<HTMLDivElement>(null);

  function moveEraserRing(clientX: number, clientY: number) {
    const ring = eraserRingRef.current;
    const wrap = containerRef.current;
    if (!ring || !wrap) return;
    const r = wrap.getBoundingClientRect();
    ring.style.left    = `${clientX - r.left}px`;
    ring.style.top     = `${clientY - r.top}px`;
    ring.style.opacity = "1";
  }

  function hideEraserRing() {
    if (eraserRingRef.current) eraserRingRef.current.style.opacity = "0";
  }

  function eraseAt(wx: number, wy: number) {
    const r    = eraserRadiusRef.current / viewportRef.current.zoom;
    const prev = myStrokesRef.current;
    // prev is already scoped to OWN strokes, this page, this surface, and the
    // ACTIVE annotation layer — so the eraser can only ever touch the user's
    // own visible pen/highlight/arrow strokes, nothing else.
    const removedIds = new Set(
      prev.filter(s => hitTest(normPts(s.points as unknown[]), wx, wy, r)).map(s => s.id),
    );
    if (removedIds.size === 0) return;
    for (const id of removedIds) tombstonesRef.current.add(id);

    // Remove STRICTLY BY ID. The previous survive-by-visibility sync dropped
    // every same-page stroke hidden in other word/ayah layers — erasing on
    // the main Mushaf silently destroyed all embedded annotation layers.
    const next = prev.filter(s => !removedIds.has(s.id));
    allMyStrokesRef.current = allMyStrokesRef.current.filter(s => !removedIds.has(s.id));
    redoStackRef.current = [];
    myStrokesRef.current = next;
    setMyStrokes(next);
    scheduleSave(); notifyHistory();
  }

  // ── Pointer handlers (fix #6 — touch is always rejected) ──────────────

  function onDown(e: React.PointerEvent) {
    // touch → always handled by ModeBPage native touch handlers (panning)
    if (e.pointerType === "touch") return;
    // pen → handled by the native capture listeners (stylus always draws)
    if (e.pointerType === "pen") return;
    // hand tool → mouse never draws (mouse follows the selected tool)
    if (toolRef.current === "hand") return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const [wx, wy] = toWorld(e.clientX, e.clientY);
    if (toolRef.current === "text")   { onTextPlace?.(wx, wy); return; }
    if (toolRef.current === "eraser") { eraseAt(wx, wy); return; }

    // Mouse-only path now (touch + pen return earlier) — neutral pressure.
    isDrawingRef.current   = true;
    activeToolRef.current  = toolRef.current as "pen" | "highlight" | "arrow";
    activeColorRef.current = strokeColor;
    activeWidthRef.current = strokeWidth;
    activePtsRef.current   = [[wx, wy, 0.5]];
    scheduleRender();
  }

  function onMove(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (e.pointerType === "pen")   return; // native capture handlers own the pen
    if (toolRef.current === "hand") return;
    // The eraser ring follows the mouse even before the button goes down
    if (toolRef.current === "eraser") moveEraserRing(e.clientX, e.clientY);
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
        anchor:     anchorRef.current ?? undefined,
      }));
    }

    scheduleRender();
  }

  // The pointerup event carries the true lift position — append it so the
  // stroke ends exactly where the pen left the surface (pressure on the up
  // event is 0, so reuse the last sample's pressure).
  function appendFinalPoint(clientX: number, clientY: number) {
    const pts = activePtsRef.current;
    const last = pts[pts.length - 1];
    if (!last) return;
    const [wx, wy] = toWorld(clientX, clientY);
    if (Math.hypot(wx - last[0], wy - last[1]) > 1e-3) pts.push([wx, wy, last[2]]);
  }

  // Commit whatever's in activePtsRef as a finished stroke (shared by the
  // React mouse handlers and the native stylus handlers).
  function commitActiveStroke() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pts = activePtsRef.current;
    activePtsRef.current = [];

    if (pts.length >= 1) {
      const drawTool = activeToolRef.current;
      const done: Stroke = {
        id:         crypto.randomUUID(),
        tool:       drawTool,
        points:     pts,
        color:      activeColorRef.current,
        width:      activeWidthRef.current,
        opacity:    TOOL_OPACITY[drawTool],
        mushafPage: mushafPageRef.current,
        surface:    "canvas",
        ...(anchorRef.current ? { anchor: anchorRef.current } : {}),
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

  function onUp(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (e.pointerType === "pen")   return; // native capture handlers own the pen
    e.preventDefault();
    if (!isDrawingRef.current) return;
    if (toolRef.current === "eraser") { isDrawingRef.current = false; activePtsRef.current = []; return; }
    appendFinalPoint(e.clientX, e.clientY);
    commitActiveStroke();
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
          // Explicit BLACK cursors — native crosshair/cell render white on
          // several platforms (iPad pointer, Windows "cell").
          cursor: tool === "pen" || tool === "arrow" || tool === "highlight"
                    ? `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='19' height='19'><g stroke='%23111' stroke-width='1.8' fill='none'><path d='M9.5 1v17M1 9.5h17'/></g></svg>") 9 9, crosshair`
                : tool === "eraser" ? "none"   // the ring IS the cursor
                : tool === "text"
                    ? `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='17' height='17'><g stroke='%23111' stroke-width='1.4' fill='none'><path d='M5.5 2h6M5.5 15h6M8.5 2v13'/></g></svg>") 8 8, text`
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
        onPointerLeave={hideEraserRing}
      />

      {/* Eraser "rubber" — sized to the true hit radius so what you see is
          exactly what gets erased */}
      <div
        ref={eraserRingRef}
        className="eraser-ring"
        style={{
          display: tool === "eraser" ? "block" : "none",
          width:   eraserRadius * 2,
          height:  eraserRadius * 2,
        }}
        aria-hidden
      />
    </div>
  );
});

export default DrawingCanvas;
