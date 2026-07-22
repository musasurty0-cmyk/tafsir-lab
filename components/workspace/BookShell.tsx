"use client";

/**
 * BookShell — one book: the PDF beside a note canvas.
 *
 * The PDF renders in the browser's own native viewer (an <iframe>) — reliable
 * and fast for any PDF, unlike client-side rasterising. Beside it is the full
 * whiteboard note canvas (pen, highlighter, movable rich cards, /ayah + /tafsir)
 * so you take notes AROUND the book. Library books load from a static URL;
 * uploaded books load their bytes from the browser (IndexedDB) — if they're not
 * on this device we show a friendly re-upload prompt (the notes are synced; only
 * the PDF bytes are local).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Upload } from "lucide-react";
import type { MemberRole } from "@/lib/services/workspaces.service";
import type { NoteData } from "./NoteCard";
import { EditorContextProvider, type EditorContextValue } from "./editor/EditorContext";
import { useRoom } from "@/lib/collab/useRoom";
import { usePresence } from "@/lib/collab/usePresence";
import { getBookPdf, putBookPdf } from "@/lib/books/pdf-store";
import WhiteboardPage from "./WhiteboardPage";
import TafsirDrawer from "./TafsirDrawer";

interface Props {
  workspaceId:     string;
  workspaceName:   string;
  pageId:          string;
  bookTitle:       string;
  pdfUrl:          string;   // "/books/slug.pdf" or "local"
  role:            MemberRole;
  currentUserId:   string;
  currentUserName: string;
}

type Source = { kind: "loading" } | { kind: "ready"; src: string } | { kind: "missing" };

export default function BookShell({
  workspaceId, workspaceName, pageId, bookTitle, pdfUrl,
  currentUserId, currentUserName, role,
}: Props) {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const recentCreatedRef  = useRef<Map<string, number>>(new Map());
  // Library books resolve synchronously (a static URL); uploaded ("local")
  // books start loading and the effect below fetches their bytes.
  const [source, setSource] = useState<Source>(() =>
    pdfUrl !== "local" ? { kind: "ready", src: pdfUrl + "#view=FitH" } : { kind: "loading" },
  );
  const objectUrlRef = useRef<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const room = useRoom(pageId);
  const { others } = usePresence({
    socket: room.socket, userId: currentUserId, name: currentUserName, mode: "board",
  });

  // ── Resolve the PDF source (static URL, or an object URL for local bytes) ─
  const loadLocal = useCallback(async () => {
    const blob = await getBookPdf(pageId).catch(() => null);
    if (!blob) { setSource({ kind: "missing" }); return; }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(blob);
    // #view=FitH gives a sensible default zoom in the native viewer.
    setSource({ kind: "ready", src: objectUrlRef.current + "#view=FitH" });
  }, [pageId]);

  useEffect(() => {
    if (pdfUrl !== "local") return; // library book already resolved in state
    loadLocal();
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, [pdfUrl, loadLocal]);

  async function onReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await putBookPdf(pageId, file);
    await loadLocal();
  }

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

  useEffect(() => {
    fetch(`/api/pages/${pageId}/notes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { notes?: NoteData[] } | null) => { if (d?.notes) setNotes(d.notes); })
      .catch(() => {});
  }, [pageId]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/pages/${pageId}/notes`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { notes?: NoteData[] } | null) => {
          if (!d?.notes) return;
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
    return () => clearInterval(id);
  }, [pageId]);

  const bookNotes = useMemo(
    () => notes.filter((n) => n.noteType === "textbox" && n.anchorType === "whiteboard"),
    [notes],
  );

  const ctx = useMemo<EditorContextValue>(() => ({
    pageId, surahNumber: 0, verses: [], notes, role,
    personalProgress: {}, groupProgress: {},
    onNoteCreated: handleNoteCreated, onNoteUpdated: handleNoteUpdated, onNoteDeleted: handleNoteDeleted,
    onProgressChange: async () => {}, onOpenTafsir: openTafsir,
  }), [pageId, notes, role, handleNoteCreated, handleNoteUpdated, handleNoteDeleted, openTafsir]);

  return (
    <div className="whiteboard-shell">
      <header className="whiteboard-shell-bar">
        <Link href={`/workspaces/${workspaceId}`} className="whiteboard-shell-back">
          <ChevronLeft size={16} /> {workspaceName}
        </Link>
        <span className="whiteboard-shell-title">📚 {bookTitle}</span>
        <div className="whiteboard-shell-presence">
          {others.slice(0, 4).map((p, i) => (
            <span key={i} className="whiteboard-shell-pip" style={{ background: p.color }} title={p.name} />
          ))}
        </div>
      </header>

      <div className="whiteboard-shell-body book-split">
        {/* ── PDF pane (native browser viewer) ── */}
        <div className="book-pdf-pane">
          {source.kind === "missing" ? (
            <div className="book-missing">
              <p className="book-missing-title">This PDF isn’t on this device</p>
              <p className="book-missing-body">
                You uploaded “{bookTitle}” on another device. Your notes are saved — just re-open the
                PDF here to read alongside them.
              </p>
              <button className="ws-new-btn" onClick={() => uploadRef.current?.click()}>
                <Upload size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} /> Choose the PDF
              </button>
              <input ref={uploadRef} type="file" accept="application/pdf,.pdf" hidden onChange={onReupload} />
            </div>
          ) : source.kind === "ready" ? (
            <iframe className="book-pdf-frame" src={source.src} title={bookTitle} />
          ) : (
            <div className="book-missing"><p className="book-missing-body">Opening book…</p></div>
          )}
        </div>

        {/* ── Note canvas pane ── */}
        <div className="book-notes-pane">
          <EditorContextProvider value={ctx}>
            <WhiteboardPage
              pageId={pageId}
              notes={bookNotes}
              roomSocket={room.socket}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              onNoteCreated={handleNoteCreated}
              onNoteUpdated={handleNoteUpdated}
              onNoteDeleted={handleNoteDeleted}
            />
          </EditorContextProvider>
        </div>
      </div>

      <TafsirDrawer open={tafsirOpen} verseKey={tafsirVerse} verses={[]} onClose={() => setTafsirOpen(false)} />
    </div>
  );
}
