"use client";

/**
 * SelectionToolbar — floating bubble that appears above selected text.
 *
 * Renders in a portal (document.body) so it sits above everything.
 * Appears only when the editor has a non-collapsed selection.
 * Position is computed from the native Selection API rect.
 */

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import {
  BoldIcon, ItalicIcon, UnderlineIcon, StrikeIcon,
  BulletIcon, NumberedIcon, QuoteIcon,
  HighlightIcon, ColorIcon,
  Btn, Sep, Popover,
  HighlightSwatches, ColorSwatches,
} from "./editorShared";

interface Props { editor: Editor | null }

interface Pos { top: number; left: number }

const TOOLBAR_H = 40; // approx height of the bubble
const GAP       = 8;  // gap between selection top and bubble bottom
const MARGIN    = 8;  // min distance from viewport edge

function getSelectionRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const rect  = range.getBoundingClientRect();
  if (!rect.width) return null;
  return rect;
}

export default function SelectionToolbar({ editor }: Props) {
  const [pos,      setPos]      = useState<Pos | null>(null);
  const [hlOpen,   setHlOpen]   = useState(false);
  const [clOpen,   setClOpen]   = useState(false);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const updatePos = useCallback(() => {
    if (!editor) { setPos(null); return; }
    const { empty } = editor.state.selection;
    if (empty) { setPos(null); setHlOpen(false); setClOpen(false); return; }

    // Small RAF to let the DOM selection settle after Tiptap updates
    requestAnimationFrame(() => {
      const rect = getSelectionRect();
      if (!rect) { setPos(null); return; }

      // Center horizontally above the selection; clamp to viewport
      let left = rect.left + rect.width / 2;
      const top  = rect.top - TOOLBAR_H - GAP;

      // Clamp left so the toolbar (≈260px wide) doesn't overflow
      const halfW = 130;
      left = Math.max(MARGIN + halfW, Math.min(window.innerWidth - MARGIN - halfW, left));

      setPos({ top: Math.max(MARGIN, top), left });
    });
  }, [editor]);

  // Wire to editor selection events
  useEffect(() => {
    if (!editor) return;
    editor.on("selectionUpdate", updatePos);
    editor.on("focus",           updatePos);
    // Hide when focus leaves the editor entirely
    const hide = () => { setPos(null); setHlOpen(false); setClOpen(false); };
    editor.on("blur", hide);
    return () => {
      editor.off("selectionUpdate", updatePos);
      editor.off("focus",           updatePos);
      editor.off("blur",            hide);
    };
  }, [editor, updatePos]);

  if (!mounted || !pos || !editor) return null;

  return createPortal(
    <div
      className="sel-toolbar"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Btn active={editor.isActive("bold")}      title="Bold (Ctrl+B)"     onClick={() => editor.chain().focus().toggleBold().run()}><BoldIcon /></Btn>
      <Btn active={editor.isActive("italic")}    title="Italic (Ctrl+I)"   onClick={() => editor.chain().focus().toggleItalic().run()}><ItalicIcon /></Btn>
      <Btn active={editor.isActive("underline")} title="Underline (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon /></Btn>
      <Btn active={editor.isActive("strike")}    title="Strikethrough"     onClick={() => editor.chain().focus().toggleStrike().run()}><StrikeIcon /></Btn>

      <Sep />

      {([1, 2, 3] as const).map((level) => (
        <Btn key={level} active={editor.isActive("heading", { level })} title={`H${level}`}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>
          <span className="et-heading-label">H{level}</span>
        </Btn>
      ))}

      <Sep />

      <Btn active={editor.isActive("bulletList")}  title="Bullet"   onClick={() => editor.chain().focus().toggleBulletList().run()}><BulletIcon /></Btn>
      <Btn active={editor.isActive("orderedList")} title="Numbered" onClick={() => editor.chain().focus().toggleOrderedList().run()}><NumberedIcon /></Btn>

      <Sep />

      <Btn active={editor.isActive("blockquote")} title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}><QuoteIcon /></Btn>

      <Sep />

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
    </div>,
    document.body
  );
}
