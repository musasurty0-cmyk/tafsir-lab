"use client";

/**
 * EditorToolbar — formatting toolbar for the page editor.
 *
 * Groups:
 *   Text marks  — Bold · Italic · Underline · Strikethrough
 *   Highlight   — yellow / green / pink presets (popover)
 *   Color       — ink / red / orange / blue / purple (popover)
 *   Blocks      — H1 · H2 · H3
 *   Lists       — Bullet · Numbered
 *   Other       — Quote · Divider
 */

import { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/core";

interface Props {
  editor: Editor | null;
}

// ── Small icon components ────────────────────────────────────────────────────

const BoldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
  </svg>
);
const ItalicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>
  </svg>
);
const UnderlineIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/>
  </svg>
);
const StrikeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/>
  </svg>
);
const BulletIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
    <circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>
  </svg>
);
const NumberedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
    <path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
  </svg>
);
const QuoteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
  </svg>
);
const DividerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="8" x2="8" y2="8" strokeWidth="1"/><line x1="16" y1="8" x2="16" y2="8" strokeWidth="1"/>
  </svg>
);
const HighlightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
  </svg>
);
const ColorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>
);

// ── Highlight presets ─────────────────────────────────────────────────────────

const HIGHLIGHTS = [
  { label: "Yellow",  color: "#fef08a" },
  { label: "Green",   color: "#bbf7d0" },
  { label: "Pink",    color: "#fecdd3" },
  { label: "Blue",    color: "#bae6fd" },
  { label: "Orange",  color: "#fed7aa" },
  { label: "None",    color: "transparent" },
];

// ── Text color presets ────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { label: "Default",  color: "" },
  { label: "Red",      color: "oklch(0.52 0.18 25)" },
  { label: "Orange",   color: "oklch(0.62 0.14 55)" },
  { label: "Green",    color: "oklch(0.52 0.13 155)" },
  { label: "Blue",     color: "oklch(0.52 0.15 240)" },
  { label: "Purple",   color: "oklch(0.52 0.14 290)" },
];

// ── Toolbar button ────────────────────────────────────────────────────────────

function Btn({
  active, disabled = false, title, onClick, children,
}: {
  active?: boolean; disabled?: boolean; title: string;
  onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`et-btn${active ? " et-btn--active" : ""}`}
      disabled={disabled}
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    >
      {children}
    </button>
  );
}

// ── Separator ─────────────────────────────────────────────────────────────────

const Sep = () => <div className="et-sep" aria-hidden />;

// ── Popover wrapper ───────────────────────────────────────────────────────────

function Popover({
  open, onClose, children, trigger,
}: {
  open: boolean; onClose: () => void;
  children: React.ReactNode; trigger: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function EditorToolbar({ editor }: Props) {
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [colorOpen,     setColorOpen]     = useState(false);

  if (!editor) return null;

  const can = editor.can().chain().focus();

  return (
    <div className="editor-toolbar" onMouseDown={(e) => e.preventDefault()}>
      {/* ── Text marks ── */}
      <Btn
        active={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!can.toggleBold().run()}
      >
        <BoldIcon />
      </Btn>
      <Btn
        active={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!can.toggleItalic().run()}
      >
        <ItalicIcon />
      </Btn>
      <Btn
        active={editor.isActive("underline")}
        title="Underline (Ctrl+U)"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon />
      </Btn>
      <Btn
        active={editor.isActive("strike")}
        title="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!can.toggleStrike().run()}
      >
        <StrikeIcon />
      </Btn>

      {/* ── Highlight ── */}
      <Popover
        open={highlightOpen}
        onClose={() => setHighlightOpen(false)}
        trigger={
          <Btn
            active={editor.isActive("highlight")}
            title="Highlight"
            onClick={() => setHighlightOpen((o) => !o)}
          >
            <HighlightIcon />
            <span className="et-btn-indicator" style={{
              background: editor.isActive("highlight")
                ? (editor.getAttributes("highlight").color ?? "#fef08a")
                : "transparent",
              border: editor.isActive("highlight") ? "none" : "1.5px solid var(--line-strong)",
            }} />
          </Btn>
        }
      >
        <div className="et-swatch-grid">
          {HIGHLIGHTS.map((h) => (
            <button
              key={h.label}
              type="button"
              className="et-swatch"
              title={h.label}
              style={{ background: h.color === "transparent" ? "var(--bg-elev)" : h.color }}
              onMouseDown={(e) => {
                e.preventDefault();
                if (h.color === "transparent") {
                  editor.chain().focus().unsetHighlight().run();
                } else {
                  editor.chain().focus().toggleHighlight({ color: h.color }).run();
                }
                setHighlightOpen(false);
              }}
            >
              {h.color === "transparent" && <span className="et-swatch-x">×</span>}
            </button>
          ))}
        </div>
      </Popover>

      {/* ── Text color ── */}
      <Popover
        open={colorOpen}
        onClose={() => setColorOpen(false)}
        trigger={
          <Btn
            active={editor.isActive("textStyle") && !!editor.getAttributes("textStyle").color}
            title="Text color"
            onClick={() => setColorOpen((o) => !o)}
          >
            <ColorIcon />
            <span className="et-btn-indicator" style={{
              background: editor.getAttributes("textStyle").color ?? "var(--ink)",
            }} />
          </Btn>
        }
      >
        <div className="et-swatch-grid">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.label}
              type="button"
              className="et-swatch"
              title={c.label}
              style={{ background: c.color || "var(--ink)", outline: c.color === "" ? "2px solid var(--line-strong)" : "none" }}
              onMouseDown={(e) => {
                e.preventDefault();
                if (!c.color) {
                  editor.chain().focus().unsetColor().run();
                } else {
                  editor.chain().focus().setColor(c.color).run();
                }
                setColorOpen(false);
              }}
            />
          ))}
        </div>
      </Popover>

      <Sep />

      {/* ── Headings ── */}
      {([1, 2, 3] as const).map((level) => (
        <Btn
          key={level}
          active={editor.isActive("heading", { level })}
          title={`Heading ${level}`}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
        >
          <span className="et-heading-label">H{level}</span>
        </Btn>
      ))}

      <Sep />

      {/* ── Lists ── */}
      <Btn
        active={editor.isActive("bulletList")}
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <BulletIcon />
      </Btn>
      <Btn
        active={editor.isActive("orderedList")}
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <NumberedIcon />
      </Btn>

      <Sep />

      {/* ── Block ── */}
      <Btn
        active={editor.isActive("blockquote")}
        title="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <QuoteIcon />
      </Btn>
      <Btn
        title="Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <DividerIcon />
      </Btn>
    </div>
  );
}
