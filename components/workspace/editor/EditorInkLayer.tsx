"use client";

/**
 * EditorInkLayer — stylus-first ink over the Mode A typed notebook.
 *
 * No mode toggle, no floating buttons: the PEN draws the moment it touches
 * the page (GoodNotes model). Finger scrolls and taps as normal; mouse and
 * keyboard edit text as normal. Only pointerType === "pen" inks.
 *
 * iPad Safari note: the Apple Pencil ALSO fires touch events (touchType
 * "stylus"); if the browser is allowed to handle them it claims the Pencil
 * for scrolling and cancels our pointer stream — that was the "pen moves
 * the page instead of drawing" bug. We preventDefault stylus touchstart/
 * touchmove (capture, passive:false) so the Pencil's pointer events flow.
 *
 * A slim tool pill (pen / highlighter / eraser / colors / undo) auto-appears
 * on the first pen touch and can be dismissed — zero chrome while typing.
 *
 * Strokes live in content space (they scroll with the text), persist
 * per-user via the drawings API with surface:"editor" (server merges so
 * Mushaf-canvas saves never clobber them), and collaborators' editor ink
 * renders softened via a 20s poll.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { readInkOutbox, writeInkOutbox } from "@/lib/ink-outbox";
import { withVersion } from "@/lib/poll-version";
import { shouldPoll } from "@/lib/idle";
import { PenLine, Highlighter, Eraser, Undo2, X } from "lucide-react";
import {
  type Pt, type InkStroke,
  normPts, hitTest, drawSmooth, strokeSurface, mergeServerInk,
} from "@/lib/ink";

// ── Types / constants ──────────────────────────────────────────────────────

type InkTool = "pen" | "highlight" | "eraser";

interface OtherInkLayer { authorId: string; strokes: InkStroke[] }

interface Props { pageId: string }

const INK_COLORS      = ["#dc2626", "#18181b", "#2563eb", "#16a34a", "#fbbf24"];
const PEN_WIDTH       = 2.2;
const HIGHLIGHT_WIDTH = 14;
const ERASER_RADIUS   = 16;
const SAVE_DEBOUNCE   = 1200;
const OTHERS_POLL_MS  = 20000;

const OPACITY: Record<"pen" | "highlight", number> = { pen: 1, highlight: 0.4 };

// ── Component ──────────────────────────────────────────────────────────────

export default function EditorInkLayer({ pageId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef(0);

  const [tool,  setTool]  = useState<InkTool>("pen");
  const [color, setColor] = useState(INK_COLORS[0]);
  const [pillVisible, setPillVisible] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  const toolRef  = useRef(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  const colorRef = useRef(color);
  useEffect(() => { colorRef.current = color; }, [color]);

  const strokesRef    = useRef<InkStroke[]>([]);
  const othersRef     = useRef<OtherInkLayer[]>([]);
  const isDrawingRef  = useRef(false);
  /** True while a pen pointer is in contact — lets the touch handler
   *  suppress Android's typeless stylus compat-touches. */
  const penContactRef = useRef(false);
  const activePtsRef  = useRef<Pt[]>([]);
  const activeToolRef = useRef<"pen" | "highlight">("pen");
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* What the server hasn't confirmed: strokes drawn since the last save, and
     strokes erased or undone. The server keeps any stroke it isn't told to
     delete, so an erase that never named its strokes came back on reload;
     and a poll that replaced the list wholesale could swallow a stroke drawn
     a moment before, while its save was still waiting. */
  const pendingRef    = useRef<Set<string>>(new Set());
  const deletedRef    = useRef<Set<string>>(new Set());
  /* When the server CONFIRMED each save and each erase. A poll's reply
     describes the server as it was when the poll was sent, so it says nothing
     about anything confirmed after that. Without these, a stroke whose save
     landed while a poll was in flight was missing from the reply, no longer
     pending, and so dropped -- handwriting vanished for up to 20 seconds and
     came back with the next poll. An erase confirmed mid-poll brought the
     erased stroke back for the same 20 seconds. The Muṣḥaf canvas closed
     this race long ago (DrawingCanvas syncMyStrokes); this layer had not. */
  const savedAtRef    = useRef<Map<string, number>>(new Map());
  const erasedAtRef   = useRef<Map<string, number>>(new Map());

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

    // Collaborators' editor ink — EXACT stored opacity (no viewer-side
    // dimming; strokes must render identically on every device/session).
    for (const layer of othersRef.current) {
      for (const s of layer.strokes) {
        const pts = normPts(s.points as unknown[]);
        drawSmooth(ctx, pts, s.color, s.width, s.opacity, s.tool === "pen");
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

  // Re-render when the editor content grows/reflows
  useEffect(() => {
    const parent = canvasRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(scheduleRender);
    ro.observe(parent);
    const pm = parent.querySelector(".page-editor-content");
    if (pm) ro.observe(pm);
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [scheduleRender]);

  // ── Persistence ────────────────────────────────────────────────────────

  /** Mirror what's unsaved into this browser's storage (see lib/ink-outbox). */
  const writeOutbox = useCallback(() => {
    writeInkOutbox(
      pageId, "editor",
      strokesRef.current.filter((st) => pendingRef.current.has(st.id)),
      [...deletedRef.current],
    );
  }, [pageId]);

  const putStrokes = useCallback((keepalive = false) => {
    const strokes = strokesRef.current.filter((st) => pendingRef.current.has(st.id));
    const deletedIds = [...deletedRef.current];
    if (!strokes.length && !deletedIds.length) { writeOutbox(); return Promise.resolve(null); }
    const body = JSON.stringify({ strokes, surface: "editor", deletedIds });
    return fetch(`/api/pages/${pageId}/drawings`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: keepalive && body.length < 60_000,
    }).then((r) => {
      if (!r.ok) throw new Error("save failed: " + r.status);
      const t = Date.now();
      for (const st of strokes) { pendingRef.current.delete(st.id); savedAtRef.current.set(st.id, t); }
      for (const id of deletedIds) { deletedRef.current.delete(id); erasedAtRef.current.set(id, t); }
      writeOutbox();
      return r;
    });
  }, [pageId, writeOutbox]);

  const scheduleSave = useCallback(() => {
    writeOutbox();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      putStrokes().catch(() => {
        setTimeout(() => { putStrokes().catch(() => {}); }, 3000);
      });
    }, SAVE_DEBOUNCE);
  }, [putStrokes, writeOutbox]);

  useEffect(() => {
    let cancelled = false;
    let first = true;
    pendingRef.current = new Set();
    deletedRef.current = new Set();
    savedAtRef.current = new Map();
    erasedAtRef.current = new Map();
    strokesRef.current = [];

    // Unsaved ink from an earlier visit: shown now, sent again once loaded.
    const outbox = readInkOutbox<InkStroke>(pageId, "editor");
    if (outbox) {
      for (const id of outbox.deleted) deletedRef.current.add(id);
      strokesRef.current = outbox.strokes.filter((st) => !deletedRef.current.has(st.id));
      for (const st of strokesRef.current) pendingRef.current.add(st.id);
      setCanUndo(strokesRef.current.length > 0);
      scheduleRender();
    }

    // The last version sent: unchanged ink is not sent again (lib/poll-version).
    let seen: string | null = null;
    function load() {
      const issuedAt = Date.now();   // anything confirmed after this cannot be in the reply
      fetch(withVersion(`/api/pages/${pageId}/drawings`, seen))
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { myStrokes?: InkStroke[]; otherLayers?: OtherInkLayer[]; version?: string; unchanged?: boolean } | null) => {
          if (!d || cancelled) return;
          if (d.version) seen = d.version;
          if (d.unchanged) return;
          // Merge, never replace — and never read the reply's silence about
          // anything confirmed after it was asked for (lib/ink mergeServerInk).
          strokesRef.current = mergeServerInk(
            strokesRef.current,
            (d.myStrokes ?? []).filter((s) => strokeSurface(s) === "editor"),
            { pending: pendingRef.current, deleted: deletedRef.current, savedAt: savedAtRef.current, erasedAt: erasedAtRef.current },
            issuedAt,
          );
          if (first) {
            first = false;
            if (pendingRef.current.size || deletedRef.current.size) scheduleSave();
          }
          othersRef.current  = (d.otherLayers ?? []).map((l) => ({
            authorId: l.authorId,
            strokes:  l.strokes.filter((s) => strokeSurface(s) === "editor"),
          }));
          setCanUndo(strokesRef.current.length > 0);
          scheduleRender();
        })
        .catch(() => {});
    }

    load();
    const id = setInterval(() => {
      if (shouldPoll()) load();   // visible, and someone at the page (lib/idle)
    }, OTHERS_POLL_MS);

    function flush() {
      if (!saveTimerRef.current && !pendingRef.current.size && !deletedRef.current.size) return;
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, putStrokes, scheduleRender]);

  // ── Stylus input — native capture-phase listeners on the editor ────────
  // Pen draws, everything else passes through untouched. Capture phase runs
  // before ProseMirror's handlers, so a pen tap never moves the caret.

  useEffect(() => {
    const parent = canvasRef.current?.parentElement;
    if (!parent) return;

    function toContent(e: PointerEvent): [number, number] {
      const rect = canvasRef.current!.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    }

    function eraseAt(x: number, y: number) {
      const prev = strokesRef.current;
      const next = prev.filter((s) => !hitTest(normPts(s.points as unknown[]), x, y, ERASER_RADIUS));
      if (next.length !== prev.length) {
        const kept = new Set(next.map((s) => s.id));
        for (const s of prev) if (!kept.has(s.id)) { deletedRef.current.add(s.id); pendingRef.current.delete(s.id); }
        strokesRef.current = next;
        setCanUndo(next.length > 0);
        scheduleSave();
        scheduleRender();
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType !== "pen") return;
      penContactRef.current = true; // Android: flag before compat touch events
      e.preventDefault();
      e.stopPropagation();
      setPillVisible(true);

      const [x, y] = toContent(e);
      if (toolRef.current === "eraser") { eraseAt(x, y); return; }

      try { parent!.setPointerCapture(e.pointerId); } catch { /* ok */ }
      isDrawingRef.current  = true;
      activeToolRef.current = toolRef.current as "pen" | "highlight";
      activePtsRef.current  = [[x, y, Math.max(0.1, e.pressure || 0.5)]];
      scheduleRender();
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerType !== "pen") return;
      if (toolRef.current === "eraser") {
        if (e.buttons & 1) { const [x, y] = toContent(e); eraseAt(x, y); }
        return;
      }
      if (!isDrawingRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const events = e.getCoalescedEvents?.() ?? [e];
      const rect = canvasRef.current!.getBoundingClientRect();
      for (const ev of events) {
        activePtsRef.current.push([
          ev.clientX - rect.left,
          ev.clientY - rect.top,
          Math.max(0.1, ev.pressure || 0.5),
        ]);
      }
      scheduleRender();
    }

    function onPointerUp(e: PointerEvent) {
      if (e.pointerType !== "pen") return;
      penContactRef.current = false;
      if (!isDrawingRef.current) return;
      e.preventDefault();

      isDrawingRef.current = false;
      const pts = activePtsRef.current;
      activePtsRef.current = [];

      if (pts.length >= 1) {
        const t = activeToolRef.current;
        const id = crypto.randomUUID();
        pendingRef.current.add(id);
        strokesRef.current = [...strokesRef.current, {
          id,
          tool:    t,
          points:  pts,
          color:   colorRef.current,
          width:   t === "highlight" ? HIGHLIGHT_WIDTH : PEN_WIDTH,
          opacity: OPACITY[t],
          surface: "editor",
        }];
        setCanUndo(true);
        scheduleSave();
      }
      scheduleRender();
    }

    // The stylus also emits compatibility TOUCH events. If the browser is
    // allowed to handle them it claims the pen for page scrolling and
    // CANCELS our pointer stream — pen pans, and each cancelled fragment
    // commits as a "dot".
    //   iOS Safari:      touch.touchType === "stylus" identifies the Pencil.
    //   Android Chrome:  touchType does NOT exist — so we also preventDefault
    //                    any touch that arrives while a pen pointer is in
    //                    contact (pointerdown fires before the compat touch).
    function onTouch(e: TouchEvent) {
      if (penContactRef.current) { e.preventDefault(); return; }
      let allStylus = e.changedTouches.length > 0;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i] as Touch & { touchType?: string };
        if (t.touchType !== "stylus") { allStylus = false; break; }
      }
      if (allStylus) e.preventDefault(); // fingers untouched → scroll works
    }

    parent.addEventListener("pointerdown",   onPointerDown, { capture: true });
    parent.addEventListener("pointermove",   onPointerMove, { capture: true });
    parent.addEventListener("pointerup",     onPointerUp,   { capture: true });
    parent.addEventListener("pointercancel", onPointerUp,   { capture: true });
    parent.addEventListener("touchstart",    onTouch,       { capture: true, passive: false });
    parent.addEventListener("touchmove",     onTouch,       { capture: true, passive: false });

    return () => {
      parent.removeEventListener("pointerdown",   onPointerDown, { capture: true } as EventListenerOptions);
      parent.removeEventListener("pointermove",   onPointerMove, { capture: true } as EventListenerOptions);
      parent.removeEventListener("pointerup",     onPointerUp,   { capture: true } as EventListenerOptions);
      parent.removeEventListener("pointercancel", onPointerUp,   { capture: true } as EventListenerOptions);
      parent.removeEventListener("touchstart",    onTouch,       { capture: true } as EventListenerOptions);
      parent.removeEventListener("touchmove",     onTouch,       { capture: true } as EventListenerOptions);
    };
  }, [scheduleRender, scheduleSave]);

  // ── Undo ───────────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    if (!strokesRef.current.length) return;
    const last = strokesRef.current[strokesRef.current.length - 1];
    deletedRef.current.add(last.id);
    pendingRef.current.delete(last.id);
    strokesRef.current = strokesRef.current.slice(0, -1);
    setCanUndo(strokesRef.current.length > 0);
    scheduleSave();
    scheduleRender();
  }, [scheduleSave, scheduleRender]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Display-only canvas — all input arrives via the editor container */}
      <canvas ref={canvasRef} className="editor-ink-canvas" />

      {/* Tool pill — appears on first pen touch, dismissible, zero chrome
          while typing */}
      {pillVisible && (
        <div className="editor-fab-row">
          <div className="editor-ink-pill">
            <button
              className="editor-ink-btn"
              data-active={tool === "pen" ? "true" : "false"}
              title="Pen"
              onClick={() => setTool("pen")}
            >
              <PenLine size={15} />
            </button>
            <button
              className="editor-ink-btn"
              data-active={tool === "highlight" ? "true" : "false"}
              title="Highlighter"
              onClick={() => setTool("highlight")}
            >
              <Highlighter size={15} />
            </button>
            <button
              className="editor-ink-btn"
              data-active={tool === "eraser" ? "true" : "false"}
              title="Eraser"
              onClick={() => setTool("eraser")}
            >
              <Eraser size={15} />
            </button>

            <span className="editor-ink-sep" />

            {INK_COLORS.map((c) => (
              <button
                key={c}
                className="editor-ink-swatch"
                data-active={color === c ? "true" : "false"}
                style={{ background: c }}
                title="Ink color"
                onClick={() => setColor(c)}
              />
            ))}

            <span className="editor-ink-sep" />

            <button
              className="editor-ink-btn"
              title="Undo ink"
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 size={15} />
            </button>
            <button
              className="editor-ink-btn editor-ink-done"
              title="Hide toolbar"
              onClick={() => setPillVisible(false)}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
