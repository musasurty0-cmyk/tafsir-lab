"use client";

/**
 * WhiteboardShell — standalone page for the per-workspace blank whiteboard.
 *
 * Its own route (/workspaces/[id]/whiteboard), not tied to any surah. Owns the
 * notes list + live sync (PartyKit room) and renders WhiteboardPage inside a
 * minimal EditorContext so the containers' /ayah blocks resolve verses (they
 * fetch by key; no pre-loaded surah is needed). /tafsir + the tafsir button
 * open the shared TafsirDrawer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { MemberRole } from "@/lib/services/workspaces.service";
import type { NoteData } from "./NoteCard";
import { EditorContextProvider, type EditorContextValue } from "./editor/EditorContext";
import { useRoom } from "@/lib/collab/useRoom";
import { usePresence } from "@/lib/collab/usePresence";
import WhiteboardPage from "./WhiteboardPage";
import TafsirDrawer from "./TafsirDrawer";

interface Props {
  workspaceId:     string;
  workspaceName:   string;
  pageId:          string;
  boardTitle?:     string;
  role:            MemberRole;
  currentUserId:   string;
  currentUserName: string;
}

export default function WhiteboardShell({
  workspaceId, workspaceName, pageId, boardTitle, role, currentUserId, currentUserName,
}: Props) {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const recentCreatedRef  = useRef<Map<string, number>>(new Map());

  const room = useRoom(pageId);
  const { others } = usePresence({
    socket: room.socket, userId: currentUserId, name: currentUserName, mode: "board",
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

  const whiteboardNotes = useMemo(
    () => notes.filter((n) => n.noteType === "textbox" && n.anchorType === "whiteboard"),
    [notes],
  );

  // Minimal editor context — verses empty (ayah blocks fetch by key), tafsir
  // button opens the drawer.
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
        <span className="whiteboard-shell-title">◇ {boardTitle ?? "Whiteboard"}</span>
        <div className="whiteboard-shell-presence">
          {others.slice(0, 4).map((p, i) => (
            <span key={i} className="whiteboard-shell-pip" style={{ background: p.color }} title={p.name} />
          ))}
        </div>
      </header>

      <div className="whiteboard-shell-body">
        <EditorContextProvider value={ctx}>
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
        </EditorContextProvider>
      </div>

      <TafsirDrawer open={tafsirOpen} verseKey={tafsirVerse} verses={[]} onClose={() => setTafsirOpen(false)} />
    </div>
  );
}
