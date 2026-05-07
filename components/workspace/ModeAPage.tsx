"use client";

/**
 * ModeAPage — free notebook editor for a workspace page.
 *
 * Replaces the previous forced-surah rendering with a TipTap free editor.
 * The user starts with a blank canvas and intentionally pulls in verses
 * with the "/ayah 2:255" slash command.
 *
 * This component:
 *   1. Renders the page cover (title, author, status).
 *   2. Provides EditorContext so TipTap NodeViews (AyahBlockView) can
 *      access notes, progress, verses, and callbacks without prop drilling.
 *   3. Renders <PageEditor> — the TipTap editor shell.
 */

import type { Verse } from "@/lib/types";
import type { ProgressStatus } from "@/lib/services/progress.service";
import type { MemberRole } from "@/lib/services/workspaces.service";
import type { NoteData } from "./NoteCard";
import { EditorContextProvider } from "./editor/EditorContext";
import PageEditor from "./editor/PageEditor";

// ── Types ─────────────────────────────────────────────────────────────────

interface PageData {
  id:              string;
  title:           string;
  status:          string;
  orderIndex:      number;
  isAdminAuthored: boolean;
  tiptapContent:   unknown;           // JSON from DB (null for new pages)
  createdAt:       Date | string;
  publishedAt:     Date | string | null;
  createdBy:       { id: string; name: string; avatarUrl: string | null };
  publishedBy?:    { id: string; name: string; avatarUrl: string | null } | null;
}

interface Props {
  page:              PageData;
  verses:            Verse[];
  surahNumber:       number;
  pageId:            string;
  role:              MemberRole;
  notes:             NoteData[];
  groupProgress:     Record<string, { status: ProgressStatus; lastChangedBy: string }>;
  personalProgress:  Record<string, ProgressStatus>;
  currentUserId:     string;
  // Split-view: highlighted verse key from Mode B (scroll + flash)
  highlightedVerseKey?: string | null;
  // Exposes the TipTap editor instance to the workspace shell
  onEditorReady?: (editor: import("@tiptap/core").Editor | null) => void;
  // Callbacks delegated up to WorkspacePageView
  onOpenTafsir:     (verseKey: string) => void;
  onProgressChange: (scope: "personal" | "group", surahNumber: number, ayahNumber: number, status: ProgressStatus) => Promise<void>;
  onNoteCreated:    (note: NoteData) => void;
  onNoteUpdated:    (note: NoteData) => void;
  onNoteDeleted:    (noteId: string) => void;
  onNoteSelect?:    (noteId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft:     "var(--ink-4)",
  published: "var(--accent-ink)",
  archived:  "oklch(0.62 0.09 28)",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="page-status-badge"
      style={{
        background: `${STATUS_COLORS[status] ?? "var(--ink-4)"}1a`,
        color:       STATUS_COLORS[status] ?? "var(--ink-4)",
      }}
    >
      {status}
    </span>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={name} className="doc-meta-avatar" />;
  }
  return <div className="doc-meta-avatar">{name.slice(0, 2).toUpperCase()}</div>;
}

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(d));
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ModeAPage({
  page,
  verses,
  surahNumber,
  pageId,
  role,
  notes,
  groupProgress,
  personalProgress,
  currentUserId,
  onEditorReady,
  onOpenTafsir,
  onProgressChange,
  onNoteCreated,
  onNoteUpdated,
  onNoteDeleted,
}: Props) {
  return (
    <EditorContextProvider
      value={{
        pageId,
        surahNumber,
        verses,
        notes,
        role,
        personalProgress,
        groupProgress,
        onNoteCreated,
        onNoteUpdated,
        onNoteDeleted,
        onProgressChange,
        onOpenTafsir,
      }}
    >
      <div className="doc-wrap">
        <div className="doc">

          {/* ── Cover ──────────────────────────────────────────────── */}
          <div className="doc-cover">
            <div className="doc-cover-tag">Page {page.orderIndex + 1}</div>
            <h1 className="doc-title">{page.title}</h1>

            <div className="doc-meta">
              <span className="doc-meta-item">
                <Avatar name={page.createdBy.name} avatarUrl={page.createdBy.avatarUrl} />
                {page.createdBy.name}
              </span>
              <span className="doc-meta-sep">·</span>
              <span className="doc-meta-item">{formatDate(page.createdAt)}</span>
              <span className="doc-meta-sep">·</span>
              <StatusBadge status={page.status} />
              {page.isAdminAuthored && (
                <>
                  <span className="doc-meta-sep">·</span>
                  <span className="doc-meta-item" style={{ color: "var(--accent-ink)", fontSize: 12 }}>
                    Admin content
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ── Divider ────────────────────────────────────────────── */}
          <div className="block-divider" style={{ margin: "28px 0 32px" }} />

          {/* ── Free editor ────────────────────────────────────────── */}
          <PageEditor
            pageId={pageId}
            initialContent={page.tiptapContent}
            currentUserId={currentUserId}
            onEditorReady={onEditorReady}
          />

        </div>
      </div>
    </EditorContextProvider>
  );
}
