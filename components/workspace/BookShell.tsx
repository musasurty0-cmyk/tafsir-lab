"use client";

/**
 * BookShell — one book, rendered INTO the canvas so you annotate directly on
 * the pages (like the Mushaf). MuPDF rasterises the PDF pages; they sit behind
 * the whiteboard's ink + movable note containers, sharing the same pan/zoom.
 *
 * Library books load from a static URL; uploaded books load their bytes from
 * the browser (IndexedDB) — if they're not on this device we show a friendly
 * re-upload prompt (the notes are synced; only the PDF bytes are local).
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
import PdfPages from "./PdfPages";
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

type Source =
  | { kind: "loading" }
  | { kind: "ready"; data: string | ArrayBuffer }
  | { kind: "missing" };

export default function BookShell({
  workspaceId, workspaceName, pageId, bookTitle, pdfUrl,
  currentUserId, currentUserName, role,
}: Props) {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const recentCreatedRef  = useRef<Map<string, number>>(new Map());
  // Library books resolve synchronously to their static URL; uploaded ("local")
  // books start loading and the effect below fetches their bytes.
  const [source, setSource] = useState<Source>(() =>
    pdfUrl !== "local" ? { kind: "ready", data: pdfUrl } : { kind: "loading" },
  );
  const uploadRef = useRef<HTMLInputElement>(null);

  const room = useRoom(pageId);
  const { others } = usePresence({
    socket: room.socket, userId: currentUserId, name: currentUserName, mode: "board",
  });

  // ── Resolve uploaded ("local") PDF bytes from IndexedDB ──────────────────
  const loadLocal = useCallback(async () => {
    const blob = await getBookPdf(pageId).catch(() => null);
    if (!blob) { setSource({ kind: "missing" }); return; }
    setSource({ kind: "ready", data: await blob.arrayBuffer() });
  }, [pageId]);

  useEffect(() => {
    if (pdfUrl !== "local") return; // library book already resolved in state
    loadLocal();
  }, [pdfUrl, loadLocal]);

  async function onReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await putBookPdf(pageId, file);
    setSource({ kind: "ready", data: await file.arrayBuffer() });
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

  /* `live` on both of these: the notes list is component state that survives a
     page change, so a reply for the page just left would drop its notes into
     the page now open. The poll's merge below deliberately KEEPS local notes it
     does not recognise, which means stale notes, once merged in, stay. */
  useEffect(() => {
    let live = true;
    fetch(`/api/pages/${pageId}/notes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { notes?: NoteData[] } | null) => { if (live && d?.notes) setNotes(d.notes); })
      .catch(() => {});
    return () => { live = false; };
  }, [pageId]);

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

  const bookNotes = useMemo(
    () => notes.filter((n) => n.noteType === "textbox" && n.anchorType === "whiteboard"),
    [notes],
  );

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
        <span className="whiteboard-shell-title">📚 {bookTitle}</span>
        <div className="whiteboard-shell-presence">
          {others.slice(0, 4).map((p, i) => (
            <span key={i} className="whiteboard-shell-pip" style={{ background: p.color }} title={p.name} />
          ))}
        </div>
      </header>

      <div className="whiteboard-shell-body">
        {source.kind === "missing" ? (
          <div className="book-missing">
            <p className="book-missing-title">This PDF isn’t on this device</p>
            <p className="book-missing-body">
              You uploaded “{bookTitle}” on another device. Your notes are saved — just re-open the
              PDF here to see them in place.
            </p>
            <button className="ws-new-btn" onClick={() => uploadRef.current?.click()}>
              <Upload size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} /> Choose the PDF
            </button>
            <input ref={uploadRef} type="file" accept="application/pdf,.pdf" hidden onChange={onReupload} />
          </div>
        ) : (
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
              showBlankHint={false}
              background={source.kind === "ready" ? <PdfPages src={source.data} /> : null}
            />
          </EditorContextProvider>
        )}
      </div>

      <TafsirDrawer open={tafsirOpen} verseKey={tafsirVerse} verses={[]} onClose={() => setTafsirOpen(false)} />
    </div>
  );
}
