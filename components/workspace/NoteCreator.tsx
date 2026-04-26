"use client";

/**
 * NoteCreator — inline note creation form for Mode A structured pages.
 *
 * Creates a StructuredNote anchored to a specific ayah.
 * Content is submitted as a minimal TipTap JSON doc wrapping the textarea value.
 * Phase 4 replaces the textarea with a full TipTap editor instance.
 */

import { useState, useRef, useEffect } from "react";
import type { NoteType } from "@/lib/services/notes.service";
import type { NoteData } from "./NoteCard";

const NOTE_TYPES: { id: NoteType; label: string; desc: string }[] = [
  { id: "text",       label: "Text",       desc: "General note" },
  { id: "callout",    label: "Callout",    desc: "Highlighted observation" },
  { id: "linguistic", label: "Linguistic", desc: "Grammar / morphology" },
  { id: "thematic",   label: "Thematic",   desc: "Cross-surah theme" },
  { id: "ruling",     label: "Ruling",     desc: "Fiqh derivation" },
  { id: "question",   label: "Question",   desc: "Open question" },
];

/** Wraps plain text as a minimal TipTap document JSON. */
function toTipTapDoc(text: string): object {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  };
}

interface Props {
  pageId:      string;
  surahNumber: number;
  ayahNumber:  number;
  onCreated:   (note: NoteData) => void;
  onClose:     () => void;
}

export default function NoteCreator({
  pageId,
  surahNumber,
  ayahNumber,
  onCreated,
  onClose,
}: Props) {
  const [noteType, setNoteType] = useState<NoteType>("text");
  const [text, setText]         = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea on open.
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Auto-resize textarea.
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/pages/${pageId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteType,
          anchorType:  "ayah",
          surahNumber,
          ayahNumber,
          content: toTipTapDoc(text.trim()),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        setError(data.error ?? "Failed to save note");
        return;
      }

      const { note } = await res.json() as { note: NoteData };
      onCreated(note);
      setText("");
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl+Enter submits; Escape closes.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSubmit(e as unknown as React.FormEvent);
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <form className="note-creator" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      {/* Note type selector */}
      <div className="note-creator-types">
        {NOTE_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="note-type-btn"
            data-active={noteType === t.id ? "true" : "false"}
            onClick={() => setNoteType(t.id)}
            title={t.desc}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content textarea */}
      <textarea
        ref={textareaRef}
        className="note-creator-textarea"
        placeholder="Write your note… (⌘↩ to save, Esc to close)"
        value={text}
        onChange={handleTextChange}
        rows={3}
        disabled={saving}
      />

      {/* Error */}
      {error && (
        <div className="note-creator-error">{error}</div>
      )}

      {/* Actions */}
      <div className="note-creator-actions">
        <button type="button" className="note-creator-cancel" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          type="submit"
          className="note-creator-submit"
          disabled={saving || !text.trim()}
        >
          {saving ? "Saving…" : "Save note"}
        </button>
      </div>
    </form>
  );
}
