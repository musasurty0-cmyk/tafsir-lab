"use client";

/**
 * FreeTextBox — free-floating text box on the Mode B canvas.
 *
 * Stored as a StructuredNote with noteType "textbox" + anchorType "page";
 * offsetX/offsetY hold RAW canvas-space coordinates (unlike anchored notes,
 * which are clamped beside the Mushaf card).
 *
 * Lives inside .mode-b-inner, so it pans and zooms with the viewport.
 *
 * Interactions (hand tool active — the drawing overlay passes events through):
 *   click text   → edit in place (autosizing textarea)
 *   drag grip    → move (PATCH offsetX/offsetY on release)
 *   ✕ button     → delete
 */

import { useEffect, useRef, useState } from "react";
import type { NoteData } from "./NoteCard";

// ── Helpers ────────────────────────────────────────────────────────────────

function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (!n.content) return "";
  return n.content.map(extractText).join("\n").replace(/\n+/g, "\n").trim();
}

function toDoc(text: string): object {
  const paragraphs = text.split("\n").map((line) => ({
    type:    "paragraph",
    content: line ? [{ type: "text", text: line }] : [],
  }));
  return { type: "doc", content: paragraphs.length ? paragraphs : [{ type: "paragraph" }] };
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  note:        NoteData;
  /** Autofocus the editor on mount (set for freshly placed boxes) */
  startEditing?: boolean;
  onUpdated?:  (note: NoteData) => void;
  onDeleted?:  (noteId: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function FreeTextBox({ note, startEditing = false, onUpdated, onDeleted }: Props) {
  const [text, setText]       = useState(() => extractText(note.content));
  const [pos, setPos]         = useState({ x: note.offsetX, y: note.offsetY });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const boxRef      = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef     = useRef<{ startMx: number; startMy: number; startX: number; startY: number; zoom: number } | null>(null);

  // Unsaved optimistic containers haven't got a server id yet — no network.
  const isTemp = note.id.startsWith("temp-");

  // Sync position if the note moves remotely
  useEffect(() => { setPos({ x: note.offsetX, y: note.offsetY }); }, [note.offsetX, note.offsetY]);

  // Sync content if the note changes remotely (skip while the user types)
  useEffect(() => {
    if (textareaRef.current === document.activeElement) return;
    setText(extractText(note.content));
    requestAnimationFrame(() => { if (textareaRef.current) autosize(textareaRef.current); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.content]);

  // Body is ALWAYS a live textarea — click places the caret exactly where
  // clicked, double-click selects a word, drag selects — no edit-mode flip.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    autosize(ta);
    if (startEditing) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  // run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist manual width resize (CSS resize handle) — debounced PATCH
  useEffect(() => {
    const el = boxRef.current;
    if (!el || isTemp) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth);
      if (!w || Math.abs(w - (note.width || 220)) < 4) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetch(`/api/notes/${note.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ width: w }),
        }).catch(() => {});
      }, 600);
    });
    ro.observe(el);
    return () => { ro.disconnect(); if (timer) clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  function autosize(ta: HTMLTextAreaElement) {
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

  // ── Slash commands in containers ────────────────────────────────────────
  // Pressing Enter on a line ending "/ayah 2:255" expands it in place to
  // the verse's Arabic + translation (same endpoint the editor embeds use).
  function maybeExpandSlash(e: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
    const ta = e.currentTarget;
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/(^|\n)\/ayah\s+(\d{1,3}:\d{1,3})\s*$/);
    if (!m) return false;
    e.preventDefault();

    const key = m[2];
    const tokenStart = before.length - (m[0].length - m[1].length);
    const after = ta.value.slice(ta.selectionStart);
    const placeholder = `⏳ ${key}…`;
    const next = ta.value.slice(0, tokenStart) + placeholder + after;
    setText(next);
    requestAnimationFrame(() => { if (textareaRef.current) autosize(textareaRef.current); });

    fetch(`/api/ayah/${key.replace(":", "_")}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ verse }: { verse: { text_uthmani?: string; translations?: { text?: string }[] } }) => {
        const ar = verse.text_uthmani ?? "";
        const tr = (verse.translations?.[0]?.text ?? "").replace(/<[^>]+>/g, "");
        const insert = `${ar} ﴿${key}﴾${tr ? `\n${tr}` : ""}\n`;
        setText((prev) => prev.replace(placeholder, insert));
        requestAnimationFrame(() => { if (textareaRef.current) autosize(textareaRef.current); });
      })
      .catch(() => {
        setText((prev) => prev.replace(placeholder, `/ayah ${key}`));
      });
    return true;
  }

  // ── Save / delete ───────────────────────────────────────────────────────

  function commitText() {
    setFocused(false);
    const trimmed = text.trim();
    if (trimmed === extractText(note.content).trim()) return;

    // Empty box on commit → delete it entirely
    if (!trimmed) { handleDelete(); return; }

    if (isTemp) return; // will persist once the server id arrives

    fetch(`/api/notes/${note.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ content: toDoc(trimmed) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { note?: NoteData } | null) => {
        if (d?.note) onUpdated?.(d.note);
      })
      .catch(() => {});
  }

  function handleDelete() {
    if (isTemp) { onDeleted?.(note.id); return; } // local-only removal
    fetch(`/api/notes/${note.id}`, { method: "DELETE" })
      .then((r) => { if (r.ok) onDeleted?.(note.id); })
      .catch(() => {});
  }

  // ── Drag (grip handle) ──────────────────────────────────────────────────

  function onGripDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Derive current zoom from the transformed parent so drag deltas map
    // 1:1 to canvas-space units at any zoom level.
    const inner = (e.currentTarget as HTMLElement).closest(".mode-b-inner") as HTMLElement | null;
    let zoom = 1;
    if (inner) {
      const m = new DOMMatrixReadOnly(getComputedStyle(inner).transform);
      zoom = m.a || 1;
    }
    dragRef.current = { startMx: e.clientX, startMy: e.clientY, startX: pos.x, startY: pos.y, zoom };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onGripMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setPos({
      x: d.startX + (e.clientX - d.startMx) / d.zoom,
      y: d.startY + (e.clientY - d.startMy) / d.zoom,
    });
  }

  function onGripUp() {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (isTemp) return; // geometry persists with the server note
    fetch(`/api/notes/${note.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ offsetX: pos.x, offsetY: pos.y }),
    }).catch(() => {});
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      ref={boxRef}
      className="free-textbox"
      data-focused={focused ? "true" : "false"}
      style={{ left: pos.x, top: pos.y, width: note.width || 220 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Top-edge drag bar (OneNote model): hover the container's top edge
          and drag the whole thing. Delete sits at the bar's right. */}
      <div
        className="free-textbox-chrome"
        data-visible={hovered || focused ? "true" : "false"}
        title="Drag to move"
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
      >
        <span className="free-textbox-gripdots" aria-hidden>⋯⋯</span>
        <button
          className="free-textbox-delete"
          title="Delete"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
        >
          ✕
        </button>
      </div>

      {/* Always-live textarea body — natural caret/selection, blur saves */}
      <textarea
        ref={textareaRef}
        className="free-textbox-input"
        value={text}
        placeholder="Type something…"
        rows={1}
        onFocus={() => setFocused(true)}
        onChange={(e) => { setText(e.target.value); autosize(e.target); }}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Enter" && maybeExpandSlash(e)) return;
          if (e.key === "Escape") { e.preventDefault(); e.currentTarget.blur(); }
        }}
      />

      <span className="free-textbox-author">{note.author.name.split(" ")[0]}</span>
    </div>
  );
}
