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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  workspaceId:      string;
  page:              PageData;
  verses:            Verse[];
  surahNumber:       number;
  surahName:         string;
  pageId:            string;
  role:              MemberRole;
  notes:             NoteData[];
  groupProgress:     Record<string, { status: ProgressStatus; lastChangedBy: string }>;
  personalProgress:  Record<string, ProgressStatus>;
  currentUserId:     string;
  currentUserName:   string;
  roomSocket?:       import("partysocket").default | null;
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
  workspaceId,
  page,
  verses,
  surahNumber,
  surahName,
  pageId,
  role,
  notes,
  groupProgress,
  personalProgress,
  currentUserId,
  currentUserName,
  roomSocket,
  onEditorReady,
  onOpenTafsir,
  onProgressChange,
  onNoteCreated,
  onNoteUpdated,
  onNoteDeleted,
}: Props) {
  // Memoized so AyahBlockView consumers don't re-render on every parent
  // render (e.g. presence updates) — only when the actual data changes.
  const editorContextValue = useMemo(() => ({
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
  }), [
    pageId, surahNumber, verses, notes, role, personalProgress, groupProgress,
    onNoteCreated, onNoteUpdated, onNoteDeleted, onProgressChange, onOpenTafsir,
  ]);

  /* Editor zoom.
     Uses the CSS `zoom` property rather than a transform: zoom participates in
     layout, so the caret, hit-testing and ProseMirror's coordinate maths all
     stay correct inside a contentEditable. A transform would scale the paint
     only and put the caret in the wrong place.
     Ctrl/Cmd + wheel to zoom, matching every other document surface; a bare
     wheel must keep scrolling. */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [docZoom, setDocZoom] = useState(1);
  useEffect(() => {
    try {
      const v = parseFloat(localStorage.getItem("tl-editor-zoom") ?? "");
      if (Number.isFinite(v) && v >= 0.2 && v <= 3) setDocZoom(v);
    } catch { /* ignore */ }
  }, []);
  const applyZoom = useCallback((z: number) => {
    const next = Math.min(3, Math.max(0.2, z));
    setDocZoom(next);
    try { localStorage.setItem("tl-editor-zoom", String(next)); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;   // plain wheel still scrolls
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const step = Math.max(-0.18, Math.min(0.18, e.deltaY * unit * 0.0015));
      setDocZoom((prev) => {
        const next = Math.min(3, Math.max(0.2, prev * Math.exp(-step)));
        try { localStorage.setItem("tl-editor-zoom", String(next)); } catch { /* ignore */ }
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <EditorContextProvider value={editorContextValue}>
      <div className="doc-wrap" ref={wrapRef}>
        {/* Zoom HUD — mirrors the canvas control so the gesture and the
            readout are the same wherever you are. */}
        <div className="doc-zoom" role="group" aria-label="Zoom">
          <button onClick={() => applyZoom(docZoom / 1.15)} title="Zoom out" aria-label="Zoom out">−</button>
          <button onClick={() => applyZoom(1)} title="Reset zoom" aria-label="Reset zoom">
            {Math.round(docZoom * 100)}%
          </button>
          <button onClick={() => applyZoom(docZoom * 1.15)} title="Zoom in" aria-label="Zoom in">+</button>
        </div>
        <div className="doc" style={{ zoom: docZoom }}>

          {/* ── Cover ──────────────────────────────────────────────── */}
          <div className="doc-cover">
            <div className="doc-cover-tag">
              Sūrah {surahNumber} · {surahName} · Page {page.orderIndex + 1}
            </div>
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
          {/* marginBlock, NOT the margin shorthand: `margin: 28px 0 32px` also sets
              the inline margins to 0, which overrides the `margin-inline: auto`
              that centres every other child of .doc — the rule sat flush left
              while the cover and the editor were centred. */}
          <div className="block-divider" style={{ marginBlock: "28px 32px" }} />

          {/* ── Free editor ────────────────────────────────────────── */}
          <PageEditor
            key={pageId}
            pageId={pageId}
            workspaceId={workspaceId}
            surahName={surahName}
            initialContent={page.tiptapContent}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            roomSocket={roomSocket ?? null}
            onEditorReady={onEditorReady}
            textBoxNotes={notes.filter((n) => n.noteType === "textbox" && n.anchorType === "editor")}
            onNoteCreated={onNoteCreated}
            onNoteUpdated={onNoteUpdated}
            onNoteDeleted={onNoteDeleted}
          />

        </div>
      </div>
    </EditorContextProvider>
  );
}
