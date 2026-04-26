"use client";

/**
 * AyahBlock — one Quranic verse rendered in Mode A structured view.
 *
 * Shows: Arabic text · transliteration · translation · word chips
 *        ProgressControl (personal + group)
 *        Existing notes for this ayah
 *        NoteCreator (inline, toggled by "Add note" button)
 *
 * All progress mutations and note creation are delegated to callbacks
 * so ModeAPage can manage state centrally.
 *
 * Split-view additions:
 *   highlighted  — adds .verse-block[data-highlighted] for flash styling
 *   onNoteSelect — forwarded to each NoteCard so clicks bubble up to
 *                  WorkspacePageView for Mode B scroll sync
 */

import { useState } from "react";
import type { Verse } from "@/lib/types";
import type { ProgressStatus } from "@/lib/services/progress.service";
import type { MemberRole } from "@/lib/services/workspaces.service";
import ProgressControl from "./ProgressControl";
import NoteCard, { type NoteData } from "./NoteCard";
import NoteCreator from "./NoteCreator";

// ── Icons ──────────────────────────────────────────────────────────────────

const BookOpenIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const PlusIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  verse:            Verse;
  surahNumber:      number;
  pageId:           string;
  personalStatus:   ProgressStatus | null;
  groupEntry:       { status: ProgressStatus; lastChangedBy: string } | null;
  role:             MemberRole;
  notes:            NoteData[];
  highlighted?:     boolean;
  tafsirOpen:       boolean;
  onOpenTafsir:     () => void;
  onPersonalChange: (status: ProgressStatus) => void;
  onGroupChange:    (status: ProgressStatus) => void;
  onNoteCreated:    (note: NoteData) => void;
  onNoteUpdated:    (note: NoteData) => void;
  onNoteDeleted:    (noteId: string) => void;
  onNoteSelect?:    (noteId: string) => void;
}

export default function AyahBlock({
  verse,
  surahNumber,
  pageId,
  personalStatus,
  groupEntry,
  role,
  notes,
  highlighted,
  tafsirOpen,
  onOpenTafsir,
  onPersonalChange,
  onGroupChange,
  onNoteCreated,
  onNoteUpdated,
  onNoteDeleted,
  onNoteSelect,
}: Props) {
  const [noteCreatorOpen, setNoteCreatorOpen] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const [surahNum, ayahNum] = verse.verse_key.split(":").map(Number);
  const wordTokens = verse.words.filter((w) => w.char_type_name === "word");
  const translation = verse.translations?.[0]?.text ?? "";
  const translationClean = translation.replace(/<[^>]+>/g, "");

  const groupStatus = groupEntry?.status ?? null;

  return (
    <div
      className="verse-block"
      data-active={tafsirOpen ? "true" : "false"}
      data-group-status={groupStatus ?? "none"}
      data-highlighted={highlighted ? "true" : "false"}
      id={`ayah-${verse.verse_key}`}
    >
      {/* ── Header ── */}
      <div className="verse-header">
        <div className="verse-ref">
          <div className="verse-ref-dot" />
          <span>{verse.verse_key}</span>
        </div>

        <div className="verse-actions">
          <button
            className="verse-action"
            data-active={tafsirOpen ? "true" : "false"}
            onClick={onOpenTafsir}
            title="Open Tafsīr"
          >
            <BookOpenIcon />
          </button>
          <button
            className="verse-action"
            data-active={showProgress ? "true" : "false"}
            onClick={() => setShowProgress((s) => !s)}
            title="Progress"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="9"/>
              {groupStatus === "studied"  && <path d="M8 12l3 3 5-5"/>}
              {groupStatus === "pending"  && <circle cx="12" cy="12" r="3" fill="currentColor"/>}
            </svg>
          </button>
          <button
            className="verse-action"
            onClick={() => setNoteCreatorOpen((o) => !o)}
            title="Add note"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {/* ── Arabic ── */}
      <div className="verse-arabic">{verse.text_uthmani}</div>

      {/* ── Word chips — informational, not interactive ── */}
      {wordTokens.length > 0 && (
        <div className="word-chips">
          {wordTokens.map((w) => (
            // <span> not <button>: these are purely read-only display in Mode A.
            // Hover tooltip shows transliteration + translation.
            <span
              key={`${verse.verse_key}:${w.position}`}
              className="word-chip"
              title={[w.transliteration?.text, w.translation?.text].filter(Boolean).join(" — ")}
            >
              <span className="word-chip-ar">{w.text}</span>
              {w.transliteration?.text && (
                <span className="word-chip-tr">{w.transliteration.text}</span>
              )}
              {w.translation?.text && (
                <span className="word-chip-en">{w.translation.text}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* ── Translation ── */}
      <div className="verse-translation">
        <sup className="tr-num">{verse.verse_number}</sup>
        {translationClean}
      </div>

      {/* ── Progress controls (expandable) ── */}
      {showProgress && (
        <ProgressControl
          surahNumber={surahNum}
          ayahNumber={ayahNum}
          personalStatus={personalStatus}
          groupEntry={groupEntry}
          role={role}
          onPersonalChange={onPersonalChange}
          onGroupChange={onGroupChange}
        />
      )}

      {/* ── Notes ── */}
      {notes.length > 0 && (
        <div className="ayah-notes">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdated={onNoteUpdated}
              onDeleted={onNoteDeleted}
              onSelect={onNoteSelect ? () => onNoteSelect(note.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* ── Note creator ── */}
      {noteCreatorOpen && (
        <NoteCreator
          pageId={pageId}
          surahNumber={surahNum}
          ayahNumber={ayahNum}
          onCreated={(note) => {
            onNoteCreated(note);
            setNoteCreatorOpen(false);
          }}
          onClose={() => setNoteCreatorOpen(false)}
        />
      )}
    </div>
  );
}
