"use client";

/**
 * EditorToolbar — collapsible top ribbon (OneNote-style).
 *
 * Defaults to collapsed. A small "Formatting ▾" toggle bar
 * expands it. State is persisted in localStorage.
 */

import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/core";
import {
  BoldIcon, ItalicIcon, UnderlineIcon, StrikeIcon,
  BulletIcon, NumberedIcon, QuoteIcon, DividerIcon,
  HighlightIcon, ColorIcon,
  Btn, Sep, Popover,
  HighlightSwatches, ColorSwatches,
} from "./editorShared";

const LS_KEY = "tl-editor-toolbar-open";

interface Props { editor: Editor | null }

export default function EditorToolbar({ editor }: Props) {
  const [open, setOpen] = useState(false);
  const [hlOpen, setHlOpen] = useState(false);
  const [clOpen, setClOpen] = useState(false);

  // Load persisted state once
  useEffect(() => {
    try { setOpen(localStorage.getItem(LS_KEY) === "true"); } catch { /* ignore */ }
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(LS_KEY, String(next)); } catch { /* ignore */ }
  }

  return (
    <div className="et-ribbon" data-open={open ? "true" : "false"}>
      {/* ── Toggle bar ── */}
      <button
        type="button"
        className="et-ribbon-toggle"
        onMouseDown={(e) => { e.preventDefault(); toggle(); }}
        title={open ? "Collapse formatting" : "Expand formatting"}
        aria-expanded={open}
      >
        <span className="et-ribbon-toggle-label">Formatting</span>
        <svg
          className={`et-ribbon-chevron${open ? " et-ribbon-chevron--up" : ""}`}
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* ── Formatting strip ── */}
      {open && editor && (
        <div className="et-ribbon-strip" onMouseDown={(e) => e.preventDefault()}>
          <Btn active={editor.isActive("bold")}      title="Bold (Ctrl+B)"    onClick={() => editor.chain().focus().toggleBold().run()}><BoldIcon /></Btn>
          <Btn active={editor.isActive("italic")}    title="Italic (Ctrl+I)"  onClick={() => editor.chain().focus().toggleItalic().run()}><ItalicIcon /></Btn>
          <Btn active={editor.isActive("underline")} title="Underline (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon /></Btn>
          <Btn active={editor.isActive("strike")}    title="Strikethrough"    onClick={() => editor.chain().focus().toggleStrike().run()}><StrikeIcon /></Btn>

          <Popover open={hlOpen} onClose={() => setHlOpen(false)} trigger={
            <Btn active={editor.isActive("highlight")} title="Highlight" onClick={() => setHlOpen((o) => !o)}>
              <HighlightIcon />
              {editor.isActive("highlight") && (
                <span className="et-btn-indicator" style={{ background: editor.getAttributes("highlight").color ?? "#fef08a" }} />
              )}
            </Btn>
          }>
            <HighlightSwatches editor={editor} onClose={() => setHlOpen(false)} />
          </Popover>

          <Popover open={clOpen} onClose={() => setClOpen(false)} trigger={
            <Btn active={!!(editor.isActive("textStyle") && editor.getAttributes("textStyle").color)} title="Text color" onClick={() => setClOpen((o) => !o)}>
              <ColorIcon />
              {editor.getAttributes("textStyle").color && (
                <span className="et-btn-indicator" style={{ background: editor.getAttributes("textStyle").color }} />
              )}
            </Btn>
          }>
            <ColorSwatches editor={editor} onClose={() => setClOpen(false)} />
          </Popover>

          <Sep />

          {([1, 2, 3] as const).map((level) => (
            <Btn key={level} active={editor.isActive("heading", { level })} title={`Heading ${level}`}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>
              <span className="et-heading-label">H{level}</span>
            </Btn>
          ))}

          <Sep />

          <Btn active={editor.isActive("bulletList")}  title="Bullet list"   onClick={() => editor.chain().focus().toggleBulletList().run()}><BulletIcon /></Btn>
          <Btn active={editor.isActive("orderedList")} title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}><NumberedIcon /></Btn>

          <Sep />

          <Btn active={editor.isActive("blockquote")} title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}><QuoteIcon /></Btn>
          <Btn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><DividerIcon /></Btn>
        </div>
      )}
    </div>
  );
}
