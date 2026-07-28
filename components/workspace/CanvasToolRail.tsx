"use client";

/**
 * CanvasToolRail — premium vertical left-side tool rail for Mode B canvas.
 *
 * Layout: fixed to the left of .mode-b-canvas, vertically centred.
 *
 * Popover behaviour (Miro / Figma style):
 *  • Appears when the user selects or hovers the active pen / highlight button.
 *  • Auto-hides after ~1.25 s of inactivity (timer resets on any interaction).
 *  • Stays open while the mouse is anywhere in the rail + popover zone.
 *  • Closes immediately when switching to a non-palette tool.
 *  • Smooth 160 ms fade + slide transition in both directions.
 *  • The popover is always in the DOM (not unmounted) so the exit transition
 *    plays correctly; `pointer-events:none` keeps it fully inert when hidden.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { DrawTool } from "./DrawingCanvas";

// ── Palette configuration ─────────────────────────────────────────────────

export const PEN_COLORS = [
  { label: "Black",  hex: "#18181b" },
  { label: "Blue",   hex: "#2563eb" },
  { label: "Red",    hex: "#dc2626" },
  { label: "Green",  hex: "#16a34a" },
  { label: "Purple", hex: "#7c3aed" },
];

export const HIGHLIGHT_COLORS = [
  { label: "Yellow", hex: "#fbbf24" },
  { label: "Green",  hex: "#86efac" },
  { label: "Pink",   hex: "#f9a8d4" },
  { label: "Blue",   hex: "#93c5fd" },
];

export const PEN_WIDTHS       = [
  { label: "F",  value: 0.5 },   // fine-liner — for writing while zoomed in
  { label: "XS", value: 1   },
  { label: "S",  value: 1.5 },
  { label: "M",  value: 2.5 },
  { label: "L",  value: 4.5 },
  { label: "XL", value: 7   },
];
export const HIGHLIGHT_WIDTHS = [
  { label: "S",  value: 10 },
  { label: "M",  value: 16 },
  { label: "L",  value: 24 },
  { label: "XL", value: 32 },
];

// Eraser hit RADIUS presets (screen px) — matches the on-canvas ring.
export const ERASER_WIDTHS = [
  { label: "S",  value: 10 },
  { label: "M",  value: 20 },
  { label: "L",  value: 32 },
  { label: "XL", value: 48 },
];

// Fine-adjust slider ranges (px)
const PEN_RANGE       = { min: 0.25, max: 14, step: 0.25 };
const HIGHLIGHT_RANGE = { min: 6,    max: 40, step: 1    };
const ERASER_RANGE    = { min: 6,    max: 60, step: 1    };

// ── Exported defaults ─────────────────────────────────────────────────────

export const DEFAULT_PEN_COLOR       = "#18181b";
/** 1.5px. Within PEN_RANGE (0.25–14, step 0.25) so the slider lands on it
 *  exactly and the preview dot matches the rendered stroke width. */
export const DEFAULT_PEN_SIZE        = 1.5;
export const DEFAULT_HIGHLIGHT_COLOR = "#fbbf24";
export const DEFAULT_HIGHLIGHT_SIZE  = 14;
export const DEFAULT_ERASER_SIZE     = 20;
/** localStorage key remembering the last used eraser size */
export const ERASER_SIZE_KEY         = "tl-eraser-size";
/** localStorage key remembering the last used pen width */
export const PEN_SIZE_KEY            = "tl-pen-size";

const HIDE_DELAY_MS = 1250;

// ── Icons ─────────────────────────────────────────────────────────────────

const HandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-4 0v0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/>
    <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
  </svg>
);

const PenIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="2" x2="22" y2="6"/>
    <path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z"/>
  </svg>
);

const HighlighterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 11-6 6v3h9l3-3"/>
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
  </svg>
);

const ArrowIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="19" x2="19" y2="5"/>
    <polyline points="9 5 19 5 19 15"/>
  </svg>
);

const EraserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 20H7L3 16a2 2 0 0 1 0-2.83l10-10a2 2 0 0 1 2.83 0L21 8.17a2 2 0 0 1 0 2.83z"/>
    <line x1="7" y1="20" x2="7.01" y2="20"/>
  </svg>
);

const TextIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
);

const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6"/>
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
  </svg>
);

const RedoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 7v6h-6"/>
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
  </svg>
);

const ClearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

// ── Width preview ─────────────────────────────────────────────────────────

function WidthBar({ value, isHighlight }: { value: number; isHighlight: boolean }) {
  const h = isHighlight ? Math.min(value * 0.55, 11) : Math.min(value * 0.85, 4.5);
  return (
    <span
      style={{
        display: "block",
        width: 20,
        height: Math.max(h, 1.5),
        borderRadius: 99,
        background: "currentColor",
        opacity: isHighlight ? 0.55 : 0.85,
      }}
    />
  );
}

// ── Rail tool descriptors ─────────────────────────────────────────────────

const RAIL_TOOLS: { id: DrawTool; Icon: () => React.ReactElement; title: string }[] = [
  { id: "hand",      Icon: HandIcon,        title: "Pan  H"       },
  { id: "pen",       Icon: PenIcon,         title: "Pen  P"       },
  { id: "highlight", Icon: HighlighterIcon, title: "Highlight  L" },
  { id: "arrow",     Icon: ArrowIcon,       title: "Arrow  A"     },
  { id: "text",      Icon: TextIcon,        title: "Text box  T"  },
  { id: "eraser",    Icon: EraserIcon,      title: "Eraser  E"    },
];

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  activeTool:             DrawTool;
  onToolChange:           (t: DrawTool) => void;
  penColor:               string;
  onPenColorChange:       (c: string) => void;
  highlightColor:         string;
  onHighlightColorChange: (c: string) => void;
  /** Size for whichever tool is currently active (pen or highlight). */
  strokeSize:             number;
  onStrokeSizeChange:     (s: number) => void;
  /** Eraser hit radius (screen px). Optional — rail hides the eraser
   *  popover when the host doesn't manage a size. */
  eraserSize?:            number;
  onEraserSizeChange?:    (s: number) => void;
  canUndo:                boolean;
  canRedo:                boolean;
  onUndo:                 () => void;
  onRedo:                 () => void;
  /** When provided, a trash button appears at the bottom of the rail. */
  onClear?:               () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function CanvasToolRail({
  activeTool, onToolChange,
  penColor, onPenColorChange,
  highlightColor, onHighlightColorChange,
  strokeSize, onStrokeSizeChange,
  eraserSize, onEraserSizeChange,
  canUndo, canRedo,
  onUndo, onRedo,
  onClear,
}: Props) {

  // ── Popover open / closed state ─────────────────────────────────────────
  // The popover is always present in the DOM so its CSS exit transition plays.
  // `pointer-events: none` when closed keeps it fully inert.

  const [popoverOpen, setPopoverOpen] = useState(false);

  // Eraser gets a popover only when the host manages its size.
  const eraserHasPopover = eraserSize != null && !!onEraserSizeChange;

  // Track the last popover-bearing tool so the popover shows correct content
  // while fading out after the user switches to arrow / hand / text.
  const lastPaletteToolRef = useRef<"pen" | "highlight" | "eraser">("pen");
  const isCurrentlyPalette =
    activeTool === "pen" || activeTool === "highlight" ||
    (activeTool === "eraser" && eraserHasPopover);
  if (isCurrentlyPalette) lastPaletteToolRef.current = activeTool as "pen" | "highlight" | "eraser";

  const popoverTool = lastPaletteToolRef.current;
  const isEraser    = popoverTool === "eraser";
  const isHighlight = popoverTool === "highlight";
  const colors      = isHighlight ? HIGHLIGHT_COLORS : PEN_COLORS;
  const widths      = isHighlight ? HIGHLIGHT_WIDTHS  : PEN_WIDTHS;
  const activeColor = isHighlight ? highlightColor : penColor;

  // ── Timer helpers ───────────────────────────────────────────────────────

  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setPopoverOpen(false), HIDE_DELAY_MS);
  }, []);

  const openAndSchedule = useCallback(() => {
    cancelHide();
    setPopoverOpen(true);
    // schedule auto-hide from the moment of opening
    hideTimerRef.current = setTimeout(() => setPopoverOpen(false), HIDE_DELAY_MS);
  }, [cancelHide]);

  // Cleanup on unmount
  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }, []);

  // When activeTool changes externally (keyboard shortcut etc.), update popover
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (activeTool === "pen" || activeTool === "highlight" ||
        (activeTool === "eraser" && eraserHasPopover)) {
      openAndSchedule();
    } else {
      cancelHide();
      setPopoverOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  // ── Colour / size handlers ──────────────────────────────────────────────

  function handleColor(c: string) {
    if (isHighlight) onHighlightColorChange(c);
    else             onPenColorChange(c);
    scheduleHide(); // interaction resets the auto-hide clock
  }
  function handleWidth(w: number) {
    onStrokeSizeChange(w);
    scheduleHide();
  }
  function handleEraserSize(w: number) {
    onEraserSizeChange?.(w);
    scheduleHide();
  }

  // ── Rail mouse zone handlers ────────────────────────────────────────────
  // onMouseEnter: hovering the rail while pen/highlight is active → keep open.
  // onMouseLeave: mouse exits the rail (including moving through the gap into
  //              the popover) → start the hide timer. The popover's own
  //              onMouseEnter cancels it if the user bridges the gap.

  function onRailEnter() {
    if (isCurrentlyPalette) {
      cancelHide();
      setPopoverOpen(true);
    }
  }
  function onRailLeave() {
    if (popoverOpen) scheduleHide();
  }

  // iOS Safari frequently does NOT synthesise a `click` for an Apple Pencil
  // tap, so onClick-only buttons ignore the stylus (you "had to use a finger"
  // to switch tools). Fire the same action on the pen's pointerup. If a late
  // click DOES also arrive on some devices, penGuardRef makes onClick skip it,
  // so nothing double-fires (which matters for undo/redo/clear).
  const penGuardRef = useRef(0);
  function penTap(fn: () => void) {
    return (e: React.PointerEvent) => {
      if (e.pointerType !== "pen") return;
      e.preventDefault();
      e.stopPropagation();
      penGuardRef.current = Date.now();
      fn();
    };
  }
  function onTap(fn: () => void) {
    return () => { if (Date.now() - penGuardRef.current < 600) return; fn(); };
  }

  function selectTool(id: DrawTool) {
    onToolChange(id);
    // Re-selecting an already-active palette tool: re-open and reset timer
    if ((id === "pen" || id === "highlight" ||
         (id === "eraser" && eraserHasPopover)) && id === activeTool) {
      openAndSchedule();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      className="canvas-tool-rail"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onMouseEnter={onRailEnter}
      onMouseLeave={onRailLeave}
    >

      {/* ── Tool buttons ── */}
      {RAIL_TOOLS.map(({ id, Icon, title }) => (
        <button
          key={id}
          className="ctr-btn"
          data-active={activeTool === id ? "true" : "false"}
          title={title}
          onClick={onTap(() => selectTool(id))}
          onPointerUp={penTap(() => selectTool(id))}
        >
          <Icon />
          {id === "pen" && (
            <span className="ctr-color-dot" style={{ background: penColor }} />
          )}
          {id === "highlight" && (
            <span className="ctr-color-dot" style={{ background: highlightColor }} />
          )}
        </button>
      ))}

      <div className="ctr-sep" />

      {/* ── Undo / redo ── */}
      <button
        className="ctr-btn"
        title="Undo  ⌘Z"
        onClick={onTap(onUndo)}
        onPointerUp={penTap(onUndo)}
        disabled={!canUndo}
      >
        <UndoIcon />
      </button>
      <button
        className="ctr-btn"
        title="Redo  ⌘⇧Z"
        onClick={onTap(onRedo)}
        onPointerUp={penTap(onRedo)}
        disabled={!canRedo}
      >
        <RedoIcon />
      </button>

      {/* ── Clear all (optional) ── */}
      {onClear && (
        <>
          <div className="ctr-sep" />
          <button
            className="ctr-btn ctr-btn--danger"
            title="Clear all strokes"
            onClick={onTap(onClear)}
            onPointerUp={penTap(onClear)}
          >
            <ClearIcon />
          </button>
        </>
      )}

      {/* ── Colour + size popover ─────────────────────────────────────────
          Always in the DOM so the CSS exit transition plays correctly.
          pointer-events:none when closed keeps it fully inert.
          Content is keyed to `popoverTool` (the last palette tool used)
          so the fade-out shows the right palette even after switching away. */}
      <div
        className="ctr-popover"
        data-open={popoverOpen ? "true" : "false"}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
      >
        {isEraser ? (
          <>
            {/* ── Eraser: size presets + live preview (matches the on-canvas
                   ring, which is the true 1:1 preview while hovering) ── */}
            <p className="ctr-popover-label">Eraser size <span className="ctr-size-value">{eraserSize}px</span></p>
            <div className="ctr-widths ctr-widths--eraser">
              {ERASER_WIDTHS.map((w) => (
                <button
                  key={w.value}
                  className="ctr-width-btn"
                  title={`${w.label} — ${w.value}px`}
                  data-active={eraserSize === w.value ? "true" : "false"}
                  onClick={onTap(() => handleEraserSize(w.value))}
                  onPointerUp={penTap(() => handleEraserSize(w.value))}
                >
                  {/* preset circles at 40% scale so XL fits the popover */}
                  <span
                    className="ctr-eraser-dot"
                    style={{ width: w.value * 0.8, height: w.value * 0.8 }}
                  />
                </button>
              ))}
            </div>
            <div className="ctr-eraser-preview" aria-hidden>
              <span
                className="ctr-eraser-preview-ring"
                style={{ width: (eraserSize ?? 0) * 2, height: (eraserSize ?? 0) * 2 }}
              />
            </div>
            <input
              type="range"
              className="ctr-size-slider"
              min={ERASER_RANGE.min}
              max={ERASER_RANGE.max}
              step={ERASER_RANGE.step}
              value={eraserSize}
              aria-label="Eraser size"
              onChange={(e) => handleEraserSize(Number(e.target.value))}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </>
        ) : (
          <>
            <p className="ctr-popover-label">Colour</p>
            <div className="ctr-swatches">
              {colors.map((c) => (
                <button
                  key={c.hex}
                  className="ctr-swatch"
                  title={c.label}
                  data-active={activeColor === c.hex ? "true" : "false"}
                  style={{ background: c.hex }}
                  onClick={onTap(() => handleColor(c.hex))}
                  onPointerUp={penTap(() => handleColor(c.hex))}
                />
              ))}
            </div>

            <p className="ctr-popover-label">Size <span className="ctr-size-value">{strokeSize}px</span></p>
            <div className="ctr-widths">
              {widths.map((w) => (
                <button
                  key={w.value}
                  className="ctr-width-btn"
                  title={`${w.label} — ${w.value}px`}
                  data-active={strokeSize === w.value ? "true" : "false"}
                  style={{ color: isHighlight ? "#ca8a04" : "#374151" }}
                  onClick={onTap(() => handleWidth(w.value))}
                  onPointerUp={penTap(() => handleWidth(w.value))}
                >
                  <WidthBar value={w.value} isHighlight={isHighlight} />
                </button>
              ))}
            </div>
            {/* Fine adjust — any thickness in the tool's range */}
            <input
              type="range"
              className="ctr-size-slider"
              min={isHighlight ? HIGHLIGHT_RANGE.min : PEN_RANGE.min}
              max={isHighlight ? HIGHLIGHT_RANGE.max : PEN_RANGE.max}
              step={isHighlight ? HIGHLIGHT_RANGE.step : PEN_RANGE.step}
              value={strokeSize}
              aria-label="Stroke thickness"
              onChange={(e) => handleWidth(Number(e.target.value))}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </>
        )}
      </div>
    </div>
  );
}
