"use client";

/**
 * NoteCard — renders a single StructuredNote in Mode A.
 *
 * Interactions:
 *   Edit   — hover to reveal pencil button → inline textarea replaces body.
 *             PATCH /api/notes/[noteId]  { content }
 *   Delete — hover to reveal trash button → single click, DELETE with loading state.
 *             DELETE /api/notes/[noteId]
 */

import { useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

const NOTE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  text:       { label: "Note",       color: "var(--ink-3)" },
  callout:    { label: "Callout",    color: "oklch(0.52 0.12 275)" },
  linguistic: { label: "Linguistic", color: "var(--accent-ink)" },
  thematic:   { label: "Thematic",   color: "oklch(0.55 0.12 155)" },
  ruling:     { label: "Ruling",     color: "oklch(0.62 0.09 28)" },
  question:   { label: "Question",   color: "oklch(0.62 0.11 70)" },
};

const NOTE_TYPES = Object.entries(NOTE_TYPE_LABELS).map(([id, { label }]) => ({ id, label }));

const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const PencilIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

/** Extract plain text from TipTap JSON or return the value if already a string. */
function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (!n.content) return "";
  return n.content.map(extractText).join("");
}

function toDoc(text: string): object {
  return { type: "doc", content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] };
}

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

// ── Public types ───────────────────────────────────────────────────────────

export interface NoteData {
  id: string;
  noteType: string;
  anchorType: string;
  surahNumber: number | null;
  ayahNumber: number | null;
  wordPosition: number | null;
  content: unknown;
  color: string | null;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number | null;
  isMinimized: boolean;
  zIndex: number;
  isAdmin: boolean;
  createdAt: Date | string;
  author: { id: string; name: string; avatarUrl: string | null };
}

interface Props {
  note:       NoteData;
  onUpdated?: (note: NoteData) => void;
  onDeleted?: (noteId: string) => void;
  onSelect?:  () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function NoteCard({ note, onUpdated, onDeleted, onSelect }: Props) {
  const meta        = NOTE_TYPE_LABELS[note.noteType] ?? NOTE_TYPE_LABELS.text;
  const borderColor = note.color ?? meta.color;
  const originalText = extractText(note.content);

  const [editing,   setEditing]   = useState(false);
  const [editText,  setEditText]  = useState(originalText);
  const [editType,  setEditType]  = useState(note.noteType);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function startEdit() {
    setEditText(extractText(note.content));
    setEditType(note.noteType);
    setError(null);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function saveEdit() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ content: toDoc(editText.trim()), noteType: editType }),
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

  const canEdit = !note.isAdmin;

  if (editing) {
    return (
      <div className="note-card note-card--editing" style={{ borderLeftColor: borderColor }}>
        {/* Type pills */}
        <div className="note-edit-types">
          {NOTE_TYPES.map((t) => (
            <button
              key={t.id}
              className="note-edit-type-btn"
              data-active={editType === t.id ? "true" : "false"}
              onClick={() => setEditType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          className="note-edit-textarea"
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
          placeholder="Note content… (⌘↩ save)"
        />

        {error && <div className="note-edit-error">{error}</div>}

        <div className="note-edit-actions">
          <button className="note-edit-cancel" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
          <button className="note-edit-save" onClick={saveEdit} disabled={saving || !editText.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="note-card"
      data-type={note.noteType}
      onClick={onSelect}
      style={{ borderLeftColor: borderColor, cursor: onSelect ? "pointer" : undefined }}
    >
      <div className="note-card-head">
        <span className="note-type-chip" style={{ color: meta.color }}>{meta.label}</span>
        {note.isAdmin && (
          <span className="note-admin-badge" title="Admin note">
            <LockIcon /> Admin
          </span>
        )}
        <span className="note-card-author">{note.author.name}</span>
        <span className="note-card-ts">{formatDate(note.createdAt)}</span>

        {/* Action buttons — revealed on card hover via CSS */}
        {canEdit && (
          <div className="note-card-actions">
            <button
              className="note-card-action-btn"
              title="Edit note"
              onClick={startEdit}
            >
              <PencilIcon />
            </button>
            <button
              className="note-card-action-btn note-card-action-btn--danger"
              title="Delete note"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "…" : <TrashIcon />}
            </button>
          </div>
        )}
      </div>

      <div className="note-card-body">{extractText(note.content)}</div>
      {error && <div className="note-edit-error">{error}</div>}
    </div>
  );
}
