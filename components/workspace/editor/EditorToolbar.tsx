"use client";

/**
 * EditorToolbar — formatting ribbon strip (controlled).
 *
 * Open/closed state is managed externally (TopBar toggle button).
 * When open, renders the formatting strip; when closed, renders nothing.
 */

import { useState } from "react";
import type { Editor } from "@tiptap/core";
import {
  BoldIcon, ItalicIcon, UnderlineIcon, StrikeIcon,
  BulletIcon, NumberedIcon, QuoteIcon, DividerIcon,
  HighlightIcon, ColorIcon,
  Btn, Sep, Popover,
  HighlightSwatches, ColorSwatches,
} from "./editorShared";

interface Props {
  editor: Editor | null;
  open:   boolean;
  onCollapse?: () => void;
}

export default function EditorToolbar({ editor, open, onCollapse }: Props) {
  const [hlOpen, setHlOpen] = useState(false);
  const [clOpen, setClOpen] = useState(false);

  if (!open || !editor) return null;

  return (
    <div className="et-ribbon" data-open="true">
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

        {onCollapse && (
          <>
            <Sep />
            {/* Sits at the end of the strip it controls, so formatting has one
                home rather than a header button pointing at a toolbar. */}
            <Btn title="Hide formatting" onClick={onCollapse}>
              <span className="et-collapse-glyph" aria-hidden>▴</span>
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}
