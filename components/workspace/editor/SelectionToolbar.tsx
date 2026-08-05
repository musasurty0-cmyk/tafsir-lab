"use client";

/**
 * SelectionToolbar — floating bubble that appears above selected text.
 *
 * Renders in a portal (document.body) so it sits above everything.
 * Appears only when the editor has a non-collapsed selection, and only once
 * the mouse button is UP — while a drag-selection is still growing the bubble
 * stays away, because a toolbar chasing the cursor mid-drag reads as flicker.
 *
 * Position is computed from the native Selection API rect. When there is no
 * room above the selection the bubble flips BELOW it rather than clamping to
 * the viewport edge and sitting on top of the selected words. It follows the
 * selection while the document scrolls, and Escape dismisses it by collapsing
 * the selection to a caret.
 *
 * Ctrl/Cmd+K opens the link popover on the current selection — the Link mark
 * was installed from the start but had no entry point from a selection.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import {
  BoldIcon, ItalicIcon, UnderlineIcon, StrikeIcon,
  BulletIcon, NumberedIcon, QuoteIcon,
  HighlightIcon, ColorIcon, FontIcon, RtlIcon,
  Btn, Sep, Popover,
  HighlightSwatches, ColorSwatches, FontList, DirectionList,
} from "./editorShared";

interface Props { editor: Editor | null }

interface Pos { top: number; left: number; below: boolean }

const TOOLBAR_H = 40; // approx height of the bubble
const GAP       = 8;  // gap between selection edge and bubble
const MARGIN    = 8;  // min distance from viewport edge

function getSelectionRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const rect  = range.getBoundingClientRect();
  if (!rect.width) return null;
  return rect;
}

/** "example.com/x" → "https://example.com/x"; keeps mailto:, #anchors, etc. */
function normalizeHref(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(v)) return v;
  return `https://${v}`;
}

export default function SelectionToolbar({ editor }: Props) {
  const [pos,      setPos]      = useState<Pos | null>(null);
  const [hlOpen,   setHlOpen]   = useState(false);
  const [clOpen,   setClOpen]   = useState(false);
  const [fnOpen,   setFnOpen]   = useState(false);
  const [dirOpen,  setDirOpen]  = useState(false);
  const [lnOpen,   setLnOpen]   = useState(false);
  const [lnValue,  setLnValue]  = useState("");
  const [mounted,  setMounted]  = useState(false);

  const barRef      = useRef<HTMLDivElement>(null);
  const lnInputRef  = useRef<HTMLInputElement>(null);
  /* True from pointerdown inside the editor until pointerup anywhere. While
     it is set the bubble neither appears nor repositions. */
  const draggingRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  const closePopovers = useCallback(() => {
    setHlOpen(false); setClOpen(false); setFnOpen(false); setDirOpen(false); setLnOpen(false);
  }, []);

  const hide = useCallback(() => { setPos(null); closePopovers(); }, [closePopovers]);

  const updatePos = useCallback(() => {
    if (!editor) { hide(); return; }
    const { empty } = editor.state.selection;
    if (empty) { hide(); return; }
    if (draggingRef.current) return;

    // Small RAF to let the DOM selection settle after Tiptap updates
    requestAnimationFrame(() => {
      if (draggingRef.current) return;
      const rect = getSelectionRect();
      if (!rect) { hide(); return; }
      // Selection scrolled out of sight — a bubble floating over unrelated
      // content is worse than no bubble.
      if (rect.bottom < 0 || rect.top > window.innerHeight) { setPos(null); return; }

      /* No room above → flip below the selection instead of clamping to the
         viewport edge and covering the very words being formatted. */
      const below = rect.top - TOOLBAR_H - GAP < MARGIN;
      const top   = below ? rect.bottom + GAP : rect.top - TOOLBAR_H - GAP;

      // Clamp using the bubble's real width once it exists; estimate first.
      let left = rect.left + rect.width / 2;
      const halfW = (barRef.current?.offsetWidth ?? 360) / 2;
      left = Math.max(MARGIN + halfW, Math.min(window.innerWidth - MARGIN - halfW, left));

      setPos({ top, left, below });
    });
  }, [editor, hide]);

  // Wire to editor selection events
  useEffect(() => {
    if (!editor) return;
    editor.on("selectionUpdate", updatePos);
    editor.on("focus",           updatePos);
    /* Hide when focus leaves the editor — unless it moved INTO the bubble
       (the link input takes real focus; the bubble must survive that). */
    const onBlur = ({ event }: { event: FocusEvent }) => {
      const next = event.relatedTarget as Node | null;
      if (next && barRef.current?.contains(next)) return;
      hide();
    };
    editor.on("blur", onBlur);
    return () => {
      editor.off("selectionUpdate", updatePos);
      editor.off("focus",           updatePos);
      editor.off("blur",            onBlur);
    };
  }, [editor, updatePos, hide]);

  // Mouseup gate: no bubble while a drag-selection is still growing.
  useEffect(() => {
    if (!editor) return;
    const down = (e: PointerEvent) => {
      const dom = editor.view.dom;
      if (dom.contains(e.target as Node)) draggingRef.current = true;
    };
    const up = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      updatePos();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup",   up,   true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup",   up,   true);
    };
  }, [editor, updatePos]);

  // Follow the selection while any ancestor scrolls; rAF-throttled.
  useEffect(() => {
    if (!pos) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; updatePos(); });
    };
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pos, updatePos]);

  // Escape: first close any open popover, then collapse selection to a caret.
  useEffect(() => {
    if (!pos || !editor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (hlOpen || clOpen || fnOpen || dirOpen || lnOpen) {
        e.stopPropagation();
        closePopovers();
        editor.commands.focus();
        return;
      }
      e.stopPropagation();
      editor.chain().focus().setTextSelection(editor.state.selection.to).run();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [pos, editor, hlOpen, clOpen, fnOpen, dirOpen, lnOpen, closePopovers]);

  // Ctrl/Cmd+K → link popover for the current selection.
  useEffect(() => {
    if (!editor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (editor.state.selection.empty) return;
      /* DOM containment, NOT editor.isFocused — PM's hasFocus() folds in
         document.hasFocus(), so it reports false in an unfocused window even
         with the caret visibly in the editor, and the shortcut went dead. */
      const active = document.activeElement;
      const inEditor = editor.view.dom.contains(active) ||
        (barRef.current?.contains(active) ?? false);
      if (!inEditor) return;
      e.preventDefault();
      e.stopPropagation();
      setLnValue(editor.getAttributes("link").href ?? "");
      setLnOpen(true);
      updatePos();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [editor, updatePos]);

  // The link input takes focus the moment its popover opens.
  useEffect(() => {
    if (lnOpen) requestAnimationFrame(() => lnInputRef.current?.select());
  }, [lnOpen]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    const href = normalizeHref(lnValue);
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) chain.setLink({ href }).run();
    else      chain.unsetLink().run();
    setLnOpen(false);
  }, [editor, lnValue]);

  if (!mounted || !pos || !editor) return null;

  return createPortal(
    <div
      ref={barRef}
      className="sel-toolbar"
      data-side={pos.below ? "below" : "above"}
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => {
        /* Keep the editor's selection alive when clicking buttons — but the
           link input needs real focus, so clicks inside it pass through. */
        if (!(e.target as HTMLElement).closest(".sel-link-pop")) e.preventDefault();
      }}
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

      <Popover open={lnOpen} onClose={() => setLnOpen(false)} trigger={
        <Btn active={editor.isActive("link")} title="Link (Ctrl+K)" onClick={() => {
          if (lnOpen) { setLnOpen(false); return; }
          setLnValue(editor.getAttributes("link").href ?? "");
          setLnOpen(true);
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
        </Btn>
      }>
        <div className="sel-link-pop">
          <input
            ref={lnInputRef}
            className="sel-link-input"
            type="text"
            placeholder="Paste or type a link…"
            value={lnValue}
            onChange={(e) => setLnValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  { e.preventDefault(); applyLink(); }
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setLnOpen(false); editor.commands.focus(); }
            }}
            spellCheck={false}
          />
          {editor.isActive("link") && (
            <button
              type="button"
              className="sel-link-remove"
              title="Remove link"
              onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setLnOpen(false);
              }}
            >
              ✕
            </button>
          )}
        </div>
      </Popover>

      <Sep />

      <Popover open={dirOpen} onClose={() => setDirOpen(false)} trigger={
        <Btn
          active={!!(editor.getAttributes("paragraph").dir || editor.getAttributes("heading").dir)}
          title="Text direction"
          onClick={() => setDirOpen((o) => !o)}
        >
          <RtlIcon />
        </Btn>
      }>
        <DirectionList editor={editor} onClose={() => setDirOpen(false)} />
      </Popover>

      <Popover open={fnOpen} onClose={() => setFnOpen(false)} trigger={
        <Btn active={!!editor.getAttributes("textStyle").fontFamily} title="Font" onClick={() => setFnOpen((o) => !o)}>
          <FontIcon />
        </Btn>
      }>
        <FontList editor={editor} onClose={() => setFnOpen(false)} />
      </Popover>

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
