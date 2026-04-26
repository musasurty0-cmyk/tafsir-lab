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
  verses:   Verse[];
  verseKey: string;        // e.g. "1:1"
  wordPos:  number | null; // null → ayah-level focus
  onClose:  () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function FocusAnnotation({ verses, verseKey, wordPos, onClose }: Props) {
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

  // Sync ref so pointer handlers always see latest strokes
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  // Load persisted strokes on mount (or when focus target changes)
  useEffect(() => {
    const loaded = loadStrokes(verseKey, wordPos);
    setStrokes(loaded);
    strokesRef.current = loaded;
  }, [verseKey, wordPos]);

  // ── Canvas render ──────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const body   = bodyRef.current;
    if (!canvas || !body) return;
    const { width, height } = body.getBoundingClientRect();
    if (canvas.width !== Math.round(width) || canvas.height !== Math.round(height)) {
      canvas.width  = Math.round(width);
      canvas.height = Math.round(height);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (activeStroke.current) drawStroke(ctx, activeStroke.current);
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

        <button className="fa-close-btn" onClick={onClose} title="Close (Esc)">×</button>
      </div>

      {/* ── Drawing body ── */}
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
    </div>
  );
}
