"use client";

/**
 * CanvasToolRail — premium vertical left-side tool rail for Mode B canvas.
 *
 * Layout: fixed to the left of .mode-b-canvas, vertically centred.
 * When Pen or Highlighter is active a compact popover slides out to the right
 * showing the colour palette and three stroke-width options.
 *
 * Props are flat — no nested ToolSettings object.  The parent tracks penColor,
 * penSize, highlightColor, highlightSize separately and passes the right
 * strokeSize (and size-change handler) for whichever tool is active.
 *
 * Optional onClear adds a "Clear all" trash button at the bottom of the rail.
 *
 * This component is pure presentation — all state lives in the parent.
 */

import React from "react";
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

// ── Colour + size popover ─────────────────────────────────────────────────

interface PopoverProps {
  colors:        { label: string; hex: string }[];
  widths:        { label: string; value: number }[];
  activeColor:   string;
  activeWidth:   number;
  isHighlight:   boolean;
  onColor:       (c: string) => void;
  onWidth:       (w: number) => void;
}

function ColorPopover({
  colors, widths, activeColor, activeWidth, isHighlight, onColor, onWidth,
}: PopoverProps) {
  return (
    <div
      className="ctr-popover"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
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
            onClick={() => onColor(c.hex)}
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
            data-active={activeWidth === w.value ? "true" : "false"}
            style={{ color: isHighlight ? "#ca8a04" : "#374151" }}
            onClick={() => onWidth(w.value)}
          >
            <WidthBar value={w.value} isHighlight={isHighlight} />
          </button>
        ))}
      </div>
    </div>
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
  /** The size for whichever tool is currently active (pen or highlight). */
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

  const showPopover = activeTool === "pen" || activeTool === "highlight";
  const isHighlight = activeTool === "highlight";
  const colors      = isHighlight ? HIGHLIGHT_COLORS : PEN_COLORS;
  const widths      = isHighlight ? HIGHLIGHT_WIDTHS  : PEN_WIDTHS;
  const activeColor = isHighlight ? highlightColor : penColor;

  function handleColor(c: string) {
    if (isHighlight) onHighlightColorChange(c);
    else             onPenColorChange(c);
  }

  return (
    <div
      className="canvas-tool-rail"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >

      {/* ── Tool buttons ── */}
      {RAIL_TOOLS.map(({ id, Icon, title }) => (
        <button
          key={id}
          className="ctr-btn"
          data-active={activeTool === id ? "true" : "false"}
          title={title}
          onClick={() => onToolChange(id)}
        >
          <Icon />
          {/* Colour dot — shown on the icon when this tool is active */}
          {id === "pen" && (
            <span
              className="ctr-color-dot"
              style={{ background: penColor }}
            />
          )}
          {id === "highlight" && (
            <span
              className="ctr-color-dot"
              style={{ background: highlightColor }}
            />
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

      {/* ── Colour + size popover (pen / highlight only) ── */}
      {showPopover && (
        <ColorPopover
          colors={colors}
          widths={widths}
          activeColor={activeColor}
          activeWidth={strokeSize}
          isHighlight={isHighlight}
          onColor={handleColor}
          onWidth={onStrokeSizeChange}
        />
      )}
    </div>
  );
}
