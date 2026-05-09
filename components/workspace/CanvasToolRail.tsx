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
  { label: "S", value: 1.5 },
  { label: "M", value: 2.5 },
  { label: "L", value: 4.5 },
];
export const HIGHLIGHT_WIDTHS = [
  { label: "S", value: 10 },
  { label: "M", value: 16 },
  { label: "L", value: 24 },
];

// ── Exported defaults ─────────────────────────────────────────────────────

export const DEFAULT_PEN_COLOR       = "#18181b";
export const DEFAULT_PEN_SIZE        = 2.5;
export const DEFAULT_HIGHLIGHT_COLOR = "#fbbf24";
export const DEFAULT_HIGHLIGHT_SIZE  = 14;

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
  canUndo, canRedo,
  onUndo, onRedo,
  onClear,
}: Props) {

  // ── Popover open / closed state ─────────────────────────────────────────
  // The popover is always present in the DOM so its CSS exit transition plays.
  // `pointer-events: none` when closed keeps it fully inert.

  const [popoverOpen, setPopoverOpen] = useState(false);

  // Track the last pen/highlight tool so the popover shows correct content
  // while fading out after the user switches to eraser / arrow / hand.
  const lastPaletteToolRef = useRef<"pen" | "highlight">("pen");
  const isCurrentlyPalette = activeTool === "pen" || activeTool === "highlight";
  if (isCurrentlyPalette) lastPaletteToolRef.current = activeTool;

  const popoverTool = lastPaletteToolRef.current;
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
    if (activeTool === "pen" || activeTool === "highlight") {
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
          onClick={() => {
            onToolChange(id);
            // Re-clicking an already-active palette tool: re-open and reset timer
            if ((id === "pen" || id === "highlight") && id === activeTool) {
              openAndSchedule();
            }
          }}
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
        onClick={onUndo}
        disabled={!canUndo}
      >
        <UndoIcon />
      </button>
      <button
        className="ctr-btn"
        title="Redo  ⌘⇧Z"
        onClick={onRedo}
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
            onClick={onClear}
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
        <p className="ctr-popover-label">Colour</p>
        <div className="ctr-swatches">
          {colors.map((c) => (
            <button
              key={c.hex}
              className="ctr-swatch"
              title={c.label}
              data-active={activeColor === c.hex ? "true" : "false"}
              style={{ background: c.hex }}
              onClick={() => handleColor(c.hex)}
            />
          ))}
        </div>

        <p className="ctr-popover-label">Size</p>
        <div className="ctr-widths">
          {widths.map((w) => (
            <button
              key={w.value}
              className="ctr-width-btn"
              title={`${w.label} — ${w.value}px`}
              data-active={strokeSize === w.value ? "true" : "false"}
              style={{ color: isHighlight ? "#ca8a04" : "#374151" }}
              onClick={() => handleWidth(w.value)}
            >
              <WidthBar value={w.value} isHighlight={isHighlight} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
