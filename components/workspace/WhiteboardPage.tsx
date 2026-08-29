"use client";

/**
 * WhiteboardPage — a blank freeform canvas for misc notes.
 *
 * A scratch space (one per page, view mode "board") where you place movable
 * rich text containers anywhere, pull in Qurʾānic verses and tafsīr yourself
 * with the "/" menu (/ayah, /tabari …), and annotate around everything with
 * the pen / highlighter — all with pan + zoom.
 *
 * Reuses the shared canvas leaves: DrawingCanvas (ink), CanvasToolRail
 * (tools), and the rich FreeTextBox containers. Drawings are scoped to a
 * sentinel mushaf page (WB_PAGE = 0, which the real Mushaf never uses) and
 * containers use anchorType "whiteboard", so this surface stays completely
 * separate from Mode B's Mushaf annotations on the same page id.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { isTypingTarget } from "@/lib/is-typing";
import type { NoteData } from "./NoteCard";
import FreeTextBox, { TEXTBOX_DEFAULT_WIDTH } from "./FreeTextBox";
import DrawingCanvas, { type DrawTool, type DrawingCanvasHandle } from "./DrawingCanvas";
import CanvasToolRail, {
  DEFAULT_PEN_COLOR, DEFAULT_PEN_SIZE,
  DEFAULT_HIGHLIGHT_COLOR, DEFAULT_HIGHLIGHT_SIZE,
  DEFAULT_ERASER_SIZE, ERASER_SIZE_KEY,
} from "./CanvasToolRail";

// Drawings on the whiteboard live on this sentinel page (real Mushaf ≥ 1).
const WB_PAGE   = 0;
/* Matches the canvas. 0.3 could not survey a board; 0.08 shows ~12x the area. */
const ZOOM_MIN  = 0.08;
const ZOOM_MAX  = 4;
/* Exponential wheel zoom, identical to the canvas: each event multiplies by
   e^step, so a notch is a constant RATIO at any zoom and in/out are exact
   inverses. The cap matters because a mouse reports deltaY~100 per notch where
   a trackpad reports ~1-4 — uncapped, one mouse notch crossed the whole range.
   The previous `zoom + zoom * delta * 10` was linear AND unclamped: at
   deltaY=100 the multiplier hit zero, so a single notch collapsed to ZOOM_MIN. */
const ZOOM_WHEEL_SENSITIVITY = 0.0015;
const ZOOM_WHEEL_MAX_STEP    = 0.18;
const VP_KEY    = (pageId: string) => `tl-wb-viewport:${pageId}`;

interface Viewport { x: number; y: number; zoom: number; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const TOOL_HOTKEYS: Record<string, DrawTool> = {
  h: "hand", p: "pen", l: "highlight", a: "arrow", e: "eraser", t: "text",
};

interface Props {
  pageId:          string;
  notes:           NoteData[];       // whiteboard containers (anchorType "whiteboard")
  roomSocket?:     import("partysocket").default | null;
  currentUserId:   string;
  currentUserName: string;
  onNoteCreated:   (note: NoteData) => void;
  onNoteUpdated:   (note: NoteData) => void;
  onNoteDeleted:   (noteId: string) => void;
  /** Rendered in world space BEHIND the note containers — e.g. the PDF pages
   *  for a book. Ink and containers annotate over/around it. */
  background?:     ReactNode;
  /** Show the "Blank whiteboard" hint on an empty board (off for book study). */
  showBlankHint?:  boolean;
}

export default function WhiteboardPage({
  pageId, notes, roomSocket, currentUserId, currentUserName,
  onNoteCreated, onNoteUpdated, onNoteDeleted,
  background, showBlankHint = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef   = useRef<DrawingCanvasHandle>(null);

  /* ── Viewport (pan/zoom), persisted locally ──────────────────────────────
     Restored in an effect, NOT in the initialiser. Reading localStorage during
     render made the server emit `translate(0px,0px) scale(1)` while the client
     emitted the saved transform, so React failed hydration and threw away the
     whole canvas subtree on every board load — visible in the dev overlay as a
     recoverable error, and in production as a wasted re-render of the most
     expensive thing on the page. The cost of doing it properly is that a saved
     viewport lands one frame late, which is not perceptible; the cost of the
     old way was re-mounting the canvas. */
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VP_KEY(pageId));
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Viewport>;
      // Guard the shape: a corrupt or half-written value must not produce a
      // NaN transform, which paints nothing at all and looks like a blank board.
      if ([saved.x, saved.y, saved.zoom].every((n) => typeof n === "number" && Number.isFinite(n))) {
        setViewport({ x: saved.x!, y: saved.y!, zoom: clamp(saved.zoom!, ZOOM_MIN, ZOOM_MAX) });
      }
    } catch { /* ignore */ }
  }, [pageId]);
  const viewportRef = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  const saveVpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patchViewport = useCallback((vp: Viewport) => {
    if (saveVpTimer.current) clearTimeout(saveVpTimer.current);
    saveVpTimer.current = setTimeout(() => {
      try { localStorage.setItem(VP_KEY(pageId), JSON.stringify(vp)); } catch { /* ignore */ }
    }, 500);
  }, [pageId]);

  // ── Tools ───────────────────────────────────────────────────────────────
  const [tool, setTool]                     = useState<DrawTool>("hand");
  const [penColor, setPenColor]             = useState(DEFAULT_PEN_COLOR);
  const [penSize, setPenSize]               = useState(DEFAULT_PEN_SIZE);
  const [hlColor, setHlColor]               = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [hlSize, setHlSize]                 = useState(DEFAULT_HIGHLIGHT_SIZE);
  const [canUndo, setCanUndo]               = useState(false);
  const [canRedo, setCanRedo]               = useState(false);

  // Eraser radius (screen px) — remembered across sessions.
  const [eraserSize, setEraserSizeState] = useState(DEFAULT_ERASER_SIZE);
  useEffect(() => {
    const v = Number(localStorage.getItem(ERASER_SIZE_KEY));
    if (v >= 6 && v <= 60) setEraserSizeState(v);
  }, []);
  const setEraserSize = useCallback((s: number) => {
    setEraserSizeState(s);
    try { localStorage.setItem(ERASER_SIZE_KEY, String(s)); } catch { /* ignore */ }
  }, []);

  const isHighlight = tool === "highlight";
  const activeColor = isHighlight ? hlColor : penColor;
  const activeSize  = isHighlight ? hlSize  : penSize;

  // ── Containers: optimistic temp → server, stable key across the swap ─────
  const [freshBoxId, setFreshBoxId] = useState<string | null>(null);
  const keyAliasRef = useRef<Map<string, string>>(new Map()); // serverId → tempId

  const createTempAt = useCallback((wx: number, wy: number) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const temp: NoteData = {
      id: tempId,
      noteType: "textbox",
      anchorType: "whiteboard",
      surahNumber: null, ayahNumber: null, wordPosition: null,
      content: { type: "doc", content: [{ type: "paragraph" }] },
      color: null,
      offsetX: Math.round(wx), offsetY: Math.round(wy),
      width: TEXTBOX_DEFAULT_WIDTH, height: null,
      isMinimized: false, zIndex: 1, isAdmin: false,
      createdAt: new Date().toISOString(),
      author: { id: currentUserId, name: currentUserName, avatarUrl: null },
    };
    onNoteCreated(temp);
    setFreshBoxId(tempId);
    setTool("hand"); // let the click reach the fresh box for editing
  }, [currentUserId, currentUserName, onNoteCreated]);

  // Refs so the native touch handlers (stable effect) see the current tool +
  // placement callback without re-subscribing.
  const toolRef = useRef(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  const createTempRef = useRef(createTempAt);
  useEffect(() => { createTempRef.current = createTempAt; }, [createTempAt]);

  const persistTemp = useCallback((tempId: string, content: object, at: { x: number; y: number }) => {
    const post = () =>
      fetch(`/api/pages/${pageId}/notes`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          noteType: "textbox", anchorType: "whiteboard",
          content, offsetX: Math.round(at.x), offsetY: Math.round(at.y), width: TEXTBOX_DEFAULT_WIDTH,
        }),
      }).then((r) => (r.ok ? r.json() : null));

    const swap = (d: { note?: NoteData } | null) => {
      if (!d?.note) return false;
      keyAliasRef.current.set(d.note.id, tempId);
      onNoteDeleted(tempId);
      onNoteCreated(d.note);
      return true;
    };

    post().then((d) => { if (!swap(d)) setTimeout(() => post().then(swap).catch(() => {}), 3000); })
          .catch(() => { /* temp stays visible */ });
  }, [pageId, onNoteCreated, onNoteDeleted]);

  // ── Keyboard: tool hotkeys + undo/redo ───────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      /* Also covers the active element and IME composition, which the
         target-only test missed. */
      if (isTypingTarget(e)) return;
      if (!e.metaKey && !e.ctrlKey) {
        const t = TOOL_HOTKEYS[e.key.toLowerCase()];
        if (t) { setTool(t); return; }
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) { e.preventDefault(); drawingRef.current?.undo(); }
      if ((e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) || (e.key === "y" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault(); drawingRef.current?.redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Wheel zoom (hand tool only) ──────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    /* Coalesced into one commit per frame. A wheel burst fires far faster than
       React can render, and committing each event made the gesture stutter. */
    let pending: Viewport | null = null;
    let raf = 0;
    const flush = () => {
      raf = 0;
      if (!pending) return;
      setViewport(pending); patchViewport(pending); pending = null;
    };
    function onWheel(e: WheelEvent) {
      if (tool !== "hand") return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const step = clamp(
        e.deltaY * unit * ZOOM_WHEEL_SENSITIVITY,
        -ZOOM_WHEEL_MAX_STEP,
        ZOOM_WHEEL_MAX_STEP,
      );
      // Zoom from the pending value, not committed state, or every event in a
      // burst computes off the same stale zoom and the gesture stalls.
      const prev    = pending ?? viewportRef.current;
      const newZoom = clamp(prev.zoom * Math.exp(-step), ZOOM_MIN, ZOOM_MAX);
      const rect    = el!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const scale = newZoom / prev.zoom;
      pending = { zoom: newZoom, x: mx - (mx - prev.x) * scale, y: my - (my - prev.y) * scale };
      if (!raf) raf = requestAnimationFrame(flush);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [patchViewport, tool]);

  // ── Touch pan / pinch-zoom ───────────────────────────────────────────────
  useEffect(() => {
    const elOrNull = containerRef.current;
    if (!elOrNull) return;
    const el = elOrNull;
    const pts = new Map<number, { x: number; y: number }>();
    let panStart:   { tx: number; ty: number; vx: number; vy: number } | null = null;
    let pinchStart: { dist: number; zoom: number; worldX: number; worldY: number } | null = null;

    const isInteractive = (e: TouchEvent) =>
      !!(e.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"], .free-textbox');

    function startPan() { if (pts.size !== 1) return; const [p] = pts.values(); panStart = { tx: p.x, ty: p.y, vx: viewportRef.current.x, vy: viewportRef.current.y }; }
    function startPinch() {
      if (pts.size < 2) return;
      const [a, b] = pts.values();
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const rect = el.getBoundingClientRect();
      const cx = (a.x + b.x) / 2 - rect.left, cy = (a.y + b.y) / 2 - rect.top;
      const vp = viewportRef.current;
      pinchStart = { dist, zoom: vp.zoom, worldX: (cx - vp.x) / vp.zoom, worldY: (cy - vp.y) / vp.zoom };
    }

    function onStart(e: TouchEvent) {
      if (isInteractive(e)) return;
      if (el.dataset.penActive === "1") { e.preventDefault(); return; }
      for (let i = 0; i < e.changedTouches.length; i++) {
        if ((e.changedTouches[i] as Touch & { touchType?: string }).touchType === "stylus") return;
      }
      e.preventDefault();
      for (const t of e.changedTouches) pts.set(t.identifier, { x: t.clientX, y: t.clientY });
      if (pts.size === 1) { pinchStart = null; startPan(); } else { panStart = null; startPinch(); }
    }
    function onMove(e: TouchEvent) {
      e.preventDefault();
      for (const t of e.changedTouches) if (pts.has(t.identifier)) pts.set(t.identifier, { x: t.clientX, y: t.clientY });
      if (pts.size >= 2 && pinchStart) {
        const [a, b] = pts.values();
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const rect = el.getBoundingClientRect();
        const cx = (a.x + b.x) / 2 - rect.left, cy = (a.y + b.y) / 2 - rect.top;
        const newZoom = clamp(pinchStart.zoom * (dist / pinchStart.dist), ZOOM_MIN, ZOOM_MAX);
        const next: Viewport = { zoom: newZoom, x: cx - pinchStart.worldX * newZoom, y: cy - pinchStart.worldY * newZoom };
        setViewport(next); patchViewport(next);
      } else if (pts.size === 1 && panStart) {
        const [p] = pts.values();
        const next: Viewport = { ...viewportRef.current, x: panStart.vx + (p.x - panStart.tx), y: panStart.vy + (p.y - panStart.ty) };
        setViewport(next); patchViewport(next);
      }
    }
    function onEnd(e: TouchEvent) {
      if (!isInteractive(e)) e.preventDefault();
      // Text tool: a single-finger TAP (barely moved) drops a container.
      if (toolRef.current === "text" && pts.size === 1 && panStart && !isInteractive(e)) {
        const t = e.changedTouches[0];
        if (t && Math.hypot(t.clientX - panStart.tx, t.clientY - panStart.ty) < 12) {
          const rect = el.getBoundingClientRect();
          const vp = viewportRef.current;
          createTempRef.current((t.clientX - rect.left - vp.x) / vp.zoom, (t.clientY - rect.top - vp.y) / vp.zoom);
        }
      }
      for (const t of e.changedTouches) pts.delete(t.identifier);
      if (pts.size < 2) pinchStart = null;
      if (pts.size === 1 && panStart === null) startPan();
      if (pts.size === 0) panStart = null;
    }
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove",  onMove,  { passive: false });
    el.addEventListener("touchend",   onEnd,   { passive: false });
    el.addEventListener("touchcancel", onEnd,  { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove",  onMove);
      el.removeEventListener("touchend",   onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [patchViewport]);

  // ── Mouse pan (hand tool) ────────────────────────────────────────────────
  const isDragging = useRef(false);
  const dragStart  = useRef<{ mx: number; my: number; vx: number; vy: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (!!(e.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"], .free-textbox')) return;
    if (e.pointerType === "touch") return;
    if (e.pointerType === "pen") e.preventDefault();
    if (tool !== "hand" || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, vx: viewportRef.current.x, vy: viewportRef.current.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType === "touch" || tool !== "hand" || !isDragging.current || !dragStart.current) return;
    const next: Viewport = { ...viewportRef.current, x: dragStart.current.vx + (e.clientX - dragStart.current.mx), y: dragStart.current.vy + (e.clientY - dragStart.current.my) };
    setViewport(next); patchViewport(next);
  }
  function onPointerUp(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    isDragging.current = false;
    dragStart.current  = null;
  }

  const zoomBy = (f: number) => {
    const next = { ...viewportRef.current, zoom: clamp(viewportRef.current.zoom * f, ZOOM_MIN, ZOOM_MAX) };
    setViewport(next); patchViewport(next);
  };

  // Hint shows only on a truly blank board — it disappears the moment a
  // container is added OR a stroke exists (canUndo reflects own strokes).
  const empty = showBlankHint && notes.length === 0 && !canUndo;

  return (
    <div
      ref={containerRef}
      className="mode-b-canvas whiteboard-canvas"
      data-tool={tool}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="mode-b-inner"
        style={{ transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})` }}
      >
        {background}
        {notes.map((note) => (
          <FreeTextBox
            key={keyAliasRef.current.get(note.id) ?? note.id}
            note={note}
            startEditing={note.id === freshBoxId}
            onUpdated={onNoteUpdated}
            onDeleted={(id) => { if (id === freshBoxId) setFreshBoxId(null); onNoteDeleted(id); }}
            onPersistTemp={persistTemp}
          />
        ))}
      </div>

      <DrawingCanvas
        ref={drawingRef}
        pageId={pageId}
        mushafPage={WB_PAGE}
        tool={tool}
        strokeColor={activeColor}
        strokeWidth={activeSize}
        viewport={viewport}
        roomSocket={roomSocket ?? null}
        onTextPlace={createTempAt}
        eraserRadius={eraserSize}
        onHistoryChange={(u, r) => { setCanUndo(u); setCanRedo(r); }}
      />

      <CanvasToolRail
        activeTool={tool}
        onToolChange={setTool}
        penColor={penColor}
        onPenColorChange={setPenColor}
        highlightColor={hlColor}
        onHighlightColorChange={setHlColor}
        strokeSize={activeSize}
        onStrokeSizeChange={(s) => (isHighlight ? setHlSize(s) : setPenSize(s))}
        eraserSize={eraserSize}
        onEraserSizeChange={setEraserSize}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => drawingRef.current?.undo()}
        onRedo={() => drawingRef.current?.redo()}
      />

      <div className="mode-b-zoom-controls" onPointerDown={(e) => e.stopPropagation()}>
        <button className="mode-b-zoom-btn" title="Zoom in"  onClick={() => zoomBy(1.2)}>+</button>
        <span className="mode-b-zoom-label">{Math.round(viewport.zoom * 100)}%</span>
        <button className="mode-b-zoom-btn" title="Zoom out" onClick={() => zoomBy(1 / 1.2)}>−</button>
        <button className="mode-b-zoom-btn" title="Reset view" style={{ fontSize: "0.7rem" }}
          onClick={() => { const next = { x: 0, y: 0, zoom: 1 }; setViewport(next); patchViewport(next); }}>↺</button>
      </div>

      {empty && (
        <div className="whiteboard-hint" aria-hidden>
          <p className="whiteboard-hint-title">Blank whiteboard</p>
          <p className="whiteboard-hint-body">
            Pick the <strong>Text</strong> tool and click to drop a note — then type
            <code> /ayah 2:255</code> or <code> /tabari</code> to pull in verses &amp; tafsīr.
            Use the <strong>pen</strong> to annotate around them.
          </p>
          {/* The canvas is not the only way to write here. Said plainly because
              the instruction above reads as the whole story otherwise, and the
              document surface is a click away in the bar above. */}
          <p className="whiteboard-hint-body">
            Writing prose instead? Switch to <strong>notes</strong> in the bar above
            for a plain document — same slash commands, no surah required.
          </p>
        </div>
      )}
    </div>
  );
}
