"use client";

/**
 * AnchoredNoteCard — absolutely positioned note card for Mode B canvas.
 *
 * Positioned in canvas-space (before the CSS zoom transform applied by mode-b-inner).
 * The parent (ModeBPage) resolves the (x, y) coordinates from the note's
 * anchor identity + stored offsetX/offsetY.
 *
 * Interactions:
 *   Minimize/Expand — header chevron button (persists via PATCH isMinimized)
 *   Edit            — pencil button → inline textarea form
 *                     PATCH /api/notes/[noteId]  { content }
 *   Delete          — trash button → DELETE /api/notes/[noteId]
 */

import { useRef, useState } from "react";
import type { NoteData } from "./NoteCard";

// ── Constants ──────────────────────────────────────────────────────────────

const NOTE_TYPE_META: Record<string, { label: string; color: string }> = {
  text:       { label: "Note",       color: "var(--ink-3)" },
  callout:    { label: "Callout",    color: "oklch(0.52 0.12 275)" },
  linguistic: { label: "Linguistic", color: "var(--accent-ink)" },
  thematic:   { label: "Thematic",   color: "oklch(0.55 0.12 155)" },
  ruling:     { label: "Ruling",     color: "oklch(0.62 0.09 28)" },
  question:   { label: "Question",   color: "oklch(0.62 0.11 70)" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Extract plain text from TipTap JSON, preserving paragraph breaks as \n. */
function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (!n.content) return "";
  const parts = n.content.map(extractText);
  // Block-level children join with newlines so multi-paragraph notes
  // don't collapse into one run-on line when edited here.
  if (n.type === "doc") return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return parts.join("");
}

function toDoc(text: string): object {
  const paragraphs = text.split("\n").map((line) => ({
    type:    "paragraph",
    content: line ? [{ type: "text", text: line }] : [],
  }));
  return { type: "doc", content: paragraphs.length ? paragraphs : [{ type: "paragraph" }] };
}

// ── Icons ──────────────────────────────────────────────────────────────────

const LockIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const PencilIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const ChevronDownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const ChevronRightIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  note:       NoteData;
  x:          number;
  y:          number;
  onUpdated?: (note: NoteData) => void;
  onDeleted?: (noteId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function AnchoredNoteCard({ note, x, y, onUpdated, onDeleted }: Props) {
  const meta        = NOTE_TYPE_META[note.noteType] ?? NOTE_TYPE_META.text;
  const borderColor = note.color ?? meta.color;
  const cardWidth   = note.width ?? 280;

  // Local state — minimized starts from DB value but is owned client-side.
  const [minimized, setMinimized] = useState(note.isMinimized);
  const [editing,   setEditing]   = useState(false);
  const [editText,  setEditText]  = useState(() => extractText(note.content));
  const [editType,  setEditType]  = useState(note.noteType);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);

  const canEdit = !note.isAdmin;

  // ── Minimize toggle ────────────────────────────────────────────────────

  async function toggleMinimize() {
    const next = !minimized;
    setMinimized(next);
    // Persist in background; silently ignore errors (optimistic).
    fetch(`/api/notes/${note.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isMinimized: next }),
    }).catch(() => {});
  }

  // ── Edit ───────────────────────────────────────────────────────────────

  function startEdit() {
    setEditText(extractText(note.content));
    setEditType(note.noteType);
    setError(null);
    setEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
      const ta = textareaRef.current;
      if (ta) { ta.style.height = "auto"; ta.style.height = `${ta.scrollHeight}px`; }
    }, 0);
  }

  async function saveEdit() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          content: toDoc(editText.trim()),
          ...(editType !== note.noteType ? { noteType: editType } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        setError(d.error ?? "Save failed"); return;
      }
      const { note: updated } = await res.json() as { note: NoteData };
      onUpdated?.(updated);
      setEditing(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        setError(d.error ?? "Delete failed");
        setDeleting(false); return;
      }
      onDeleted?.(note.id);
    } catch (e) {
      setError(String(e));
      setDeleting(false);
    }
  }

  // ── Minimized pill ─────────────────────────────────────────────────────

  if (minimized) {
    return (
      <div
        className="anc-note anc-note--minimized"
        style={{ position: "absolute", left: x, top: y, borderLeftColor: borderColor, zIndex: note.zIndex ?? 1 }}
        title={extractText(note.content).slice(0, 120)}
      >
        <button className="anc-note-toggle" onClick={toggleMinimize} title="Expand">
          <ChevronRightIcon />
        </button>
        <span className="anc-note-type-pill" style={{ color: meta.color }}>{meta.label}</span>
        <span className="anc-note-author-pill">{note.author.name}</span>
      </div>
    );
  }

  // ── Edit form ──────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div
        className="anc-note anc-note--editing"
        style={{ position: "absolute", left: x, top: y, width: cardWidth, borderLeftColor: borderColor, zIndex: (note.zIndex ?? 1) + 10 }}
      >
        <div className="anc-note-head">
          <span className="anc-note-type" style={{ color: (NOTE_TYPE_META[editType] ?? meta).color }}>
            {(NOTE_TYPE_META[editType] ?? meta).label}
          </span>
          <span className="anc-note-author">{note.author.name}</span>
        </div>
        {/* Type reclassification pills — "type first, categorize later" */}
        <div className="anc-note-type-picker">
          {Object.entries(NOTE_TYPE_META).map(([id, m]) => (
            <button
              key={id}
              type="button"
              className="anc-note-type-option"
              data-active={editType === id ? "true" : "false"}
              style={{ "--type-color": m.color } as React.CSSProperties}
              onClick={() => setEditType(id)}
              disabled={saving}
            >
              {m.label}
            </button>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="anc-note-edit-textarea"
          value={editText}
          rows={3}
          disabled={saving}
          onChange={(e) => {
            setEditText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveEdit(); }
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Note content…"
        />
        {error && <div className="anc-note-error">{error}</div>}
        <div className="anc-note-edit-actions">
          <button className="anc-note-edit-cancel" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
          <button className="anc-note-edit-save" onClick={saveEdit} disabled={saving || !editText.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  // ── Normal card ────────────────────────────────────────────────────────

  const text = extractText(note.content);

  return (
    <div
      className="anc-note"
      style={{ position: "absolute", left: x, top: y, width: cardWidth, borderLeftColor: borderColor, zIndex: note.zIndex ?? 1 }}
    >
      <div className="anc-note-head">
        <button className="anc-note-toggle" onClick={toggleMinimize} title="Minimize">
          <ChevronDownIcon />
        </button>
        <span className="anc-note-type" style={{ color: meta.color }}>{meta.label}</span>
        {note.isAdmin && <span className="anc-note-lock" title="Admin note"><LockIcon /></span>}
        <span className="anc-note-author">{note.author.name}</span>

        {/* Action buttons — visible on card hover */}
        {canEdit && (
          <div className="anc-note-actions">
            <button className="anc-note-action-btn" title="Edit" onClick={startEdit}>
              <PencilIcon />
            </button>
            <button
              className="anc-note-action-btn anc-note-action-btn--danger"
              title="Delete"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "…" : <TrashIcon />}
            </button>
          </div>
        )}
      </div>

      {text && <div className="anc-note-body">{text}</div>}
      {error && <div className="anc-note-error">{error}</div>}
    </div>
  );
}
