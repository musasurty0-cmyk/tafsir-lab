"use client";

/**
 * FocusAnnotation — full-screen word/ayah annotation canvas (Phase 7).
 *
 * Opens instantly when a word or ayah-end marker is clicked in Mode B.
 * Shows the Arabic text of the focused ayah centred on a blank canvas,
 * with the specific word highlighted if this is a word-level focus.
 *
 * Tool selection, colour, and stroke width are handled by the SAME
 * CanvasToolRail component used on the main canvas — giving one consistent
 * toolbar experience across both surfaces.  The rail sits on the left of the
 * drawing area, identical to its position in Mode B.
 *
 * The "hand" tool has no pan action here (the view is fixed), but selecting
 * it still suppresses accidental drawing, which is useful.
 *
 * Annotations are saved to localStorage keyed per word or ayah so they
 * persist between sessions without a DB round-trip.
 *
 * Storage key format:
 *   word-level:  tl-focus-<verseKey>-<wordPos>  (e.g. "tl-focus-1:1-1")
 *   ayah-level:  tl-focus-<verseKey>-ayah        (e.g. "tl-focus-1:1-ayah")
 *
 * Keyboard:
 *   H / P / L / A / E  — switch tool
 *   ⌘Z / Ctrl+Z        — undo last stroke
 *   Escape              — close
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Verse } from "@/lib/types";
import type { DrawTool } from "./DrawingCanvas";
import CanvasToolRail, {
  type ToolSettings,
  DEFAULT_TOOL_SETTINGS,
} from "./CanvasToolRail";

// ── Types ──────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

interface Stroke {
  id:      string;
  tool:    Exclude<DrawTool, "hand" | "eraser">;
  points:  Point[];
  color:   string;
  width:   number;
  opacity: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ERASER_RADIUS = 15;

const TOOL_OPACITY: Record<"pen" | "highlight" | "arrow", number> = {
  pen:       1.00,
  highlight: 0.40,
  arrow:     1.00,
};

// ── Storage ────────────────────────────────────────────────────────────────

function storageKey(verseKey: string, wordPos: number | null): string {
  return `tl-focus-${verseKey}-${wordPos ?? "ayah"}`;
}

function loadStrokes(verseKey: string, wordPos: number | null): Stroke[] {
  try {
    const raw = localStorage.getItem(storageKey(verseKey, wordPos));
    return raw ? (JSON.parse(raw) as Stroke[]) : [];
  } catch { return []; }
}

function saveStrokes(verseKey: string, wordPos: number | null, strokes: Stroke[]) {
  try { localStorage.setItem(storageKey(verseKey, wordPos), JSON.stringify(strokes)); }
  catch { /* quota exceeded — ignore */ }
}

// ── Math helpers ───────────────────────────────────────────────────────────

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
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

// ── Canvas rendering ───────────────────────────────────────────────────────

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (!stroke.points.length) return;
  ctx.save();
  ctx.globalAlpha = stroke.opacity;
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
    // Midpoint-quadratic smooth curve (same algorithm as the main canvas)
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    if (stroke.points.length === 1) {
      ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
    } else if (stroke.points.length === 2) {
      ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
      ctx.stroke();
    } else {
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const mx = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const my = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, mx, my);
      }
      ctx.lineTo(stroke.points[stroke.points.length - 1].x, stroke.points[stroke.points.length - 1].y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  verses:         Verse[];
  verseKey:       string;        // e.g. "1:1"
  wordPos:        number | null; // null → ayah-level focus
  onClose:        () => void;
  onOpenTafsir?:  (verseKey: string) => void;
}

// ── Trash icon (clear-all button in the header bar) ───────────────────────

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function FocusAnnotation({ verses, verseKey, wordPos, onClose, onOpenTafsir }: Props) {
  const [, ayahNumStr] = verseKey.split(":");
  const ayahNum = Number(ayahNumStr);
  const verse   = verses.find((v) => v.verse_key === verseKey) ?? verses[0];

  // ── Tool + settings — same types as the main canvas ──────────────────
  const [tool, setTool]         = useState<DrawTool>("pen");
  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_TOOL_SETTINGS);

  // ── Stroke state ──────────────────────────────────────────────────────
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef            = useRef<Stroke[]>([]);
  const activeStroke          = useRef<Stroke | null>(null);
  const isDrawing             = useRef(false);
  const canvasRef             = useRef<HTMLCanvasElement>(null);
  const bodyRef               = useRef<HTMLDivElement>(null);
  const rafRef                = useRef<number>(0);

  // ── Text notes state ──────────────────────────────────────────────────
  const [noteText, setNoteText]   = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const noteTimerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteSavedTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  // Load persisted strokes on mount or when focus target changes
  useEffect(() => {
    const loaded = loadStrokes(verseKey, wordPos);
    setStrokes(loaded);
    strokesRef.current = loaded;
  }, [verseKey, wordPos]);

  // Load persisted text note
  useEffect(() => {
    const key = `tl-note-text-${verseKey}-${wordPos ?? "ayah"}`;
    setNoteText(localStorage.getItem(key) ?? "");
  }, [verseKey, wordPos]);

  useEffect(() => () => {
    if (noteTimerRef.current)      clearTimeout(noteTimerRef.current);
    if (noteSavedTimerRef.current) clearTimeout(noteSavedTimerRef.current);
  }, []);

  // ── Canvas render ──────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const body   = bodyRef.current;
    if (!canvas || !body) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = body.getBoundingClientRect();
    const w = Math.round(width * dpr), h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
      canvas.style.width  = `${Math.round(width)}px`;
      canvas.style.height = `${Math.round(height)}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
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

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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

  // ── Pointer coordinate helper ──────────────────────────────────────────

  function toCanvas(e: React.PointerEvent): Point {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ── Eraser ─────────────────────────────────────────────────────────────

  function eraseAt(cx: number, cy: number) {
    setStrokes((prev) => {
      const next = prev.filter((s) => !strokeHit(s, cx, cy, ERASER_RADIUS));
      if (next.length !== prev.length) {
        strokesRef.current = next;
        saveStrokes(verseKey, wordPos, next);
      }
      return next;
    });
  }

  // ── Pointer events ─────────────────────────────────────────────────────

  function onDown(e: React.PointerEvent) {
    if (tool === "hand") return; // hand suppresses drawing; no panning needed here
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = toCanvas(e);
    if (tool === "eraser") { eraseAt(pt.x, pt.y); return; }

    // Mirror ModeBPage: highlight has its own colour/width; pen+arrow share pen settings
    const color   = tool === "highlight" ? settings.highlight.color : settings.pen.color;
    const width   = tool === "highlight" ? settings.highlight.width : settings.pen.width;
    const opacity = TOOL_OPACITY[tool as "pen" | "highlight" | "arrow"] ?? 1.0;

    isDrawing.current    = true;
    activeStroke.current = {
      id:      crypto.randomUUID(),
      tool:    tool as Exclude<DrawTool, "hand" | "eraser">,
      points:  [pt],
      color,
      width,
      opacity,
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }

  function onMove(e: React.PointerEvent) {
    if (!isDrawing.current || !activeStroke.current) return;
    const pt = toCanvas(e);
    if (tool === "eraser") { if (e.buttons & 1) eraseAt(pt.x, pt.y); return; }
    if (activeStroke.current.tool === "arrow") {
      activeStroke.current = {
        ...activeStroke.current,
        points: [activeStroke.current.points[0], pt],
      };
    } else {
      activeStroke.current.points.push(pt);
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }

  function onUp() {
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
    setStrokes([]);
    strokesRef.current = [];
    saveStrokes(verseKey, wordPos, []);
  }

  // ── Notes change handler ───────────────────────────────────────────────

  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setNoteText(val);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`tl-note-text-${verseKey}-${wordPos ?? "ayah"}`, val);
      } catch { /* quota */ }
      setNoteSaved(true);
      if (noteSavedTimerRef.current) clearTimeout(noteSavedTimerRef.current);
      noteSavedTimerRef.current = setTimeout(() => setNoteSaved(false), 1600);
    }, 600);
  }

  // ── Derived ────────────────────────────────────────────────────────────

  const focusWord = wordPos != null
    ? verse?.words.find((w) => w.char_type_name === "word" && w.position === wordPos)
    : null;

  const cursor = tool === "hand" ? "default" : tool === "eraser" ? "cell" : "crosshair";

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="fa-overlay">

      {/* ── Top bar: label + utility actions + close ── */}
      <div className="fa-toolbar">

        <div className="fa-toolbar-label">
          {focusWord
            ? <><span dir="rtl" className="fa-label-ar">{focusWord.text}</span><span className="fa-label-ref">· {verseKey}</span></>
            : <span className="fa-label-ref">Ayah {ayahNum} · {verseKey}</span>
          }
        </div>

        {/* Clear-all button — in the top bar since CanvasToolRail doesn't have one */}
        <button
          className="fa-clear-btn"
          title="Clear all strokes"
          disabled={strokes.length === 0}
          onClick={clearAll}
        >
          <TrashIcon />
          Clear
        </button>

        {onOpenTafsir && (
          <button
            className="fa-tafsir-btn"
            title="Open Tafsir for this verse"
            onClick={() => { onOpenTafsir(verseKey); onClose(); }}
          >
            Tafsir
          </button>
        )}

        <button className="fa-close-btn" onClick={onClose} title="Close (Esc)">×</button>
      </div>

      {/* ── Main row ── */}
      <div className="fa-main">

        {/* Left column: the same CanvasToolRail as the main canvas.
            Wrapped in .fa-rail which resets the rail's absolute positioning
            so it flows as a normal flex item rather than overlaying the canvas. */}
        <div className="fa-rail">
          <CanvasToolRail
            tool={tool}
            onToolChange={setTool}
            settings={settings}
            onSettings={setSettings}
            canUndo={strokes.length > 0}
            canRedo={false}
            onUndo={undo}
            onRedo={() => {}}
          />
        </div>

        {/* Drawing body */}
        <div ref={bodyRef} className="fa-body">

          {/* Arabic text — pointer-events:none so canvas captures all input */}
          <div className="fa-arabic-display" dir="rtl" style={{ pointerEvents: "none" }}>
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
                <span
                  key={w.position}
                  className={`fa-word${isTarget ? " fa-word--focus" : ""}`}
                >
                  {w.text}{" "}
                </span>
              );
            })}
          </div>

          {/* Drawing canvas — covers entire body */}
          <canvas
            ref={canvasRef}
            className="fa-canvas"
            style={{ cursor }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>

        {/* ── Notes panel ── */}
        <div className="fa-notes">
          <div className="fa-notes-word">
            {focusWord ? (
              <>
                <span className="fa-notes-ar">{focusWord.text}</span>
                {focusWord.transliteration?.text && (
                  <span className="fa-notes-translit">{focusWord.transliteration.text}</span>
                )}
                {focusWord.translation?.text && (
                  <span className="fa-notes-meaning">{focusWord.translation.text}</span>
                )}
              </>
            ) : (
              <span className="fa-notes-ayah-ref">Ayah {ayahNum} · {verseKey}</span>
            )}
          </div>

          <div className="fa-notes-label">Notes</div>

          <textarea
            className="fa-notes-textarea"
            placeholder={focusWord
              ? `Write your notes on "${focusWord.text}"…`
              : "Write your notes on this ayah…"}
            value={noteText}
            onChange={handleNoteChange}
            spellCheck
          />

          <div className="fa-notes-footer">
            <span className="fa-notes-saved" data-visible={noteSaved ? "true" : "false"}>
              Saved
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
