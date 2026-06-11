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
  const [editing, setEditing] = useState(startEditing);
  const [text, setText]       = useState(() => extractText(note.content));
  const [pos, setPos]         = useState({ x: note.offsetX, y: note.offsetY });
  const [hovered, setHovered] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef     = useRef<{ startMx: number; startMy: number; startX: number; startY: number; zoom: number } | null>(null);

  // Sync position if the note moves remotely
  useEffect(() => { setPos({ x: note.offsetX, y: note.offsetY }); }, [note.offsetX, note.offsetY]);

  // Autofocus + autosize when editing starts
  useEffect(() => {
    if (!editing) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    autosize(ta);
  }, [editing]);

  function autosize(ta: HTMLTextAreaElement) {
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

  // ── Save / delete ───────────────────────────────────────────────────────

  function commitText() {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed === extractText(note.content).trim()) return;

    // Empty box on commit → delete it entirely
    if (!trimmed) { handleDelete(); return; }

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
    fetch(`/api/notes/${note.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ offsetX: pos.x, offsetY: pos.y }),
    }).catch(() => {});
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className="free-textbox"
      style={{ left: pos.x, top: pos.y, width: note.width || 220 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Hover chrome: drag grip + delete */}
      <div className="free-textbox-chrome" data-visible={hovered || editing ? "true" : "false"}>
        <span
          className="free-textbox-grip"
          title="Drag to move"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
        >
          ⠿
        </span>
        <button className="free-textbox-delete" title="Delete" onClick={handleDelete}>✕</button>
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          className="free-textbox-input"
          value={text}
          placeholder="Type something…"
          onChange={(e) => { setText(e.target.value); autosize(e.target); }}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); commitText(); }
          }}
        />
      ) : (
        <div className="free-textbox-text" onClick={() => setEditing(true)}>
          {text || <span className="free-textbox-placeholder">Empty text box</span>}
        </div>
      )}

      <span className="free-textbox-author">{note.author.name.split(" ")[0]}</span>
    </div>
  );
}
