"use client";

/**
 * Toolbar controls added to the existing formatting strip.
 *
 * These live in their own file only to keep EditorToolbar readable — they are
 * part of the SAME ribbon, not a second bar.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { Btn, Popover, TEXT_COLORS } from "./editorShared";

/* ── Font size ─────────────────────────────────────────────────────────────
   A practical note-taking range. Arabic is commonly wanted larger than the
   Latin beside it, so the scale runs well past body size. */
export const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48];
const DEFAULT_SIZE = 16;

/** The size of the current selection, or the size typing would produce. */
export function currentFontSize(editor: Editor): number {
  const raw = editor.getAttributes("textStyle").fontSize as string | undefined;
  if (!raw) return DEFAULT_SIZE;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? Math.round(n) : DEFAULT_SIZE;
}

export function FontSizeControl({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const size = currentFontSize(editor);

  /* setFontSize applies to the selection, or to the stored marks when the
     selection is empty — which is what makes "set a size, then type" work. */
  const apply = useCallback((px: number) => {
    editor.chain().focus().setFontSize(`${px}px`).run();
    setOpen(false);
  }, [editor]);

  const bump = useCallback((dir: 1 | -1) => {
    const i = FONT_SIZES.indexOf(size);
    const next = i === -1
      ? (dir === 1 ? FONT_SIZES.find((s) => s > size) ?? FONT_SIZES.at(-1)!
                   : [...FONT_SIZES].reverse().find((s) => s < size) ?? FONT_SIZES[0])
      : FONT_SIZES[Math.max(0, Math.min(FONT_SIZES.length - 1, i + dir))];
    editor.chain().focus().setFontSize(`${next}px`).run();
  }, [editor, size]);

  return (
    <div className="et-size">
      <Btn title="Smaller text" onClick={() => bump(-1)}>
        <span className="et-size-step" aria-hidden>−</span>
      </Btn>
      <Popover open={open} onClose={() => setOpen(false)} trigger={
        <button
          type="button"
          className="et-size-value"
          title="Font size"
          aria-label={`Font size ${size}`}
          onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        >
          {size}
        </button>
      }>
        <div className="et-size-list">
          {FONT_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className="et-size-item"
              data-active={s === size ? "true" : "false"}
              onMouseDown={(e) => { e.preventDefault(); apply(s); }}
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            className="et-size-item et-size-item--reset"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().unsetFontSize().run();
              setOpen(false);
            }}
          >
            Default
          </button>
        </div>
      </Popover>
      <Btn title="Larger text" onClick={() => bump(1)}>
        <span className="et-size-step" aria-hidden>+</span>
      </Btn>
    </div>
  );
}

/* ── Text colour ───────────────────────────────────────────────────────────
   The preset row plus a real picker, so a colour outside the palette is
   reachable, and an explicit reset back to the document ink. */
export function ColorControl({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const active = editor.getAttributes("textStyle").color as string | undefined;
  /* <input type="color"> only speaks hex, so the swatch it opens on has to be
     a hex value; the presets are oklch and cannot seed it. */
  const [custom, setCustom] = useState("#3b82f6");

  return (
    <Popover open={open} onClose={() => setOpen(false)} trigger={
      <Btn
        active={!!active}
        title="Text colour"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="et-color-glyph" aria-hidden>A</span>
        <span className="et-btn-indicator" style={{ background: active || "var(--ink)" }} />
      </Btn>
    }>
      <div className="et-color-panel">
        <div className="et-swatch-grid">
          {TEXT_COLORS.filter((c) => c.color).map((c) => (
            <button
              key={c.label}
              type="button"
              className="et-swatch"
              title={c.label}
              style={{ background: c.color }}
              onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().setColor(c.color).run();
                setOpen(false);
              }}
            />
          ))}
        </div>
        <label className="et-color-custom">
          <input
            type="color"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              editor.chain().focus().setColor(e.target.value).run();
            }}
            aria-label="Custom text colour"
          />
          <span>Custom</span>
        </label>
        <button
          type="button"
          className="et-color-reset"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().unsetColor().run();
            setOpen(false);
          }}
        >
          Reset to default
        </button>
      </div>
    </Popover>
  );
}

/* ── Format painter ────────────────────────────────────────────────────────
   Copies FORMATTING, never text. The marks are read from the cursor position
   at pick-up time and replayed onto the next selection. */

/** Marks that describe appearance; anything else is content or structure. */
const PAINTABLE_MARKS = ["bold", "italic", "underline", "strike", "highlight"] as const;

export interface PaintedFormat {
  marks: string[];
  textStyle: Record<string, unknown>;
  heading: number | null;
  list: "bulletList" | "orderedList" | null;
  blockquote: boolean;
}

export function readFormat(editor: Editor): PaintedFormat {
  return {
    marks: PAINTABLE_MARKS.filter((m) => editor.isActive(m)),
    // font size, colour and family all ride textStyle
    textStyle: { ...editor.getAttributes("textStyle") },
    heading: [1, 2, 3, 4].find((l) => editor.isActive("heading", { level: l })) ?? null,
    list: editor.isActive("bulletList") ? "bulletList"
        : editor.isActive("orderedList") ? "orderedList" : null,
    blockquote: editor.isActive("blockquote"),
  };
}

export function applyFormat(editor: Editor, f: PaintedFormat) {
  const c = editor.chain().focus();

  /* Clear first, or painting a plain run onto a bold one leaves it bold —
     a painter that only ever ADDS formatting is not a painter. */
  for (const m of PAINTABLE_MARKS) if (editor.isActive(m)) c.toggleMark(m);
  c.unsetColor().unsetFontSize();

  for (const m of f.marks) c.toggleMark(m);
  if (f.textStyle.color)      c.setColor(String(f.textStyle.color));
  if (f.textStyle.fontSize)   c.setFontSize(String(f.textStyle.fontSize));
  if (f.textStyle.fontFamily) c.setFontFamily(String(f.textStyle.fontFamily));

  /* Block-level shape only applies where it makes sense — inside a table cell
     or a list item, forcing a heading would restructure the document. */
  if (f.heading) c.setHeading({ level: f.heading as 1 | 2 | 3 | 4 });
  else if (editor.isActive("heading")) c.setParagraph();

  if (f.list === "bulletList"  && !editor.isActive("bulletList"))  c.toggleBulletList();
  if (f.list === "orderedList" && !editor.isActive("orderedList")) c.toggleOrderedList();
  if (f.blockquote !== editor.isActive("blockquote")) c.toggleBlockquote();

  c.run();
}

export function FormatPainter({ editor }: { editor: Editor }) {
  const [picked, setPicked] = useState<PaintedFormat | null>(null);
  const pickedRef = useRef<PaintedFormat | null>(null);
  pickedRef.current = picked;

  /* Armed until the next selection lands. Listening on the editor rather than
     the document means a click in the sidebar does not consume the pick-up. */
  useEffect(() => {
    if (!picked) return;
    const onUp = () => {
      const f = pickedRef.current;
      if (!f) return;
      if (editor.state.selection.empty) return;   // wait for a real selection
      applyFormat(editor, f);
      setPicked(null);
    };
    const dom = editor.view.dom;
    dom.addEventListener("mouseup", onUp);
    return () => dom.removeEventListener("mouseup", onUp);
  }, [picked, editor]);

  // Escape disarms, so an accidental pick-up is not sticky.
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPicked(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [picked]);

  return (
    <Btn
      active={!!picked}
      title={picked
        ? "Select text to apply the copied formatting (Esc to cancel)"
        : "Format painter — copy formatting from the cursor"}
      onClick={() => setPicked(picked ? null : readFormat(editor))}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 3h14v6H3z" />
        <path d="M10 9v3a2 2 0 0 0 2 2h2" />
        <rect x="12" y="13" width="5" height="8" rx="1" />
      </svg>
    </Btn>
  );
}

/* ── Tables ────────────────────────────────────────────────────────────── */

export function TableControl({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const inTable = editor.isActive("table");

  const insert = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setOpen(false);
  };

  return (
    <Popover open={open} onClose={() => setOpen(false)} trigger={
      <Btn active={inTable} title="Table" onClick={() => setOpen((o) => !o)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
        </svg>
      </Btn>
    }>
      <div className="et-table-panel">
        {!inTable && (
          <>
            {/* Drag-free size picker: hover to choose, click to insert. */}
            <div className="et-table-grid" onMouseLeave={() => setHover({ r: 0, c: 0 })}>
              {Array.from({ length: 6 }, (_, r) => (
                <div className="et-table-grid-row" key={r}>
                  {Array.from({ length: 7 }, (_, c) => (
                    <button
                      key={c}
                      type="button"
                      className="et-table-cellpick"
                      data-on={r < hover.r && c < hover.c ? "true" : "false"}
                      onMouseEnter={() => setHover({ r: r + 1, c: c + 1 })}
                      onMouseDown={(e) => { e.preventDefault(); insert(r + 1, c + 1); }}
                      aria-label={`Insert ${r + 1} by ${c + 1} table`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="et-table-hint">
              {hover.r ? `${hover.r} × ${hover.c}` : "Insert table"}
            </div>
          </>
        )}

        {inTable && (
          <div className="et-table-actions">
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addRowBefore().run(); }}>Row above</button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addRowAfter().run(); }}>Row below</button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addColumnBefore().run(); }}>Column left</button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addColumnAfter().run(); }}>Column right</button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeaderRow().run(); }}>Toggle header row</button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().mergeOrSplit().run(); }}>Merge / split</button>
            <button type="button" className="et-table-danger" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteRow().run(); }}>Delete row</button>
            <button type="button" className="et-table-danger" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteColumn().run(); }}>Delete column</button>
            <button type="button" className="et-table-danger" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteTable().run(); setOpen(false); }}>Delete table</button>
          </div>
        )}
      </div>
    </Popover>
  );
}

/* ── History ──────────────────────────────────────────────────────────────
   Uses the editor's own history (Yjs UndoManager under collaboration), so it
   stays consistent with Ctrl+Z rather than keeping a parallel stack. */

export function UndoRedo({ editor }: { editor: Editor }) {
  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();
  return (
    <>
      <Btn disabled={!canUndo} title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h10a6 6 0 0 1 0 12H11" />
        </svg>
      </Btn>
      <Btn disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" onClick={() => editor.chain().focus().redo().run()}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 14l5-5-5-5" />
          <path d="M20 9H10a6 6 0 0 0 0 12h3" />
        </svg>
      </Btn>
    </>
  );
}
