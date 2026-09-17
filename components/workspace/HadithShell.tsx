"use client";

/**
 * HadithShell — one hadith, rendered INTO the canvas so you annotate directly
 * on the text.
 *
 * Built on the same shell as book study rather than on the sūrah view, and
 * that is a judgement about the text, not a shortcut. The Mushaf view exists
 * because the Qurʾān is read as numbered ʾāyāt with word-level morphology and
 * a tafsīr per verse; a hadith is one narration — a chain, a saying, a source
 * — and slicing it into pseudo-verses to reuse that machinery would invent a
 * structure the text does not have. So the hadith is laid out as the sheet it
 * is, and the whiteboard's ink, movable note containers, pan and zoom sit over
 * it exactly as they sit over a PDF page.
 *
 * Everything generic comes along unchanged: presence, the realtime room, the
 * note containers with their "/" commands, the pen, and Lab AI.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { MemberRole } from "@/lib/services/workspaces.service";
import type { NoteData } from "./NoteCard";
import type { Hadith } from "@/lib/hadith";
import { EditorContextProvider, type EditorContextValue } from "./editor/EditorContext";
import { useRoom } from "@/lib/collab/useRoom";
import { usePresence } from "@/lib/collab/usePresence";
import WhiteboardPage from "./WhiteboardPage";
import AiPanel from "./AiPanel";

interface Props {
  workspaceId:     string;
  workspaceName:   string;
  pageId:          string;
  hadith:          Hadith;
  /** Neighbours, so you can walk the collection without going home. */
  prevNumber:      number | null;
  nextNumber:      number | null;
  role:            MemberRole;
  currentUserId:   string;
  currentUserName: string;
}

/** Where the sheet sits in world space. The canvas pans and zooms around it. */
const SHEET = { x: 120, y: 120, w: 900 };

export default function HadithShell({
  workspaceId, workspaceName, pageId, hadith, prevNumber, nextNumber,
  role, currentUserId, currentUserName,
}: Props) {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const recentCreatedRef = useRef<Map<string, number>>(new Map());
  const [aiOpen, setAiOpen] = useState(false);

  const room = useRoom(pageId);
  const { others } = usePresence({
    socket: room.socket, userId: currentUserId, name: currentUserName, mode: "board",
  });

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
    let live = true;
    fetch(`/api/pages/${pageId}/notes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { notes?: NoteData[] } | null) => { if (live && d?.notes) setNotes(d.notes); })
      .catch(() => {});
    return () => { live = false; };
  }, [pageId]);

  const boardNotes = useMemo(
    () => notes.filter((n) => n.noteType === "textbox" && n.anchorType === "whiteboard"),
    [notes],
  );

  /* The context the note containers read. There are no verses here, and
     saying so plainly is better than inventing one: the "/" commands that
     need an āyah simply have nothing to offer, rather than offering something
     that does not belong to this text. */
  const ctx = useMemo<EditorContextValue>(() => ({
    pageId, workspaceId, surahNumber: 0, verses: [], notes, role,
    personalProgress: {}, groupProgress: {},
    onNoteCreated: handleNoteCreated,
    onNoteUpdated: handleNoteUpdated,
    onNoteDeleted: handleNoteDeleted,
    onProgressChange: async () => {},
    onOpenTafsir: () => {},
  }), [pageId, workspaceId, notes, role, handleNoteCreated, handleNoteUpdated, handleNoteDeleted]);

  return (
    <div className="whiteboard-shell">
      <header className="whiteboard-shell-bar">
        <Link href={`/workspaces/${workspaceId}`} className="whiteboard-shell-back">
          <ChevronLeft size={16} /> {workspaceName}
        </Link>
        <span className="whiteboard-shell-title">
          Hadith {hadith.number} · {hadith.title}
        </span>
        <div className="hd-bar-actions">
          {/* Walking the collection, without a trip back to the grid. */}
          <Link
            href={prevNumber ? `/workspaces/${workspaceId}/hadith/${prevNumber}` : "#"}
            className="hd-step"
            aria-disabled={!prevNumber}
            data-off={prevNumber ? "false" : "true"}
            aria-label="Previous hadith"
          ><ChevronLeft size={16} /></Link>
          <Link
            href={nextNumber ? `/workspaces/${workspaceId}/hadith/${nextNumber}` : "#"}
            className="hd-step"
            aria-disabled={!nextNumber}
            data-off={nextNumber ? "false" : "true"}
            aria-label="Next hadith"
          ><ChevronRight size={16} /></Link>
          <button
            type="button"
            className="hd-ask"
            onClick={() => setAiOpen((v) => !v)}
            data-active={aiOpen ? "true" : "false"}
          >
            <Sparkles size={14} aria-hidden /> Ask
          </button>
          <div className="whiteboard-shell-presence">
            {others.slice(0, 4).map((p, i) => (
              <span key={i} className="whiteboard-shell-pip" style={{ background: p.color }} title={p.name} />
            ))}
          </div>
        </div>
      </header>

      <div className="whiteboard-shell-body">
        <EditorContextProvider value={ctx}>
          <WhiteboardPage
            pageId={pageId}
            notes={boardNotes}
            roomSocket={room.socket}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onNoteCreated={handleNoteCreated}
            onNoteUpdated={handleNoteUpdated}
            onNoteDeleted={handleNoteDeleted}
            showBlankHint={false}
            background={
              /* The sheet lives in WORLD space, behind the ink and the note
                 containers, so annotations keep their place over the text
                 through any pan or zoom — the same contract the PDF pages
                 have in book study. */
              <div
                className="hd-sheet"
                style={{ left: SHEET.x, top: SHEET.y, width: SHEET.w }}
              >
                <div className="hd-sheet-head">
                  <span className="hd-sheet-num">{hadith.number}</span>
                  <span className="hd-sheet-title">{hadith.title}</span>
                </div>

                <p className="hd-sheet-arabic" dir="rtl" lang="ar">{hadith.arabic}</p>

                <div className="hd-sheet-rule" />

                <p className="hd-sheet-english" dir="ltr" lang="en">{hadith.english}</p>

                {hadith.reference && (
                  <p className="hd-sheet-ref">{hadith.reference}</p>
                )}
              </div>
            }
          />
        </EditorContextProvider>
      </div>

      {aiOpen && (
        <AiPanel
          workspaceId={workspaceId}
          pageId={pageId}
          /* There is no sūrah here. The assistant is told the page it is on
             and searches this reader's own notes; it is not handed a sūrah
             number that would send it looking in the wrong book. */
          surahNumber={0}
          surahName={`Hadith ${hadith.number} — ${hadith.title}`}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  );
}
