"use client";

/**
 * FocusAnnotation — full-screen word/ayah annotation canvas (Phase 7).
 *
 * Opens instantly when a word or ayah-end marker is clicked in Mode B.
 * Shows the Arabic text of the focused ayah centred on a blank canvas,
 * with the specific word highlighted if this is a word-level focus.
 * The user can draw freely on top with pen/highlight/arrow/eraser.
 *
 * Tool settings (colour + stroke width) are fully configurable, matching
 * the same options available on the main canvas tool rail.
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

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Verse } from "@/lib/types";
import {
  PEN_COLORS,
  HIGHLIGHT_COLORS,
  PEN_WIDTHS,
  HIGHLIGHT_WIDTHS,
} from "./CanvasToolRail";

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

// ── Constants ──────────────────────────────────────────────────────────────

const ERASER_RADIUS = 15;

// ── Icons ──────────────────────────────────────────────────────────────────

const PenIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="2" x2="22" y2="6" />
    <path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z" />
  </svg>
);

const HighlighterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 11-6 6v3h9l3-3" />
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="19" x2="19" y2="5" />
    <polyline points="9 5 19 5 19 15" />
  </svg>
);

const EraserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 20H7L3 16a2 2 0 0 1 0-2.83l10-10a2 2 0 0 1 2.83 0L21 8.17a2 2 0 0 1 0 2.83z" />
    <line x1="7" y1="20" x2="7.01" y2="20" />
  </svg>
);

const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

const ClearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

// Tool descriptors
const FOCUS_TOOLS: Array<{ id: FocusTool; Icon: () => React.ReactElement; title: string }> = [
  { id: "pen",       Icon: PenIcon,         title: "Pen (P)"       },
  { id: "highlight", Icon: HighlighterIcon, title: "Highlight (L)" },
  { id: "arrow",     Icon: ArrowIcon,       title: "Arrow (A)"     },
  { id: "eraser",    Icon: EraserIcon,      title: "Eraser (E)"    },
];

// Width preview bar — matches the bar style used in the main canvas tool rail
function WidthBar({ value, isHighlight }: { value: number; isHighlight: boolean }) {
  const h = isHighlight ? Math.min(value * 0.55, 11) : Math.min(value * 0.85, 4.5);
  return (
    <span style={{
      display:      "block",
      width:        18,
      height:       Math.max(h, 1.5),
      borderRadius: 99,
      background:   "currentColor",
      opacity:      isHighlight ? 0.55 : 0.85,
    }} />
  );
}

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

  // ── Drawing tool state ────────────────────────────────────────────────
  const [tool, setTool] = useState<FocusTool>("pen");

  // Per-tool colour and width — pen settings also apply to arrow
  const [penColor, setPenColor] = useState(PEN_COLORS[0].hex);
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1].value);   // M
  const [hlColor,  setHlColor]  = useState(HIGHLIGHT_COLORS[0].hex);
  const [hlWidth,  setHlWidth]  = useState(HIGHLIGHT_WIDTHS[1].value); // M

  // Derived values for the currently selected tool
  const showPalette  = tool === "pen" || tool === "highlight";
  const isHighlight  = tool === "highlight";
  const paletteColors = isHighlight ? HIGHLIGHT_COLORS : PEN_COLORS;
  const paletteWidths = isHighlight ? HIGHLIGHT_WIDTHS : PEN_WIDTHS;
  const activeColor   = isHighlight ? hlColor  : penColor;
  const activeWidth   = isHighlight ? hlWidth  : penWidth;

  function handleColor(c: string) { isHighlight ? setHlColor(c)  : setPenColor(c); }
  function handleWidth(w: number) { isHighlight ? setHlWidth(w)  : setPenWidth(w); }

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

    // Colour/width: highlight uses its own settings; pen and arrow share pen settings
    const color   = isHighlight ? hlColor : penColor;
    const width   = isHighlight ? hlWidth : penWidth;
    const opacity = isHighlight ? 0.35    : 1.0;

    isDrawing.current    = true;
    activeStroke.current = { id: crypto.randomUUID(), tool, points: [pt], color, width, opacity };
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

  const cursor = tool === "eraser" ? "cell" : "crosshair";

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="fa-overlay">

      {/* ── Toolbar ── */}
      <div className="fa-toolbar">

        {/* Label: focused word or ayah reference */}
        <div className="fa-toolbar-label">
          {focusWord
            ? <><span dir="rtl" className="fa-label-ar">{focusWord.text}</span><span className="fa-label-ref">· {verseKey}</span></>
            : <span className="fa-label-ref">Ayah {ayahNum} · {verseKey}</span>
          }
        </div>

        {/* Tool buttons + inline palette */}
        <div className="fa-toolbar-tools">

          {/* Tool icons */}
          {FOCUS_TOOLS.map((t) => (
            <button
              key={t.id}
              className="fa-tool-btn"
              data-active={tool === t.id ? "true" : "false"}
              title={t.title}
              onClick={() => setTool(t.id)}
            >
              <t.Icon />
            </button>
          ))}

          {/* Colour + width palette — shown only for pen and highlight */}
          {showPalette && (
            <>
              <div className="fa-toolbar-sep" />

              {/* Colour swatches */}
              <div className="fa-palette">
                {paletteColors.map((c) => (
                  <button
                    key={c.hex}
                    className="fa-palette-swatch"
                    title={c.label}
                    data-active={activeColor === c.hex ? "true" : "false"}
                    style={{ background: c.hex }}
                    onClick={() => handleColor(c.hex)}
                  />
                ))}
              </div>

              <div className="fa-toolbar-sep" />

              {/* Width buttons */}
              <div className="fa-palette-widths">
                {paletteWidths.map((w) => (
                  <button
                    key={w.value}
                    className="fa-palette-width-btn"
                    title={`${w.label} — ${w.value}px`}
                    data-active={activeWidth === w.value ? "true" : "false"}
                    style={{ color: isHighlight ? "#ca8a04" : "#374151" }}
                    onClick={() => handleWidth(w.value)}
                  >
                    <WidthBar value={w.value} isHighlight={isHighlight} />
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="fa-toolbar-sep" />

          {/* Undo / clear */}
          <button
            className="fa-tool-btn"
            title="Undo last stroke (⌘Z)"
            disabled={strokes.length === 0}
            onClick={undo}
          >
            <UndoIcon />
          </button>
          <button
            className="fa-tool-btn fa-tool-btn--danger"
            title="Clear all strokes"
            disabled={strokes.length === 0}
            onClick={clearAll}
          >
            <ClearIcon />
          </button>
        </div>

        {/* Tafsir shortcut */}
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
