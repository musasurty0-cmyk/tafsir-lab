"use client";

/**
 * editorShared — icons, constants, and primitive components
 * shared between EditorToolbar (top ribbon) and SelectionToolbar (bubble).
 */

import { useRef, useEffect } from "react";
import type { Editor } from "@tiptap/core";

// ── Icons ────────────────────────────────────────────────────────────────────

export const BoldIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
  </svg>
);
export const ItalicIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>
  </svg>
);
export const UnderlineIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/>
  </svg>
);
export const StrikeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/>
  </svg>
);
export const BulletIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
    <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/>
  </svg>
);
export const NumberedIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
    <path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
  </svg>
);
export const QuoteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
  </svg>
);
export const DividerIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="12" x2="21" y2="12"/>
  </svg>
);
export const HighlightIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
  </svg>
);
export const FontIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h4"/><path d="M14 20h6"/><path d="m6.5 20 4.5-14 4.5 14"/><path d="M8.2 15h6.6"/>
  </svg>
);
export const ColorIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>
);

// ── Presets ──────────────────────────────────────────────────────────────────

export const HIGHLIGHTS = [
  { label: "Yellow",  color: "#fef08a" },
  { label: "Green",   color: "#bbf7d0" },
  { label: "Pink",    color: "#fecdd3" },
  { label: "Blue",    color: "#bae6fd" },
  { label: "Orange",  color: "#fed7aa" },
  { label: "Clear",   color: "" },
];

/* Font families offered per selection. `css` is written verbatim into the
   textStyle mark's fontFamily attribute, so each entry carries its own
   fallback chain — the stored value has to stand on its own if it is ever
   rendered outside the app (export, print, a stale cache).
   An empty `css` clears the mark and returns to the document face. */
export const FONT_FAMILIES = [
  { label: "Default",     css: "" },
  { label: "Serif",       css: "var(--font-serif), Georgia, serif" },
  { label: "Mono",        css: "var(--font-mono), ui-monospace, monospace" },
  { label: "Handwriting", css: "var(--font-hand), 'Segoe Script', cursive" },
  { label: "Neat hand",   css: "var(--font-hand-print), 'Comic Sans MS', cursive" },
];

export const TEXT_COLORS = [
  { label: "Default", color: "" },
  { label: "Red",     color: "oklch(0.52 0.18 25)" },
  { label: "Orange",  color: "oklch(0.58 0.14 55)" },
  { label: "Green",   color: "oklch(0.48 0.13 155)" },
  { label: "Blue",    color: "oklch(0.52 0.15 240)" },
  { label: "Purple",  color: "oklch(0.52 0.14 290)" },
];

// ── Toolbar button ────────────────────────────────────────────────────────────

export function Btn({
  active = false, disabled = false, title, onClick, children, className = "",
}: {
  active?: boolean; disabled?: boolean; title: string;
  onClick: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <button
      type="button"
      className={`et-btn${active ? " et-btn--active" : ""}${className ? " " + className : ""}`}
      disabled={disabled}
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    >
      {children}
    </button>
  );
}

export const Sep = () => <div className="et-sep" aria-hidden />;

// ── Popover ───────────────────────────────────────────────────────────────────

export function Popover({
  open, onClose, trigger, children,
}: {
  open: boolean; onClose: () => void;
  trigger: React.ReactNode; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  return (
    <div className="et-popover-wrap" ref={ref}>
      {trigger}
      {open && <div className="et-popover">{children}</div>}
    </div>
  );
}

// ── Highlight swatch grid ─────────────────────────────────────────────────────

export function HighlightSwatches({
  editor, onClose,
}: { editor: Editor; onClose: () => void }) {
  return (
    <div className="et-swatch-grid">
      {HIGHLIGHTS.map((h) => (
        <button
          key={h.label}
          type="button"
          className="et-swatch"
          title={h.label}
          style={{ background: h.color || "var(--bg-elev)" }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!h.color) editor.chain().focus().unsetHighlight().run();
            else editor.chain().focus().toggleHighlight({ color: h.color }).run();
            onClose();
          }}
        >
          {!h.color && <span className="et-swatch-x">×</span>}
        </button>
      ))}
    </div>
  );
}

// ── Font family list ──────────────────────────────────────────────────────────
// Each row previews itself in its own face, so the choice is made by looking
// rather than by reading a name.

export function FontList({
  editor, onClose,
}: { editor: Editor; onClose: () => void }) {
  const current = (editor.getAttributes("textStyle").fontFamily as string) || "";
  return (
    <div className="et-font-list">
      {FONT_FAMILIES.map((f) => (
        <button
          key={f.label}
          type="button"
          className={`et-font-item${current === f.css ? " et-font-item--active" : ""}`}
          style={{ fontFamily: f.css || "var(--font-sans), system-ui, sans-serif" }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!f.css) editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(f.css).run();
            onClose();
          }}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ── Color swatch grid ─────────────────────────────────────────────────────────

export function ColorSwatches({
  editor, onClose,
}: { editor: Editor; onClose: () => void }) {
  return (
    <div className="et-swatch-grid">
      {TEXT_COLORS.map((c) => (
        <button
          key={c.label}
          type="button"
          className="et-swatch"
          title={c.label}
          style={{
            background: c.color || "var(--ink)",
            outline: !c.color ? "2px solid var(--line-strong)" : "none",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!c.color) editor.chain().focus().unsetColor().run();
            else editor.chain().focus().setColor(c.color).run();
            onClose();
          }}
        />
      ))}
    </div>
  );
}
