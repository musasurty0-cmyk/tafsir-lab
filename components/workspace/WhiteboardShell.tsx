"use client";

/**
 * WhiteboardShell — standalone page for the per-workspace blank whiteboard.
 *
 * Its own route (/workspaces/[id]/whiteboard), not tied to any surah. Owns the
 * notes list + live sync (PartyKit room) and renders WhiteboardPage inside a
 * minimal EditorContext so the containers' /ayah blocks resolve verses (they
 * fetch by key; no pre-loaded surah is needed). /tafsir + the tafsir button
 * open the shared TafsirDrawer.
 *
 * A board carries BOTH surfaces, switched from the header:
 *   canvas — the freeform WhiteboardPage (ink + movable containers)
 *   notes  — the same document editor a surah page uses, minus the surah
 * They are separate stores on the same Page row, so neither can clobber the
 * other: the canvas writes notes with anchorType "whiteboard" plus drawings,
 * the document writes page.tiptapContent. Everything a surah page's editor can
 * do works here — /ayah, /tabari, tables, ink — the surah is simply not
 * assumed, which is the whole point of a blank board.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Editor } from "@tiptap/core";
import type { MemberRole } from "@/lib/services/workspaces.service";
import type { NoteData } from "./NoteCard";
import { EditorContextProvider, type EditorContextValue } from "./editor/EditorContext";
import { useRoom } from "@/lib/collab/useRoom";
import { usePresence } from "@/lib/collab/usePresence";
import WhiteboardPage from "./WhiteboardPage";
import PageEditor from "./editor/PageEditor";
import EditorToolbar from "./editor/EditorToolbar";
import TafsirDrawer from "./TafsirDrawer";

/** Which surface the board is showing. Remembered per board. */
type BoardView = "canvas" | "notes";
const VIEW_KEY = (pageId: string) => `tl-board-view:${pageId}`;

const CanvasIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

const NotesIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
    <path d="M8 7h8M8 11h8M8 15h5" />
  </svg>
);

const FormatIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 7V4h16v3M9 20h6M12 4v16" />
  </svg>
);

interface Props {
  workspaceId:     string;
  workspaceName:   string;
  pageId:          string;
  boardTitle?:     string;
  /** The board's saved document JSON (null until the notes view is first used). */
  boardContent?:   unknown;
  role:            MemberRole;
  currentUserId:   string;
  currentUserName: string;
}

export default function WhiteboardShell({
  workspaceId, workspaceName, pageId, boardTitle, boardContent, role,
  currentUserId, currentUserName,
}: Props) {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const recentCreatedRef  = useRef<Map<string, number>>(new Map());

  /* Which surface is showing. Read from localStorage in an effect rather than
     a lazy initialiser: the server renders this component too, and seeding
     state from storage during render makes the first client paint disagree
     with the server's HTML. */
  const [view, setView] = useState<BoardView>("canvas");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY(pageId));
      if (saved === "notes" || saved === "canvas") setView(saved);
    } catch { /* ignore */ }
  }, [pageId]);
  const chooseView = useCallback((v: BoardView) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY(pageId), v); } catch { /* ignore */ }
  }, [pageId]);

  // Formatting ribbon — only meaningful in the notes view.
  const [editor, setEditor]                 = useState<Editor | null>(null);
  const [formattingOpen, setFormattingOpen] = useState(false);

  const room = useRoom(pageId);
  const { others } = usePresence({
    socket: room.socket, userId: currentUserId, name: currentUserName,
    // Report the surface actually being used, so a peer's pip means the same
    // thing here as it does on a surah page.
    mode: view === "notes" ? "editor" : "board",
  });

  // ── Tafsir drawer ────────────────────────────────────────────────────────
  const [tafsirOpen, setTafsirOpen]   = useState(false);
  const [tafsirVerse, setTafsirVerse] = useState<string | null>(null);
  const openTafsir = useCallback((verseKey: string) => { setTafsirVerse(verseKey); setTafsirOpen(true); }, []);

  // ── Note CRUD (optimistic, poll-protected) ───────────────────────────────
  const handleNoteCreated = useCallback((note: NoteData) => {
    recentCreatedRef.current.set(note.id, Date.now());
    setNotes((prev) => [...prev, note]);
  }, []);
  const handleNoteUpdated = useCallback((updated: NoteData) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
  }, []);
  const handleNoteDeleted = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  /* Initial load. `live` because the notes list survives a page change: a
     reply for the page just left would drop its notes into the page now open,
     and the poll's merge below keeps unrecognised local notes, so once a stale
     one is in it stays. */
  useEffect(() => {
    let live = true;
    fetch(`/api/pages/${pageId}/notes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { notes?: NoteData[] } | null) => { if (live && d?.notes) setNotes(d.notes); })
      .catch(() => {});
    return () => { live = false; };
  }, [pageId]);

  // Poll every 5s (merge: keep temps + recently-created so the server catch-up
  // never wipes a fresh container)
  useEffect(() => {
    let live = true;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/pages/${pageId}/notes`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { notes?: NoteData[] } | null) => {
          if (!live || !d?.notes) return;
          setNotes((prev) => {
            const server = d.notes!;
            const ids = new Set(server.map((n) => n.id));
            const now = Date.now();
            for (const [k, ts] of recentCreatedRef.current) if (now - ts > 15000) recentCreatedRef.current.delete(k);
            const kept = prev.filter((n) => !ids.has(n.id) && (n.id.startsWith("temp-") || recentCreatedRef.current.has(n.id)));
            return [...server, ...kept];
          });
        })
        .catch(() => {});
    }, 5000);
    return () => { live = false; clearInterval(id); };
  }, [pageId]);

  /* The two surfaces keep separate container sets on the same page: the canvas
     anchors to "whiteboard", the document to "editor". Splitting them here is
     what stops a box dropped on one from appearing adrift on the other. */
  const whiteboardNotes = useMemo(
    () => notes.filter((n) => n.noteType === "textbox" && n.anchorType === "whiteboard"),
    [notes],
  );
  const editorNotes = useMemo(
    () => notes.filter((n) => n.noteType === "textbox" && n.anchorType === "editor"),
    [notes],
  );

  // Minimal editor context — verses empty (ayah blocks fetch by key), tafsir
  // button opens the drawer.
  const ctx = useMemo<EditorContextValue>(() => ({
    pageId, workspaceId, surahNumber: 0, verses: [], notes, role,
    personalProgress: {}, groupProgress: {},
    onNoteCreated: handleNoteCreated, onNoteUpdated: handleNoteUpdated, onNoteDeleted: handleNoteDeleted,
    onProgressChange: async () => {}, onOpenTafsir: openTafsir,
  }), [pageId, workspaceId, notes, role, handleNoteCreated, handleNoteUpdated, handleNoteDeleted, openTafsir]);

  return (
    <div className="whiteboard-shell">
      <header className="whiteboard-shell-bar">
        <Link href={`/workspaces/${workspaceId}`} className="whiteboard-shell-back">
          <ChevronLeft size={16} /> {workspaceName}
        </Link>
        <span className="whiteboard-shell-title">◇ {boardTitle ?? "Whiteboard"}</span>

        <div className="whiteboard-shell-tools">
          <div className="mode-toggle" role="group" aria-label="Board view">
            <button
              className="mode-btn"
              data-active={view === "canvas" ? "true" : "false"}
              onClick={() => view !== "canvas" && chooseView("canvas")}
              title="Canvas — draw and place notes freely"
              aria-label="Canvas view"
            >
              <CanvasIcon />
            </button>
            <button
              className="mode-btn"
              data-active={view === "notes" ? "true" : "false"}
              onClick={() => view !== "notes" && chooseView("notes")}
              title="Notes — write a document"
              aria-label="Notes view"
            >
              <NotesIcon />
            </button>
          </div>

          {view === "notes" && (
            <button
              className="mode-btn whiteboard-shell-format"
              data-active={formattingOpen ? "true" : "false"}
              onClick={() => setFormattingOpen((o) => !o)}
              title={formattingOpen ? "Hide formatting" : "Show formatting"}
              aria-label="Toggle formatting"
            >
              <FormatIcon />
            </button>
          )}
        </div>

        <div className="whiteboard-shell-presence">
          {others.slice(0, 4).map((p, i) => (
            <span key={i} className="whiteboard-shell-pip" style={{ background: p.color }} title={p.name} />
          ))}
        </div>
      </header>

      <EditorToolbar editor={editor} open={view === "notes" && formattingOpen} />

      <div className="whiteboard-shell-body">
        <EditorContextProvider value={ctx}>
          {view === "canvas" ? (
            <WhiteboardPage
              pageId={pageId}
              notes={whiteboardNotes}
              roomSocket={room.socket}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              onNoteCreated={handleNoteCreated}
              onNoteUpdated={handleNoteUpdated}
              onNoteDeleted={handleNoteDeleted}
            />
          ) : (
            <div className="doc-wrap board-doc-wrap">
              <div className="doc">
                <PageEditor
                  key={pageId}
                  pageId={pageId}
                  workspaceId={workspaceId}
                  initialContent={boardContent}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  roomSocket={room.socket}
                  onEditorReady={setEditor}
                  textBoxNotes={editorNotes}
                  onNoteCreated={handleNoteCreated}
                  onNoteUpdated={handleNoteUpdated}
                  onNoteDeleted={handleNoteDeleted}
                />
              </div>
            </div>
          )}
        </EditorContextProvider>
      </div>

      <TafsirDrawer open={tafsirOpen} verseKey={tafsirVerse} verses={[]} onClose={() => setTafsirOpen(false)} />
    </div>
  );
}
