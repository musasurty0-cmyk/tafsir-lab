"use client";
// Phase 7 / Phase 9

/**
 * WorkspacePageView — full workspace shell for a specific page.
 *
 * Phase 9 additions:
 *   - "split" view mode: ModeAPage + ModeBPage rendered side-by-side.
 *   - Notes state lifted here so both panes share one source of truth.
 *   - Sync state:
 *       selectedVerseKey  — set by Mode B focus open; Mode A flashes + scrolls.
 *       selectedNoteId    — set by Mode A note click; Mode B pans to that note.
 *   - progressLoading indicator in TopBar.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Chapter, Verse } from "@/lib/types";
import type { MemberRole } from "@/lib/services/workspaces.service";
import { canManagePages } from "@/lib/services/workspaces.service";
import type { ProgressStatus } from "@/lib/services/progress.service";
import type { NoteData } from "./NoteCard";
import type { ViewMode } from "./TopBar";
import Rail from "./Rail";
import { ChevronRight } from "lucide-react";
import WorkspaceSidebar from "./WorkspaceSidebar";
import TopBar from "./TopBar";
import ScriptView from "./ScriptView";
import AiPanel from "./AiPanel";
import ModeAPage from "./ModeAPage";
import EditorToolbar from "./editor/EditorToolbar";
import type { Editor } from "@tiptap/core";
import { labMarkdownToTiptap } from "@/lib/lab-to-tiptap";
import ModeBPage, { type PageUserPrefsData } from "./ModeBPage";
import WhiteboardPage from "./WhiteboardPage";
import { EditorContextProvider } from "./editor/EditorContext";
import TafsirDrawer from "./TafsirDrawer";
import TweaksPanel, { type TweaksState, TWEAKS_DEFAULTS } from "./TweaksPanel";
import TourBubble  from "@/components/TourBubble";
import { useRoom } from "@/lib/collab/useRoom";
import { usePresence } from "@/lib/collab/usePresence";
import { pageToMarkdown, downloadMarkdown } from "@/lib/export-markdown";
import { DEFAULT_PEN_COLOR } from "./CanvasToolRail";

// ── Shared types ──────────────────────────────────────────────────────────

interface PageSummary {
  id: string;
  title: string;
  orderIndex: number;
  status: string;
  isAdminAuthored: boolean;
  createdById: string;
  createdAt: Date;
  publishedAt: Date | null;
  createdBy: { id: string; name: string; avatarUrl: string | null };
}

interface FullPage extends PageSummary {
  publishedBy:    { id: string; name: string; avatarUrl: string | null } | null;
  publishedById:  string | null;
  userPrefs:      PageUserPrefsData | null;
  notes:          NoteData[];
  tiptapContent:  unknown; // JSON doc for the free editor, null for new pages
}

interface Props {
  workspaceId:   string;
  workspace:     { id: string; name: string; type: string; ownerId: string; membersCanManagePages: boolean };
  role:          MemberRole;
  chapter:       Chapter;
  surahNumber:   number;
  verses:        Verse[];
  pages:         PageSummary[];
  activePageId:  string;
  page:          FullPage | null;
  groupProgress: Record<string, { status: ProgressStatus; lastChangedBy: string }>;
  currentUserId: string;
  currentUserName: string;
}

// ── Tweaks helpers ────────────────────────────────────────────────────────

function loadTweaks(): TweaksState {
  if (typeof window === "undefined") return TWEAKS_DEFAULTS;
  try {
    const raw = localStorage.getItem("tl-tweaks");
    return raw ? { ...TWEAKS_DEFAULTS, ...JSON.parse(raw) } : TWEAKS_DEFAULTS;
  } catch {
    return TWEAKS_DEFAULTS;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

/** How long a locally created page is kept even if the server has not
 *  returned it yet. Long enough to outlast a read-after-write race,
 *  short enough that a page deleted elsewhere still disappears. */
const KEEP_UNCONFIRMED_MS = 30_000;

export default function WorkspacePageView({
  workspaceId,
  workspace,
  role,
  chapter,
  surahNumber,
  verses,
  pages,
  activePageId,
  page,
  groupProgress: initialGroupProgress,
  currentUserId,
  currentUserName,
}: Props) {
  const router = useRouter();

  // ── UI state ─────────────────────────────────────────────────────────
  const [tweaks, setTweaks]               = useState<TweaksState>(TWEAKS_DEFAULTS);
  const [showTweaks, setShowTweaks]       = useState(false);
  const [mode, setMode]                   = useState<ViewMode>("editor");
  const [aiOpen, setAiOpen]               = useState(false);
  // Deep-link: ?mode=board (from the surah grid's Blank board button) opens
  // this page straight into the whiteboard.
  useEffect(() => {
    try {
      const m = new URLSearchParams(window.location.search).get("mode");
      /* "read" is no longer offered. It stays out of this list so an old link
         or a stored preference cannot drop someone into a mode with no button
         to leave it by. */
      if (m === "board" || m === "canvas" || m === "split" || m === "editor")
        setMode(m as ViewMode);
    } catch { /* ignore */ }
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  /* The topbar needs no collapse state here any more: it auto-hides on its
     own, taskbar-style — hidden until the pointer visits the top edge. */
  const [formattingOpen, setFormattingOpen] = useState(false);
  const [activeEditor, setActiveEditor]     = useState<Editor | null>(null);

  /**
   * Put a Lab AI answer into the page as notes.
   *
   * Inserted at the caret rather than appended, because the reader pressed the
   * button while looking at a particular place in their notes. Citations are
   * resolved to the source they stood for on the way in — a bare [1] means
   * nothing once the answer is separated from the conversation that retrieved
   * it, and the sourcing is the point of the whole app.
   *
   * Returns whether it landed, so the panel can say so rather than looking
   * like a button that does nothing.
   */
  const addAnswerToEditor = useCallback((
    markdown: string,
    cites: { n: number; sourceName: string; verseKey: string }[],
  ): boolean => {
    const ed = activeEditor;
    if (!ed || ed.isDestroyed) return false;
    const nodes = labMarkdownToTiptap(markdown, (n) => {
      const c = cites.find((x) => x.n === n);
      return c ? `${c.sourceName} ${c.verseKey}` : null;
    });
    if (!nodes.length) return false;
    // One chain, so it is a single undo step rather than one per paragraph.
    ed.chain().focus().insertContent(nodes).run();
    return true;
  }, [activeEditor]);


  // Persist formatting toolbar open/closed state
  useEffect(() => {
    try { setFormattingOpen(localStorage.getItem("tl-editor-toolbar-open") === "true"); } catch { /* ignore */ }
  }, []);
  const handleToggleFormatting = useCallback(() => {
    setFormattingOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem("tl-editor-toolbar-open", String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Tafsir drawer ─────────────────────────────────────────────────────
  const [tafsirOpen, setTafsirOpen]         = useState(false);
  const [tafsirVerseKey, setTafsirVerseKey] = useState<string | null>(null);

  // ── Notes — single source of truth for both panes ─────────────────────
  const [notes, setNotes] = useState<NoteData[]>(page?.notes ?? []);
  const [pageList, setPageList] = useState(() => pages);

  /* Re-sync when the server sends a different list.
     The initialiser above runs ONCE per component instance, and navigating
     between pages of the same surah reuses that instance — so the sidebar kept
     whatever list it was first mounted with. A page created in one view could
     then vanish when you came back to it, and renames made elsewhere never
     appeared. Compared by id+title so an identical list does not churn state
     on every render.

     Pages this client created are shielded from that re-sync for a short
     window. The earlier version shielded only rows still flagged `pending`,
     which are the OPTIMISTIC ones — but a successful create replaces its
     optimistic row with a real, unflagged one and then navigates. When that
     navigation's payload was read before the insert became visible (a pooled
     connection makes read-after-write a genuine race) the new page was in
     neither the payload nor the pending set, and the sync deleted it. That is
     the "I made a page and the last one vanished" report. */
  const recentlyCreated = useRef<Map<string, number>>(null!);
  recentlyCreated.current ??= new Map();

  const pageCreated = useCallback((page: PageSummary) => {
    recentlyCreated.current.set(page.id, Date.now());
    setPageList((prev) => (prev.some((p) => p.id === page.id) ? prev : [...prev, page]));
  }, []);

  const pagesKey = pages.map((p) => `${p.id}:${p.title}`).join("|");
  useEffect(() => {
    /* Pruned out here rather than inside the updater below: a state updater
       must be pure, and React may call it more than once for a single update.
       Stop shielding a page once the server acknowledges it, or the window
       lapses — shielding forever would mean a page deleted on another device
       could never disappear here. */
    const serverIds = new Set(pages.map((p) => p.id));
    const now = Date.now();
    for (const [id, at] of recentlyCreated.current) {
      if (serverIds.has(id) || now - at > KEEP_UNCONFIRMED_MS) {
        recentlyCreated.current.delete(id);
      }
    }

    setPageList((prev) => {
      const prevKey = prev.map((p) => `${p.id}:${p.title}`).join("|");
      if (prevKey === pagesKey) return prev;

      const unconfirmed = prev.filter((p) =>
        !serverIds.has(p.id) &&
        ("pending" in p || recentlyCreated.current.has(p.id)));

      return [...pages, ...unconfirmed];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey]);

  // Remove navigation splash screen injected by HomeClient on mount.
  useEffect(() => {
    document.getElementById("tl-nav-splash")?.remove();
    document.getElementById("tl-nav-splash-style")?.remove();
  }, []);

  // Reset when navigating to a different page.
  const pageIdRef = useRef(page?.id);
  useEffect(() => {
    if (page?.id !== pageIdRef.current) {
      pageIdRef.current = page?.id;
      setNotes(page?.notes ?? []);
    }
  }, [page]);

  // ── PartyKit room + presence ──────────────────────────────────────────
  const room = useRoom(activePageId);
  const { others: presenceOthers, updatePresence } = usePresence({
    socket:     room.socket,
    userId:     currentUserId,
    name:       currentUserName,
    mode,
    mushafPage: null,
  });

  // Keep presence mode in sync whenever the user switches views
  useEffect(() => {
    updatePresence({ mode });
  }, [mode, updatePresence]);

  // Recently-created note ids — protects fresh notes from being wiped by a
  // notes poll whose server read predates the creation (the "container
  // disappears then reappears" bug). Temps ("temp-…") are always protected.
  const recentCreatedRef = useRef<Map<string, number>>(new Map());

  const handleNoteCreated = useCallback((note: NoteData) => {
    recentCreatedRef.current.set(note.id, Date.now());
    setNotes((prev) => [...prev, note]);
  }, []);

  /**
   * Draw a Lab AI answer onto this page's whiteboard as a mindmap.
   *
   * Available in every mode, not only board mode. The notes endpoint creates
   * the containers and the drawings endpoint merges the connectors by id, so
   * a map asked for while reading lands on the board and is simply there when
   * you open it — which is better than refusing the request, and better than
   * dragging the reader into another view to satisfy the implementation.
   *
   * Each created container goes through handleNoteCreated so it is protected
   * from the notes poll: a poll whose server read predates the creation would
   * otherwise wipe a map seconds after it appeared.
   */
  const addAnswerToBoard = useCallback(async (
    markdown: string, question: string,
  ): Promise<boolean> => {
    if (!activePageId) return false;
    const { dropMindmap } = await import("@/lib/mindmap-drop");
    const drop = await dropMindmap({
      pageId:  activePageId,
      text:    markdown,
      subject: question,
      /* Only the board's own containers matter for placement; the Mushaf's
         anchored notes live in another space entirely. */
      existing: notes
        .filter((n) => n.anchorType === "whiteboard")
        .map((n) => ({
          offsetX: n.offsetX, offsetY: n.offsetY,
          width: n.width, height: n.height ?? null,
        })),
      inkColor: DEFAULT_PEN_COLOR,
    }).catch(() => null);

    if (!drop) return false;
    for (const n of drop.notes) handleNoteCreated(n as NoteData);
    return true;
  }, [activePageId, notes, handleNoteCreated]);

  const handleNoteUpdated = useCallback((updated: NoteData) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
  }, []);

  const handleNoteDeleted = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  // ── Split-view sync state ─────────────────────────────────────────────
  // Mode B → Mode A: when an ayah/word focus opens in canvas, flash + scroll
  // the matching verse block in the document pane.
  const [selectedVerseKey, setSelectedVerseKey] = useState<string | null>(null);

  // Mode A → Mode B: when a note card is clicked in the doc pane, pan the
  // canvas viewport to bring that anchored note into view.
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const handleAyahSelect = useCallback((verseKey: string) => {
    setSelectedVerseKey(verseKey);
    // Clear after a moment so re-clicking the same ayah re-triggers the effect.
    setTimeout(() => setSelectedVerseKey(null), 2500);
  }, []);

  const handleNoteSelect = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
    // Clear after the scroll has triggered.
    setTimeout(() => setSelectedNoteId(null), 1200);
  }, []);

  // ── Progress ──────────────────────────────────────────────────────────
  const [personalProgress, setPersonalProgress] =
    useState<Record<string, ProgressStatus>>({});
  const [groupProgress, setGroupProgress] =
    useState<Record<string, { status: ProgressStatus; lastChangedBy: string }>>(
      initialGroupProgress
    );
  const [progressLoading, setProgressLoading] = useState(false);

  // Hydrate tweaks + sidebar state after mount.
  useEffect(() => {
    setTweaks(loadTweaks());
    setSidebarCollapsed(localStorage.getItem("tl-sidebar-collapsed") === "1");
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("tl-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }, []);

  /* Fetch personal progress whenever the active page changes.
     Guarded: switching pages faster than the request completes would apply the
     previous page's read-progress to the new one, and progress is written back,
     so a stale reply does not just display wrong — it can persist wrong. */
  useEffect(() => {
    if (!activePageId) return;
    let live = true;
    setProgressLoading(true);
    fetch(`/api/pages/${activePageId}/progress?scope=personal`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { progress?: Record<string, ProgressStatus> } | null) => {
        if (live && data?.progress) setPersonalProgress(data.progress);
      })
      .catch(() => {})
      .finally(() => { if (live) setProgressLoading(false); });
    return () => { live = false; };
  }, [activePageId]);

  // ── Live sync polling ─────────────────────────────────────────────────────
  const lastPollRef = useRef<{ notes: number; progress: number }>({
    notes: Date.now(), progress: Date.now(),
  });

  useEffect(() => {
    if (!activePageId) return;

    function poll() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const last = lastPollRef.current;

      // Poll notes every 5s
      if (now - last.notes >= 5000) {
        last.notes = now;
        fetch(`/api/pages/${activePageId}/notes`)
          .then((r) => r.ok ? r.json() : null)
          .then((data: { notes?: NoteData[] } | null) => {
            if (!data?.notes) return;
            // MERGE, don't replace: keep unsaved temps and notes created in
            // the last 15s that a stale server read hasn't caught up with.
            setNotes((prev) => {
              const server    = data.notes!;
              const serverIds = new Set(server.map((n) => n.id));
              const now       = Date.now();
              for (const [id, ts] of recentCreatedRef.current) {
                if (now - ts > 15000) recentCreatedRef.current.delete(id);
              }
              const protectedLocal = prev.filter((n) =>
                !serverIds.has(n.id) &&
                (n.id.startsWith("temp-") || recentCreatedRef.current.has(n.id)));
              return [...server, ...protectedLocal];
            });
          })
          .catch(() => {});
      }

      // Poll group progress every 8s
      if (now - last.progress >= 8000) {
        last.progress = now;
        fetch(`/api/pages/${activePageId}/progress?scope=group`)
          .then((r) => r.ok ? r.json() : null)
          .then((data: { progress?: Record<string, { status: ProgressStatus; lastChangedBy: string }> } | null) => {
            if (data?.progress) setGroupProgress(data.progress);
          })
          .catch(() => {});
      }
    }

    const interval = setInterval(poll, 2000);
    document.addEventListener("visibilitychange", poll);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [activePageId]);

  // ── Tour event listeners (TourBubble → WorkspacePageView) ─────────────────
  useEffect(() => {
    function onTourMode(e: Event) {
      setMode((e as CustomEvent<ViewMode>).detail);
    }
    function onTourAction(e: Event) {
      const action = (e as CustomEvent<string>).detail;
      if (action === "open-tafsir") {
        setTafsirOpen(true);
      }
    }
    window.addEventListener("tl-tour-mode",   onTourMode);
    window.addEventListener("tl-tour-action", onTourAction);
    return () => {
      window.removeEventListener("tl-tour-mode",   onTourMode);
      window.removeEventListener("tl-tour-action", onTourAction);
    };
  }, []);

  const patchTweaks = (patch: Partial<TweaksState>) => {
    setTweaks((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("tl-tweaks", JSON.stringify(next));
      return next;
    });
  };

  const handlePageSelect = (pageId: string) => {
    pushWithSplash(router, `/workspaces/${workspaceId}/surahs/${surahNumber}/pages/${pageId}`);
  };

  const openTafsir = useCallback((verseKey: string) => {
    setTafsirVerseKey(verseKey);
    setTafsirOpen(true);
  }, []);

  // ── Markdown export — the "your notes aren't locked in" safety valve ──
  const handleExport = useCallback(() => {
    if (!page) return;
    /* Prefer what is on screen, but only if there is anything on it. The
       editor is collaborative: its content arrives over Yjs after mount, so
       between opening a page and the document syncing, getJSON() returns an
       empty doc. Exporting that produced a file with a title and nothing
       else — silently, which is the worst way for a backup to fail. */
    const live = activeEditor && !activeEditor.isDestroyed ? activeEditor.getJSON() : null;
    const hasLive = Array.isArray(live?.content) && live.content.length > 0;
    const doc = hasLive ? live : page.tiptapContent;
    const md = pageToMarkdown({
      title:     page.title,
      surahName: chapter.name_simple,
      doc,
      notes:     notes.map((n) => ({
        noteType:    n.noteType,
        surahNumber: n.surahNumber,
        ayahNumber:  n.ayahNumber,
        content:     n.content,
        author:      { name: n.author.name },
      })),
    });
    downloadMarkdown(`${page.title}.md`, md);
  }, [page, activeEditor, notes, chapter.name_simple]);

  // Optimistic progress mutation — reverts on API error.
  const handleProgressChange = useCallback(
    async (
      scope: "personal" | "group",
      sNum: number,
      aNum: number,
      status: ProgressStatus
    ) => {
      const key = `${sNum}:${aNum}`;

      const prevPersonal = personalProgress[key] ?? null;
      const prevGroup    = groupProgress[key]    ?? null;

      if (scope === "personal") {
        setPersonalProgress((prev) => ({ ...prev, [key]: status }));
      } else {
        setGroupProgress((prev) => ({
          ...prev,
          [key]: { status, lastChangedBy: "me" },
        }));
      }

      try {
        const res = await fetch(`/api/pages/${activePageId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, surahNumber: sNum, ayahNumber: aNum, status }),
        });

        if (!res.ok) {
          if (scope === "personal") {
            setPersonalProgress((prev) => {
              const next = { ...prev };
              if (prevPersonal) next[key] = prevPersonal; else delete next[key];
              return next;
            });
          } else {
            setGroupProgress((prev) => {
              const next = { ...prev };
              if (prevGroup) next[key] = prevGroup; else delete next[key];
              return next;
            });
          }
        }
      } catch {
        if (scope === "personal") {
          setPersonalProgress((prev) => {
            const next = { ...prev };
            if (prevPersonal) next[key] = prevPersonal; else delete next[key];
            return next;
          });
        } else {
          setGroupProgress((prev) => {
            const next = { ...prev };
            if (prevGroup) next[key] = prevGroup; else delete next[key];
            return next;
          });
        }
      }
    },
    [activePageId, personalProgress, groupProgress]
  );

  // ── Shared pane builders ──────────────────────────────────────────────

  function renderModeA() {
    if (!page) return <NoPage />;
    return (
      <ModeAPage
        page={page}
        workspaceId={workspaceId}
        verses={verses}
        surahNumber={surahNumber}
        surahName={chapter.name_simple}
        pageId={activePageId}
        role={role}
        notes={notes}
        groupProgress={groupProgress}
        personalProgress={personalProgress}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        roomSocket={room.socket}
        onEditorReady={setActiveEditor}
        onOpenTafsir={openTafsir}
        onProgressChange={handleProgressChange}
        onNoteCreated={handleNoteCreated}
        onNoteUpdated={handleNoteUpdated}
        onNoteDeleted={handleNoteDeleted}
        onNoteSelect={handleNoteSelect}
      />
    );
  }

  function renderModeB() {
    if (!page) {
      return (
        <div className="mode-b-canvas mode-b-canvas--empty">
          <p className="mode-b-empty-msg">No page selected.</p>
        </div>
      );
    }
    // Rich containers on the canvas (and inside word/ayah annotation layers)
    // read verses / surah / onOpenTafsir from EditorContext — the same
    // provider Mode A and the whiteboard use.
    return (
      <EditorContextProvider value={editorCtx}>
        <ModeBPage
          verses={verses}
          pageId={activePageId}
          workspaceId={workspaceId}
          surahNumber={surahNumber}
          chapter={chapter}
          userPrefs={page.userPrefs}
          personalProgress={personalProgress}
          groupProgress={groupProgress}
          notes={notes}
          roomSocket={room.socket}
          onOpenTafsir={openTafsir}
          onNoteCreated={handleNoteCreated}
          onNoteUpdated={handleNoteUpdated}
          onNoteDeleted={handleNoteDeleted}
          onAyahSelect={handleAyahSelect}
          scrollToNoteId={selectedNoteId}
        />
      </EditorContextProvider>
    );
  }

  // ── Shared editor context for canvas surfaces ──────────────────────────
  // AyahBlockView / TafsirVersePicker (inside rich containers) read verses,
  // surah and onOpenTafsir from EditorContext — one provider serves the
  // Mushaf canvas, annotation layers, and the whiteboard alike.
  const whiteboardNotes = useMemo(
    () => notes.filter((n) => n.noteType === "textbox" && n.anchorType === "whiteboard"),
    [notes],
  );
  const editorCtx = useMemo(() => ({
    pageId: activePageId, workspaceId, surahNumber, verses, notes, role,
    personalProgress, groupProgress,
    onNoteCreated: handleNoteCreated, onNoteUpdated: handleNoteUpdated, onNoteDeleted: handleNoteDeleted,
    onProgressChange: handleProgressChange, onOpenTafsir: openTafsir,
  }), [
    activePageId, workspaceId, surahNumber, verses, notes, role, personalProgress, groupProgress,
    handleNoteCreated, handleNoteUpdated, handleNoteDeleted, handleProgressChange, openTafsir,
  ]);

  function renderWhiteboard() {
    if (!page) {
      return (
        <div className="mode-b-canvas mode-b-canvas--empty">
          <p className="mode-b-empty-msg">No page selected.</p>
        </div>
      );
    }
    return (
      <EditorContextProvider value={editorCtx}>
        <WhiteboardPage
          pageId={activePageId}
          notes={whiteboardNotes}
          roomSocket={room.socket}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onNoteCreated={handleNoteCreated}
          onNoteUpdated={handleNoteUpdated}
          onNoteDeleted={handleNoteDeleted}
        />
      </EditorContextProvider>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      className="workspace-page"
      data-theme={tweaks.theme}
      data-accent={tweaks.accent}
      data-density={tweaks.density}
      data-canvas={tweaks.canvasWidth}
      style={sidebarCollapsed
        ? { gridTemplateColumns: "var(--rail) 0px minmax(0, 1fr)" }
        : undefined}
    >
      <Rail activeWorkspaceId={workspaceId} />

      <WorkspaceSidebar
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        chapter={chapter}
        pages={pageList}
        activePageId={activePageId}
        groupProgress={groupProgress}
        personalProgress={personalProgress}
        role={role}
        canManagePages={canManagePages(role, workspace.membersCanManagePages)}
        onPageSelect={handlePageSelect}
        onPageRenamed={(id, title) =>
          setPageList((prev) => prev.map((p) => p.id === id ? { ...p, title } : p))
        }
        onPageDeleted={(id) =>
          setPageList((prev) => prev.filter((p) => p.id !== id))
        }
        onPageCreated={pageCreated}
        onPageCreateFailed={(tempId) =>
          setPageList((prev) => prev.filter((p) => p.id !== tempId))
        }
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <div className="canvas-area">
        {sidebarCollapsed && (
          <button
            className="sidebar-expand-btn"
            onClick={toggleSidebar}
            title="Expand sidebar"
          >
            <ChevronRight size={14} />
          </button>
        )}
        <TopBar
          workspaceId={workspaceId}
          surahNumber={surahNumber}
          workspaceName={workspace.name}
          chapter={chapter}
          activePageTitle={page?.title ?? null}
          activePageId={page ? activePageId : null}
          onExport={page ? handleExport : undefined}
        aiOpen={aiOpen}
          onToggleAi={() => setAiOpen((v) => !v)}
          mode={mode}
          onSetMode={setMode}
          progressLoading={progressLoading}
          tafsirOpen={tafsirOpen}
          onToggleTafsir={() => {
            if (!tafsirOpen && !tafsirVerseKey && verses[0]) {
              setTafsirVerseKey(verses[0].verse_key);
            }
            setTafsirOpen((o) => !o);
          }}
          formattingOpen={formattingOpen}
          onToggleFormatting={handleToggleFormatting}
          presenceOthers={presenceOthers}
          liveStatus={room.status}
        />
        <EditorToolbar editor={activeEditor} open={formattingOpen && mode !== "canvas" && mode !== "board"} />

        <div className={`study-layout${mode === "split" ? " study-layout--split" : ""}`}>

          {mode === "editor" && renderModeA()}

          {mode === "canvas" && renderModeB()}

          {mode === "board" && renderWhiteboard()}

          {/* Read — the sūrah in whichever hand the reader prefers. Separate
              from canvas because that one reproduces the Madīnah page line for
              line, which is what page-anchored annotation depends on; here the
              line breaks are not load-bearing. */}
          {mode === "read" && (
            <div className="doc-wrap">
              <ScriptView surah={surahNumber} onVerseClick={openTafsir} />
            </div>
          )}

          {mode === "split" && (
            <>
              {/* Mode A pane — left */}
              <div className="split-pane split-pane--a">
                {renderModeA()}
              </div>

              {/* Resize handle */}
              <div className="split-divider" aria-hidden="true" />

              {/* Mode B pane — right */}
              <div className="split-pane split-pane--b">
                {renderModeB()}
              </div>
            </>
          )}

          {/* The assistant, docked beside whatever mode is showing. Inside the
              layout rather than over it, so it takes width from the content
              instead of covering the passage you are asking about. */}
          {aiOpen && (
            <AiPanel
              workspaceId={workspaceId}
              pageId={page ? activePageId : null}
              surahNumber={surahNumber}
              surahName={chapter.name_simple}
              /* Absent when there is no editor to add to — the canvas and
                 board modes have no document — so the panel hides the
                 control rather than offering one that cannot work. */
              onAddToEditor={activeEditor ? addAnswerToEditor : undefined}
              /* The board always exists for a page, so unlike the editor this
                 is offered in every mode. */
              onAddToBoard={page ? addAnswerToBoard : undefined}
              onClose={() => setAiOpen(false)}
            />
          )}

          {/* Tafsir drawer — available in all modes */}
          <TafsirDrawer
            open={tafsirOpen}
            verseKey={tafsirVerseKey}
            verses={verses}
            onClose={() => setTafsirOpen(false)}
          />
        </div>
      </div>

      {showTweaks && (
        <TweaksPanel
          state={tweaks}
          onChange={patchTweaks}
          onClose={() => setShowTweaks(false)}
        />
      )}
      <TourBubble />
    </div>
  );
}

// ── Fallback ──────────────────────────────────────────────────────────────

function NoPage() {
  return (
    <div className="doc-wrap">
      <div className="doc">
        <div className="placeholder-notice" style={{ marginTop: 64 }}>
          <div className="placeholder-notice-icon">⚠</div>
          <div>
            <div className="placeholder-notice-title">Page not found</div>
            <div className="placeholder-notice-body">
              This page may have been archived or you may not have permission
              to view it. Choose another page from the sidebar.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
