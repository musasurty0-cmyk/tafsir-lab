"use client";

/**
 * FocusAnnotation — full-screen word/ayah annotation canvas (Phase 7).
 *
 * Opens instantly when a word or ayah-end marker is clicked in Mode B.
 * Shows the Arabic text of the focused ayah centred on a blank canvas,
 * with the specific word highlighted if this is a word-level focus.
 * The user can draw freely on top with pen/highlight/arrow/eraser.
 *
 * Annotations are saved to localStorage keyed per word or ayah so they
 * persist between sessions without a DB round-trip.
 *
 * Storage key format:
 *   word-level:  tl-focus-<verseKey>-<wordPos>  (e.g. "tl-focus-1:1-1")
 *   ayah-level:  tl-focus-<verseKey>-ayah        (e.g. "tl-focus-1:1-ayah")
 *
 * Keyboard:
 *   P / L / A / E  — switch tool
 *   ⌘Z / Ctrl+Z    — undo last stroke
 *   Escape          — close
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Verse } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

export type FocusTool = "pen" | "highlight" | "arrow" | "eraser";

interface Point { x: number; y: number; }

interface Stroke {
  id:      string;
  tool:    FocusTool;
  points:  Point[];
  color:   string;
  width:   number;
  opacity: number;
}

// ── Config ─────────────────────────────────────────────────────────────────

const TOOL_CFG = {
  pen:       { color: "#1a1a2e", width: 2,  opacity: 1.00 },
  highlight: { color: "#fbbf24", width: 14, opacity: 0.35 },
  arrow:     { color: "#1a1a2e", width: 2,  opacity: 1.00 },
} as const;

const FOCUS_TOOLS: { id: FocusTool; label: string; title: string }[] = [
  { id: "pen",       label: "✏️", title: "Pen (P)"      },
  { id: "highlight", label: "🟡", title: "Highlight (L)" },
  { id: "arrow",     label: "→",  title: "Arrow (A)"    },
  { id: "eraser",    label: "◻",  title: "Eraser (E)"   },
];

const ERASER_RADIUS = 15;

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
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      const mx = (stroke.points[i - 1].x + stroke.points[i].x) / 2;
      const my = (stroke.points[i - 1].y + stroke.points[i].y) / 2;
      ctx.quadraticCurveTo(stroke.points[i - 1].x, stroke.points[i - 1].y, mx, my);
    }
    ctx.lineTo(stroke.points[stroke.points.length - 1].x, stroke.points[stroke.points.length - 1].y);
    ctx.stroke();
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

// ── Component ─────────────────────────────────────────────────────────────

export default function FocusAnnotation({ verses, verseKey, wordPos, onClose, onOpenTafsir }: Props) {
  const [, ayahNumStr] = verseKey.split(":");
  const ayahNum = Number(ayahNumStr);
  const verse   = verses.find((v) => v.verse_key === verseKey) ?? verses[0];

  // ── Drawing state ──────────────────────────────────────────────────────
  const [tool, setTool]       = useState<FocusTool>("pen");
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

  // Sync ref so pointer handlers always see latest strokes
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  // Load persisted strokes on mount (or when focus target changes)
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

  // Cleanup timers on unmount
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
    ctx.scale(dpr, dpr); // all stroke coords are in CSS px
    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (activeStroke.current) drawStroke(ctx, activeStroke.current);
    ctx.restore();
  }, []);

  // Re-render whenever strokes change
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }, [render, strokes]);

  // ResizeObserver so canvas stays in sync with body size
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

  // ── Suppress iOS long-press callout (copy/search/translate popup) ────────
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
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = toCanvas(e);
    if (tool === "eraser") { eraseAt(pt.x, pt.y); return; }
    const cfg = TOOL_CFG[tool as keyof typeof TOOL_CFG];
    isDrawing.current    = true;
    activeStroke.current = {
      id: crypto.randomUUID(), tool, points: [pt], ...cfg,
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
    // Debounce save
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

  const cursor = tool === "eraser" ? "cell" : "crosshair";

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="fa-overlay">
      {/* ── Toolbar ── */}
      <div className="fa-toolbar">
        <div className="fa-toolbar-label">
          {focusWord
            ? <><span dir="rtl" className="fa-label-ar">{focusWord.text}</span> <span className="fa-label-ref">· {verseKey}</span></>
            : <><span className="fa-label-ref">Ayah {ayahNum} · {verseKey}</span></>
          }
        </div>

        <div className="fa-toolbar-tools">
          {FOCUS_TOOLS.map((t) => (
            <button
              key={t.id}
              className="fa-tool-btn"
              data-active={tool === t.id ? "true" : "false"}
              title={t.title}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          ))}
          <div className="fa-toolbar-sep" />
          <button
            className="fa-tool-btn"
            title="Undo last stroke (⌘Z)"
            disabled={strokes.length === 0}
            onClick={undo}
          >
            ↩
          </button>
          <button
            className="fa-tool-btn fa-tool-btn--danger"
            title="Clear all strokes"
            disabled={strokes.length === 0}
            onClick={clearAll}
          >
            ✕
          </button>
        </div>

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

      {/* ── Main row: drawing canvas + notes panel ── */}
      <div className="fa-main">

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
          {/* Word info header */}
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

          {/* Notes label */}
          <div className="fa-notes-label">Notes</div>

          {/* Text notes textarea */}
          <textarea
            className="fa-notes-textarea"
            placeholder={focusWord
              ? `Write your notes on "${focusWord.text}"…`
              : "Write your notes on this ayah…"}
            value={noteText}
            onChange={handleNoteChange}
            spellCheck
          />

          {/* Saved indicator */}
          <div className="fa-notes-footer">
            <span
              className="fa-notes-saved"
              data-visible={noteSaved ? "true" : "false"}
            >
              Saved
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
