"use client";

/**
 * EditorToolbar — formatting ribbon strip (controlled).
 *
 * Open/closed state is managed externally (TopBar toggle button).
 * When open, renders the formatting strip; when closed, renders nothing.
 */

import { useEffect, useReducer, useState } from "react";
import type { Editor } from "@tiptap/core";
import {
  BoldIcon, ItalicIcon, UnderlineIcon, StrikeIcon,
  BulletIcon, NumberedIcon, QuoteIcon, DividerIcon,
  HighlightIcon,
  Btn, Sep, Popover,
  HighlightSwatches,
} from "./editorShared";
import {
  FontSizeControl, ColorControl, FormatPainter, TableControl, UndoRedo,
} from "./toolbarControls";

interface Props {
  editor: Editor | null;
  open:   boolean;
}

export default function EditorToolbar({ editor, open }: Props) {
  /* The toolbar is handed the editor as a PROP, so it never re-rendered on a
     transaction: TipTap only re-renders the component that owns useEditor.
     Every isActive() read and the font-size display were therefore frozen at
     first paint — which is why the +/- steppers appeared to do nothing (they
     applied a size, then recomputed the next step from the same stale value).
     Subscribing here re-reads the real state on every change. */
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", bump);
    editor.on("selectionUpdate", bump);
    return () => {
      editor.off("transaction", bump);
      editor.off("selectionUpdate", bump);
    };
  }, [editor]);

  const [hlOpen, setHlOpen] = useState(false);

  if (!open || !editor) return null;

  return (
    <div className="et-ribbon" data-open="true">
      <div className="et-ribbon-strip" onMouseDown={(e) => e.preventDefault()}>
        <UndoRedo editor={editor} />
        <FormatPainter editor={editor} />

        <Sep />

        <FontSizeControl editor={editor} />

        <Sep />

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

        <ColorControl editor={editor} />

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

        <Sep />

        <TableControl editor={editor} />
      </div>
    </div>
  );
}
