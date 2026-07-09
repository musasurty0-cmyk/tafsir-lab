"use client";

/**
 * EditorInkLayer — transparent ink overlay for the Mode A typed notebook.
 *
 * Council round-3 verdict (unanimous): a student typing notes can't circle
 * a word, underline their own sentence, or handwrite an Arabic term without
 * leaving the editor. This overlay makes ink a property of the page:
 *
 *   • absolutely-positioned canvas pinned inside .page-editor — strokes
 *     live in content space and scroll WITH the typed text
 *   • pen + highlighter + eraser (reusing the shared lib/ink engine with
 *     pressure-sensitive rendering)
 *   • finger scrolls (touch passes through), pen draws — same input
 *     discipline as the Mushaf canvas
 *   • strokes persist per-user via the drawings API with surface:"editor"
 *     (server merges, so Mushaf canvas saves never clobber these)
 *   • collaborators' editor ink renders at reduced opacity (poll-based)
 *
 * Deliberately NOT here (council traps): pan/zoom, arrows/shapes,
 * handwriting recognition, note anchoring. V1 accepts stroke drift if
 * paragraphs above are heavily reflowed.
 */

import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef,
} from "react";
import {
  type Pt, type InkStroke,
  normPts, hitTest, drawSmooth, strokeSurface,
} from "@/lib/ink";

// ── Public types ───────────────────────────────────────────────────────────

export type EditorInkTool = "off" | "pen" | "highlight" | "eraser";

export interface EditorInkHandle {
  undo: () => void;
}

interface OtherInkLayer { authorId: string; strokes: InkStroke[] }

interface Props {
  pageId:          string;
  tool:            EditorInkTool;
  color:           string;
  /** Called whenever the user's editor-ink undo stack changes. */
  onCanUndoChange?: (canUndo: boolean) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PEN_WIDTH       = 2.2;
const HIGHLIGHT_WIDTH = 14;
const ERASER_RADIUS   = 16;
const SAVE_DEBOUNCE   = 1200;
const OTHERS_POLL_MS  = 20000;

const OPACITY: Record<"pen" | "highlight", number> = { pen: 1, highlight: 0.4 };

// ── Component ──────────────────────────────────────────────────────────────

const EditorInkLayer = forwardRef<EditorInkHandle, Props>(function EditorInkLayer(
  { pageId, tool, color, onCanUndoChange },
  ref,
) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef(0);

  const toolRef  = useRef(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  const colorRef = useRef(color);
  useEffect(() => { colorRef.current = color; }, [color]);

  const strokesRef      = useRef<InkStroke[]>([]);
  const othersRef       = useRef<OtherInkLayer[]>([]);
  const isDrawingRef    = useRef(false);
  const activePtsRef    = useRef<Pt[]>([]);
  const activeToolRef   = useRef<"pen" | "highlight">("pen");
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCanUndoRef    = useRef(onCanUndoChange);
  useEffect(() => { onCanUndoRef.current = onCanUndoChange; }, [onCanUndoChange]);

  // ── Render ─────────────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const dpr  = window.devicePixelRatio || 1;
    const cssW = parent.clientWidth;
    const cssH = parent.scrollHeight; // full content height — scrolls with text
    if (!cssW || !cssH) return;

    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
      canvas.style.height = `${cssH}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Collaborators' editor ink — softened
    for (const layer of othersRef.current) {
      for (const s of layer.strokes) {
        const pts = normPts(s.points as unknown[]);
        drawSmooth(ctx, pts, s.color, s.width, s.opacity * 0.65, s.tool === "pen");
      }
    }

    // My committed strokes
    for (const s of strokesRef.current) {
      const pts = normPts(s.points as unknown[]);
      drawSmooth(ctx, pts, s.color, s.width, s.opacity, s.tool === "pen");
    }

    // Active stroke
    if (isDrawingRef.current && activePtsRef.current.length > 0) {
      const t = activeToolRef.current;
      drawSmooth(
        ctx, activePtsRef.current, colorRef.current,
        t === "highlight" ? HIGHLIGHT_WIDTH : PEN_WIDTH,
        OPACITY[t], t === "pen",
      );
    }
  }, []);

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }, [render]);

  // Re-render when the editor content grows/reflows (typing below the ink)
  useEffect(() => {
    const parent = canvasRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(scheduleRender);
    ro.observe(parent);
    // .page-editor height follows its content; observe the ProseMirror node too
    const pm = parent.querySelector(".page-editor-content");
    if (pm) ro.observe(pm);
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [scheduleRender]);

  // ── Persistence ────────────────────────────────────────────────────────

  const putStrokes = useCallback((keepalive = false) => {
    return fetch(`/api/pages/${pageId}/drawings`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ strokes: strokesRef.current, surface: "editor" }),
      keepalive,
    });
  }, [pageId]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      putStrokes().catch(() => {
        setTimeout(() => { putStrokes().catch(() => {}); }, 3000);
      });
    }, SAVE_DEBOUNCE);
  }, [putStrokes]);

  // Initial load + collaborator poll
  useEffect(() => {
    let cancelled = false;

    function load() {
      fetch(`/api/pages/${pageId}/drawings`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { myStrokes?: InkStroke[]; otherLayers?: OtherInkLayer[] } | null) => {
          if (!d || cancelled) return;
          strokesRef.current = (d.myStrokes ?? []).filter((s) => strokeSurface(s) === "editor");
          othersRef.current  = (d.otherLayers ?? []).map((l) => ({
            authorId: l.authorId,
            strokes:  l.strokes.filter((s) => strokeSurface(s) === "editor"),
          }));
          onCanUndoRef.current?.(strokesRef.current.length > 0);
          scheduleRender();
        })
        .catch(() => {});
    }

    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, OTHERS_POLL_MS);

    // Flush pending ink before the tab suspends
    function flush() {
      if (!saveTimerRef.current) return;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      putStrokes(true).catch(() => {});
    }
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [pageId, putStrokes, scheduleRender]);

  // ── Undo handle ────────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    undo() {
      if (!strokesRef.current.length) return;
      strokesRef.current = strokesRef.current.slice(0, -1);
      onCanUndoRef.current?.(strokesRef.current.length > 0);
      scheduleSave();
      scheduleRender();
    },
  }), [scheduleSave, scheduleRender]);

  // ── Pointer handling ───────────────────────────────────────────────────
  // Finger (touch) is ignored entirely → native scroll still works via
  // touch-action. Pen + mouse draw/erase.

  function toContent(e: React.PointerEvent): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function eraseAt(x: number, y: number) {
    const prev = strokesRef.current;
    const next = prev.filter((s) => !hitTest(normPts(s.points as unknown[]), x, y, ERASER_RADIUS));
    if (next.length !== prev.length) {
      strokesRef.current = next;
      onCanUndoRef.current?.(next.length > 0);
      scheduleSave();
      scheduleRender();
    }
  }

  function onDown(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (toolRef.current === "off") return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const [x, y] = toContent(e);
    if (toolRef.current === "eraser") { eraseAt(x, y); return; }

    const pressure = e.pointerType === "pen" ? Math.max(0.1, e.pressure) : 0.5;
    isDrawingRef.current  = true;
    activeToolRef.current = toolRef.current as "pen" | "highlight";
    activePtsRef.current  = [[x, y, pressure]];
    scheduleRender();
  }

  function onMove(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (toolRef.current === "off") return;
    if (toolRef.current === "eraser") {
      if (e.buttons & 1) { const [x, y] = toContent(e); eraseAt(x, y); }
      return;
    }
    if (!isDrawingRef.current) return;
    e.stopPropagation();

    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const rect = canvasRef.current!.getBoundingClientRect();
    for (const ev of events) {
      const pressure = ev.pointerType === "pen" ? Math.max(0.1, ev.pressure) : 0.5;
      activePtsRef.current.push([ev.clientX - rect.left, ev.clientY - rect.top, pressure]);
    }
    scheduleRender();
  }

  function onUp(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (!isDrawingRef.current) return;
    e.preventDefault();

    isDrawingRef.current = false;
    const pts = activePtsRef.current;
    activePtsRef.current = [];

    if (pts.length >= 1) {
      const t = activeToolRef.current;
      strokesRef.current = [...strokesRef.current, {
        id:      crypto.randomUUID(),
        tool:    t,
        points:  pts,
        color:   colorRef.current,
        width:   t === "highlight" ? HIGHLIGHT_WIDTH : PEN_WIDTH,
        opacity: OPACITY[t],
        surface: "editor",
      }];
      onCanUndoRef.current?.(true);
      scheduleSave();
    }
    scheduleRender();
  }

  const active = tool !== "off";

  return (
    <canvas
      ref={canvasRef}
      className="editor-ink-canvas"
      data-active={active ? "true" : "false"}
      style={{
        pointerEvents: active ? "auto" : "none",
        // pan-y: finger scrolling keeps working while the pen draws
        touchAction: "pan-y",
        cursor: tool === "pen" ? "crosshair" : tool === "highlight" ? "cell" : tool === "eraser" ? "cell" : "default",
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
});

export default EditorInkLayer;
