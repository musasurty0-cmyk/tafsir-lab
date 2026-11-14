"use client";

/**
 * PageEditor — TipTap collaborative editor for Mode A.
 *
 * Extensions:
 *   StarterKit, Placeholder, Underline, Highlight, Color, TextStyle
 *   AyahBlockExtension, TafsirBlockExtension, SlashCommandExtension
 *   Collaboration       — Yjs CRDT, synced via y-partyserver's YProvider
 *   CollaborationCursor — live named cursors for each peer
 *
 * Content persistence:
 *   Yjs is the authoritative source during an active session.
 *   A debounced snapshot is saved to the DB every ~900 ms so the
 *   REST API stays current for page-reload / offline fallback.
 *
 * Cursor overlays:
 *   TipTap's CollaborationCursor extension renders peer carets natively
 *   inside the editor DOM.  The manual polling + overlay approach is
 *   replaced entirely.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { baseExtensions } from "./sharedExtensions";
import { useConnectionLink } from "./useConnectionLink";
import { StaticDoc, docIsEmpty } from "@/lib/prosemirror-static";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { yXmlFragmentToProseMirrorRootNode, yUndoPluginKey } from "y-prosemirror";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";

import { PARTYKIT_HOST } from "@/lib/collab/config";
import { linkDocs, RELAY } from "@/lib/collab/link-docs";
import { makeMarker, markerOf, mergeOffline, withoutMarker, type OfflineMarker } from "./offlineMerge";
import { BlockMove } from "./BlockMove";
import BlockHandle from "./BlockHandle";
import EditorInkLayer from "./EditorInkLayer";
import FreeTextBox, { CARET_OFFSET, TEXTBOX_DEFAULT_WIDTH, zoomAt } from "../FreeTextBox";
import type { NoteData } from "../NoteCard";
import {
  SlashCommandExtension,
  buildCommands,
  filterCommands,
  ayahBlockNode,
  type SlashCommandItem,
} from "./SlashCommand";
import CommandList, { type CommandListHandle } from "./CommandList";
import { getUserColor } from "./RemoteCursorsExtension";
import SelectionToolbar from "./SelectionToolbar";
import SlashHelp from "./SlashHelp";
import { useEditorCtxOptional } from "./EditorContext";
import TafsirVersePicker from "./TafsirVersePicker";
import QuranSearch from "./QuranSearch";
import { parseReference, parseRange, type SearchTarget } from "@/lib/quran-search";
import { getCollabToken } from "@/lib/collab/collab-token";
import { isLive, onLiveChange } from "@/lib/collab/liveness";

// ── Constants ──────────────────────────────────────────────────────────────

const SAVE_DEBOUNCE_MS = 900;

/* How long the editor waits for the room before opening an offline copy.
   A healthy room answers in about a second; past this, waiting longer only
   keeps someone from writing. */
const OFFLINE_AFTER_MS = 5000;

/** pending: waiting for the room, read-only. live: linked to the room.
    offline: the room never answered; editing a local copy of the snapshot. */
type SyncPhase = "pending" | "live" | "offline";

/** Lines typed while the editor was waiting, as the paragraphs they become.
    They go where the caret would have been: the end of the page, filling its
    trailing empty line if it has one. */
function insertTyped(editor: Editor, typed: string) {
  const paras = typed.split("\n").map((line) =>
    line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" });
  const { doc } = editor.state;
  const end  = doc.content.size;
  const last = doc.lastChild;
  const from = last && last.type.name === "paragraph" && last.content.size === 0 ? end - last.nodeSize : end;
  editor.chain().insertContentAt({ from, to: end }, paras).focus("end").run();
}

/** The snapshot minus a trailing empty line, for showing typed text after it. */
function withoutTrailingBlank(content: unknown): unknown {
  const doc = content as { content?: { type?: string; content?: unknown[] }[] } | null;
  const blocks = doc?.content;
  if (!blocks?.length) return content;
  const last = blocks[blocks.length - 1];
  return last?.type === "paragraph" && !last.content?.length ? { ...doc, content: blocks.slice(0, -1) } : content;
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  pageId:           string;
  workspaceId:      string;
  /** Display name of the surah being studied, for Connection endpoints. */
  surahName?:       string;
  initialContent:   unknown;
  currentUserId:    string;
  currentUserName:  string;
  roomSocket?:      import("partysocket").default | null;
  onEditorReady?:   (editor: Editor | null) => void;
  /** Freeform movable text containers (notes with anchorType "editor") */
  textBoxNotes?:    NoteData[];
  onNoteCreated?:   (note: NoteData) => void;
  onNoteUpdated?:   (note: NoteData) => void;
  onNoteDeleted?:   (noteId: string) => void;
}

interface PaletteState {
  items:   SlashCommandItem[];
  query:   string;
  rect:    DOMRect;
  props:   SuggestionProps;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function PageEditor({
  pageId,
  workspaceId,
  surahName,
  initialContent,
  currentUserId,
  currentUserName,
  roomSocket,
  onEditorReady,
  textBoxNotes = [],
  onNoteCreated,
  onNoteUpdated,
  onNoteDeleted,
}: Props) {
  const [palette, setPalette] = useState<PaletteState | null>(null);
  const commandListRef        = useRef<CommandListHandle>(null);
  const ALL_COMMANDS          = useRef(buildCommands());
  const saveTimer             = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Surah being studied + verses on this page (for the tafsir verse picker)
  /* `||`, not `??`: a blank board studies no surah and reports the sentinel 0,
     which is not a surah the picker can offer āyāt from — it would build keys
     like "0:5". Falling back to 1 there matches what FreeTextBox already does
     on the same board. */
  const ectx        = useEditorCtxOptional();
  const studySurah  = ectx?.surahNumber || 1;
  const pageVerses  = ectx?.verses ?? [];

  // Tafsir verse picker: opened when a tafsir command is chosen WITHOUT a
  // verse key, so the user picks the āyah within the surah they're studying.
  /* Open when /ayah is used without an explicit reference. Previously that
     case silently inserted 1:1, so the command only worked if you already
     knew the verse number — the thing the search exists to remove. */
  const [ayahSearch, setAyahSearch] = useState<{
    range: { from: number; to: number };
    rect:  DOMRect;
  } | null>(null);

  const [tafsirChoice, setTafsirChoice] = useState<{
    verseKey: string;
    range: { from: number; to: number };
    rect: DOMRect;
    slug: string;
    sourceName: string;
  } | null>(null);
  const [versePicker, setVersePicker] = useState<{
    slug: string; sourceName: string; range: { from: number; to: number }; rect: DOMRect;
  } | null>(null);

  // ── Main document = the page's default container ───────────────────────
  // Same structure as the square containers: a top drag bar moves it; the
  // offset persists per page (client-side, localStorage).
  const [docOffset, setDocOffset] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    try {
      const raw = localStorage.getItem(`tl-doc-offset:${pageId}`);
      if (raw) return JSON.parse(raw) as { x: number; y: number };
    } catch { /* ignore */ }
    return { x: 0, y: 0 };
  });
  const docDragRef = useRef<{ mx: number; my: number; x: number; y: number } | null>(null);

  function onDocBarDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    docDragRef.current = { mx: e.clientX, my: e.clientY, x: docOffset.x, y: docOffset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDocBarMove(e: React.PointerEvent) {
    const d = docDragRef.current;
    if (!d) return;
    setDocOffset({ x: d.x + (e.clientX - d.mx), y: Math.max(0, d.y + (e.clientY - d.my)) });
  }
  function onDocBarUp() {
    if (!docDragRef.current) return;
    docDragRef.current = null;
    setDocOffset((cur) => {
      try { localStorage.setItem(`tl-doc-offset:${pageId}`, JSON.stringify(cur)); } catch { /* ignore */ }
      return cur;
    });
  }

  // ── Freeform text containers — OneNote model ──────────────────────────
  // Click empty canvas → a TEMP note renders synchronously in the same
  // gesture as a REAL FreeTextBox (top bar, drag, resize, "/" palette,
  // /ayah — everything, from frame one). It stays local until first blur
  // with content, when persistTemp creates the server note and swaps it in
  // under a STABLE React key (no remount, no flicker). An empty temp just
  // evaporates; nothing ever hits the server for stray clicks.
  const pageEditorRef = useRef<HTMLDivElement>(null);
  const [freshBoxId, setFreshBoxId] = useState<string | null>(null);
  // serverId → tempId: keeps the React key stable across the temp→server swap
  const keyAliasRef = useRef<Map<string, string>>(new Map());
  const paletteOpenRef = useRef(false);
  useEffect(() => { paletteOpenRef.current = palette !== null; }, [palette]);

  const createTempAt = useCallback((x: number, y: number) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const temp: NoteData = {
      id: tempId,
      noteType: "textbox",
      anchorType: "editor",
      surahNumber: null, ayahNumber: null, wordPosition: null,
      content: { type: "doc", content: [{ type: "paragraph" }] },
      color: null,
      offsetX: Math.round(x - CARET_OFFSET.x), offsetY: Math.round(y - CARET_OFFSET.y), // the caret, not the corner, at the click
      width: TEXTBOX_DEFAULT_WIDTH, height: null,
      isMinimized: false, zIndex: 1, isAdmin: false,
      createdAt: new Date().toISOString(),
      author: { id: currentUserId, name: currentUserName, avatarUrl: null },
    };
    onNoteCreated?.(temp);
    setFreshBoxId(tempId);
  }, [currentUserId, currentUserName, onNoteCreated]);

  const persistTemp = useCallback((tempId: string, content: object, at: { x: number; y: number }) => {
    const persist = () =>
      fetch(`/api/pages/${pageId}/notes`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          noteType:   "textbox",
          anchorType: "editor",           // editor-surface container (content space)
          content,                        // TipTap doc JSON straight from the box
          offsetX:    Math.round(at.x),
          offsetY:    Math.round(at.y),
          width:      TEXTBOX_DEFAULT_WIDTH,
        }),
      }).then((r) => (r.ok ? r.json() : null));

    const swap = (d: { note?: NoteData } | null) => {
      if (!d?.note) return false;
      keyAliasRef.current.set(d.note.id, tempId); // stable key → no remount
      onNoteDeleted?.(tempId);
      onNoteCreated?.(d.note);
      return true;
    };

    persist()
      .then((d: { note?: NoteData } | null) => {
        if (!swap(d)) {
          setTimeout(() => { persist().then(swap).catch(() => {}); }, 3000); // one retry
        }
      })
      .catch(() => { /* temp stays visible */ });
  }, [pageId, onNoteCreated, onNoteDeleted]);

  // Click surface: the editor's own empty space PLUS the document margins
  // (.doc / .doc-wrap padding), so "anywhere on the page" really means
  // anywhere — coordinates are stored relative to the editor container.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const pe = pageEditorRef.current;
      if (!pe || paletteOpenRef.current) return;
      const t = e.target as HTMLElement;
      const isCanvasSpace =
        t === pe ||
        t.classList.contains("doc") ||
        t.classList.contains("doc-wrap");
      if (!isCanvasSpace) return;
      /* The box is placed in the page's own units. With the page zoomed (CSS
         zoom: 80%, 115%…) screen pixels are not those units, so an unscaled
         offset put the box short of — or past — the click. */
      const r = pe.getBoundingClientRect();
      const z = zoomAt(pe);
      createTempAt((e.clientX - r.left) / z, (e.clientY - r.top) / z);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [createTempAt]);

  // ── Open canvas past the furthest box (the OneNote model) ──────────────
  /* The page used to end exactly at the edge of its furthest text box. A box
     at the right could not be given a neighbour, and one placed at the edge
     of the screen had nowhere further to go. Like OneNote, the page now always
     reaches past whatever is on it: half a screen beyond the furthest box,
     rightward and downward, recomputed as boxes are placed, dragged, widened,
     or grow while typing. It never shrinks under the view, so moving a box
     back does not yank away the part of the page you are looking at.
     The extent is an invisible marker, not a width on the page: widening
     .page-editor would also widen the main text column. */
  const [extent, setExtent] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const pe = pageEditorRef.current;
    if (!pe) return;
    const PARTS = ":scope > .free-textbox, :scope > .main-doc-container";
    let raf = 0;
    const measure = () => {
      raf = 0;
      const wrap = pe.closest(".doc-wrap") as HTMLElement | null;
      const z = zoomAt(pe), pr = pe.getBoundingClientRect();
      let right = 0, bottom = 0;
      pe.querySelectorAll<HTMLElement>(PARTS).forEach((el) => {
        const r = el.getBoundingClientRect();
        right = Math.max(right, (r.right - pr.left) / z);
        bottom = Math.max(bottom, (r.bottom - pr.top) / z);
      });
      const vw = (wrap?.clientWidth ?? 1200) / z, vh = (wrap?.clientHeight ?? 800) / z;
      let w = right + Math.max(480, vw * 0.5), h = bottom + Math.max(360, vh * 0.5);
      if (wrap) {
        const wr = wrap.getBoundingClientRect();
        w = Math.max(w, (wr.right - pr.left) / z);
        h = Math.max(h, (wr.bottom - pr.top) / z);
      }
      w = Math.ceil(w); h = Math.ceil(h);
      setExtent((cur) => (cur && Math.abs(cur.w - w) < 8 && Math.abs(cur.h - h) < 8 ? cur : { w, h }));
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    // Sizes come from a ResizeObserver; positions from the boxes themselves.
    const ro = new ResizeObserver(schedule);
    const observeAll = () => { ro.disconnect(); pe.querySelectorAll(PARTS).forEach((el) => ro.observe(el)); };
    const mo = new MutationObserver(() => { observeAll(); schedule(); });
    observeAll();
    mo.observe(pe, { childList: true });
    pe.addEventListener("tl:box-geometry", schedule);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      ro.disconnect(); mo.disconnect();
      pe.removeEventListener("tl:box-geometry", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  // The main container moves by transform, which no observer sees either.
  useEffect(() => {
    pageEditorRef.current?.dispatchEvent(new CustomEvent("tl:box-geometry"));
  }, [docOffset.x, docOffset.y]);

  // ── Yjs document + PartyKit provider ─────────────────────────────────
  // Created synchronously on first render so the Collaboration and
  // CollaborationCursor extensions receive a real document + provider at
  // configuration time (an effect would run too late).  The component is
  // keyed by pageId in ModeAPage, so one instance = one room for its
  // whole lifetime.
  //
  // Two documents (lib/collab/link-docs): the editor writes to `ydoc`, the
  // provider syncs `roomDoc`, and the two are linked only once the room has
  // answered. Until then the editor is read-only and the stored snapshot is
  // painted in its place, so the page is never blank while the socket
  // connects and nothing typed early can merge into the room out of order.
  const collabRef  = useRef<{ ydoc: Y.Doc; roomDoc: Y.Doc; provider: YProvider } | null>(null);
  const [phase, setPhase] = useState<SyncPhase>("pending");
  const phaseRef   = useRef<SyncPhase>("pending");
  const unlinkRef  = useRef<(() => void) | null>(null);
  const mountedRef = useRef(false);

  if (!collabRef.current) {
    const ydoc    = new Y.Doc();
    const roomDoc = new Y.Doc();
    /* One client id for both, so the room's awareness entry for this tab is
       the editor's own caret (the cursor plugin compares against ydoc). Only
       ydoc ever authors anything. */
    roomDoc.clientID = ydoc.clientID;
    collabRef.current = {
      ydoc,
      roomDoc,
      provider: new YProvider(PARTYKIT_HOST, pageId, roomDoc, {
        connect: true,
        /* The realtime server rejects any socket without a valid, page-scoped
           token (party/server.ts gate). params is called on every
           (re)connect, so we mint a fresh 2-minute token each time from the
           membership-gated endpoint, via the shared per-page cache so the
           editor and the room socket do not each mint their own. On failure
           an empty token is sent, which the server denies — correct: no
           membership, no realtime. */
        params: async () => ({ token: await getCollabToken(pageId) }),
      }),
    };
  }
  const { ydoc, roomDoc, provider } = collabRef.current;

  // Connection lifecycle. Survives React Strict Mode's dev double-mount:
  // cleanup only disconnects; the delayed destroy is skipped if the same
  // instance re-mounted in the meantime.
  useEffect(() => {
    mountedRef.current = true;
    if (isLive()) provider.connect();

    // Reconnect the Yjs socket promptly when an iPad tab is un-suspended —
    // otherwise the student writes into a disconnected doc until the
    // library's backoff timer fires.
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !isLive()) return;
      const p = provider as unknown as { wsconnected?: boolean; connect: () => void };
      if (p.wsconnected === false) {
        try { p.connect(); } catch { /* already connecting */ }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    /* Nobody at the tab: let the room go (lib/collab/liveness). Local edits
       are kept by the provider and sent when it reconnects. */
    const stopLive = onLiveChange((live) => {
      if (!mountedRef.current) return;
      if (live) { try { provider.connect(); } catch { /* already connecting */ } }
      else provider.disconnect();
    });

    return () => {
      stopLive();
      document.removeEventListener("visibilitychange", onVisible);
      mountedRef.current = false;
      provider.disconnect();
      setTimeout(() => {
        if (mountedRef.current) return;
        provider.destroy();
        unlinkRef.current?.();
        unlinkRef.current = null;
      }, 1000);
    };
  }, [provider]);

  // ── Heal a silently-dropped Yjs connection ─────────────────────────────
  // The Yjs socket can die without firing "close" (half-open connection);
  // it then quietly stops syncing until a manual refresh. The app socket
  // (roomSocket) has a heartbeat that reliably detects this, so when it
  // reconnects we force the Yjs provider to reconnect too — a fresh y-sync
  // reconciles the full document. An interval is a belt-and-braces fallback.
  useEffect(() => {
    const p = provider as unknown as { wsconnected?: boolean; connect: () => void; disconnect: () => void };

    let firstOpen = true;
    const onSockOpen = () => {
      if (firstOpen) { firstOpen = false; return; } // ignore the initial connect
      if (!isLive()) return;
      try { p.disconnect(); } catch { /* ignore */ }
      try { p.connect(); }    catch { /* ignore */ }
    };
    roomSocket?.addEventListener("open", onSockOpen);

    const iv = setInterval(() => {
      if (document.visibilityState !== "visible" || !isLive()) return;
      if (p.wsconnected === false) { try { p.connect(); } catch { /* ignore */ } }
    }, 20000);

    return () => {
      roomSocket?.removeEventListener("open", onSockOpen);
      clearInterval(iv);
    };
  }, [provider, roomSocket]);

  // ── Save helper ───────────────────────────────────────────────────────

  /* Set while editing an offline copy: the base it started from, saved with
     every snapshot so the copy is merged into the room even if this tab is
     closed before the server comes back (see offlineMerge). */
  const offlineMarkerRef = useRef<OfflineMarker | null>(null);
  const snapshotBody = useCallback((editor: Editor) => {
    const doc = editor.getJSON();
    const offline = offlineMarkerRef.current;
    return JSON.stringify({ tiptapContent: offline ? { ...doc, offline } : doc });
  }, []);

  const scheduleSave = useCallback(
    (editor: Editor) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch(`/api/pages/${pageId}/content`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    snapshotBody(editor),
        }).catch(() => {});
      }, SAVE_DEBOUNCE_MS);
    },
    [pageId, snapshotBody],
  );

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // ── TipTap editor ─────────────────────────────────────────────────────

  const editor = useEditor({
    extensions: [
      /* The shared set. history OFF — Collaboration brings Yjs undo, and two
         undo stacks mean one command can be applied twice. */
      ...baseExtensions({
        history:     false,
        dropcursor:  true,
        workspaceId,
        placeholder: ({ node }: { node: { type: { name: string } } }) =>
          node.type.name === "heading" ? "Heading…" : "Type '/' for commands, or start writing…",
      }),

      /* Main-editor only, each for a reason. Tables are a document affordance
         a floating box does not need; block-drag needs a document to reorder
         within; Yjs is the page's own realtime session. */
      Table.configure({ resizable: true, lastColumnResizable: true, allowTableNodeSelection: true }),
      TableRow,
      TableHeader,
      TableCell,

      // Alt+↑/↓ walks the current block up or down the page.
      BlockMove,

      // ── Collaboration (Yjs CRDT) ──────────────────────────────────────
      Collaboration.configure({
        document: ydoc,
      }),

      // ── Collaboration cursors ─────────────────────────────────────────
      CollaborationCursor.configure({
        provider,
        user: {
          name:  currentUserName || "Anonymous",
          color: getUserColor(currentUserId),
        },
        // Custom caret: the name label auto-fades once the peer stops moving.
        // render() is only called when that peer's awareness changes (they
        // move or type), so an idle cursor keeps its faded-out label. This
        // stops a stranded "{name}" tag from hovering over text YOU are
        // editing just because their cursor happens to sit there.
        render: (user: { name?: string; color?: string }) => {
          const caret = document.createElement("span");
          caret.classList.add("collaboration-cursor__caret");
          caret.setAttribute("style", `border-color: ${user.color}`);

          const label = document.createElement("div");
          label.classList.add("collaboration-cursor__label");
          label.setAttribute("style", `background-color: ${user.color}`);
          label.textContent = user.name ?? "";

          caret.appendChild(label);
          return caret;
        },
      }),

      SlashCommandExtension.configure({
        suggestion: {
          char:        "/",
          allowSpaces: true,
          items({ query }: { query: string }) {
            return filterCommands(ALL_COMMANDS.current, query);
          },
          render() {
            return {
              onStart(props: SuggestionProps) {
                if (!props.clientRect) return;
                setPalette({ items: props.items as SlashCommandItem[], query: props.query, rect: props.clientRect() as DOMRect, props });
              },
              onUpdate(props: SuggestionProps) {
                if (!props.clientRect) return;
                setPalette({ items: props.items as SlashCommandItem[], query: props.query, rect: props.clientRect() as DOMRect, props });
              },
              onKeyDown({ event }: SuggestionKeyDownProps) {
                if (event.key === "Escape") { setPalette(null); return true; }
                return commandListRef.current?.onKeyDown(event) ?? false;
              },
              onExit() { setPalette(null); },
            };
          },
          command({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: unknown }) {
            const item  = props as SlashCommandItem & { _query: string };
            item._query = item._query ?? "";
            item.execute(editor, range, item._query);
          },
        },
      }),
    ],

    // NO `content` option here. With the Collaboration extension, passing
    // content would inject it into the Yjs doc on EVERY mount — before the
    // provider has synced — duplicating the document each load.  Seeding
    // from DB content happens once, after first sync, in the effect below.
    //
    // No `autofocus` either: the editor is read-only until then, and the
    // effect below puts the caret at the end when it opens.

    immediatelyRender: false,

    onUpdate({ editor }) {
      scheduleSave(editor);
    },

    editorProps: {
      /* Read-only until the first sync (or the offline fallback). A view prop
         rather than TipTap's `editable` option, which useEditor re-applies
         from its options on a re-mount and would lock the editor again. */
      editable: () => phaseRef.current !== "pending",
      attributes: { class: "page-editor-content", spellcheck: "true" },
      // Keep the caret visible above the iPad on-screen keyboard: ProseMirror
      // auto-scrolls the selection into view with this margin whenever it
      // comes within the threshold of the (visual) viewport edge.
      scrollThreshold: 80,
      scrollMargin:    160,
    },
  });

  /* /link, from the shared hook. Both surfaces run the same four-step flow and
     the same rules — self-connection refused at choose time, a 409 offering the
     existing Connection, a card that fails to insert never losing the saved
     work. Two copies of that meant two copies of every rule inside it. */
  const { openLink, linkUI } = useConnectionLink({ editor, workspaceId, currentSurah: studySurah });

  // ── First sync: link to the room and seed it, or open offline ─────────
  //
  // Typing into a page before its room had synced used to scramble it: the
  // typed lines were Yjs history in an empty doc, and the seed (or the room's
  // own content) then merged around them by client id. Typed lines landed in
  // the heading, or the seed was skipped because the doc no longer looked
  // empty and the starter text was lost from the page AND the snapshot.
  //
  // Now the editor opens only once the room has answered:
  //   • first sync   → link the docs; seed the room from the snapshot ONLY if
  //                    it is empty (seeding a non-empty room is what used to
  //                    duplicate pages on reload); open for editing.
  //   • no answer in OFFLINE_AFTER_MS → open an offline copy of the snapshot
  //                    in the editor's own doc, never linked, saved by PATCH.
  //   • sync after that → reconcile the copy with the room by content
  //                    (offlineMerge), adopt the room's history, then link.
  // Keys pressed while waiting are kept and typed in when the editor opens.
  const seededRef        = useRef(false);
  const pendingTypingRef = useRef("");
  const [pendingTyping, setPendingTyping] = useState("");
  const startContent = useMemo(() => withoutMarker(initialContent), [initialContent]);

  useEffect(() => {
    if (!editor) return;
    const ed       = editor;
    const fragment = ydoc.getXmlFragment("default");
    const roomFrag = () => roomDoc.getXmlFragment("default");
    const startMarker = markerOf(initialContent);

    function clearUndo() {
      /* Seeding and reconciling go through the editor, so Ctrl+Z would undo
         them: the first undo on a page emptied it. */
      const s = yUndoPluginKey.getState(ed.state) as { undoManager?: { clear(): void } } | undefined;
      s?.undoManager?.clear();
    }

    function open(next: SyncPhase) {
      seededRef.current = true;
      phaseRef.current  = next;
      clearUndo();
      ed.setEditable(true, false);   // re-reads the editable prop
      setPhase(next);
      const typed = pendingTypingRef.current;
      pendingTypingRef.current = "";
      setPendingTyping("");
      if (typed) insertTyped(ed, typed);
      else if (!document.activeElement || document.activeElement === document.body) ed.commands.focus("end");
    }

    function goLive() {
      unlinkRef.current = linkDocs(ydoc, roomDoc);
      if (fragment.length === 0) {
        // An empty room: a new page, one made before live collab, or storage cleared.
        if (startContent) ed.commands.setContent(startContent as object);
      } else if (startMarker) {
        // The snapshot was saved from an offline copy the room has not seen.
        const merged = mergeOffline(ed.schema, startMarker, startContent,
          yXmlFragmentToProseMirrorRootNode(fragment, ed.schema));
        if (merged) ed.commands.setContent(merged);
      }
      open("live");
      if (startMarker) scheduleSave(ed);   // saves without the marker
    }

    function goOffline() {
      offlineMarkerRef.current = startMarker ?? makeMarker(ed.schema, startContent);
      // Into the editor's own doc only: it is never linked to the room as is.
      if (startContent) ed.commands.setContent(startContent as object);
      open("offline");
    }

    function recover() {
      const base = offlineMarkerRef.current ?? makeMarker(ed.schema, startContent);
      if (roomFrag().length === 0) {
        // Nobody has written to this room: the offline copy becomes it.
        unlinkRef.current = linkDocs(ydoc, roomDoc);
      } else {
        const merged = mergeOffline(ed.schema, base, ed.getJSON(),
          yXmlFragmentToProseMirrorRootNode(roomFrag(), ed.schema));
        const { from, to } = ed.state.selection;
        /* Take the room's history in place of the copy's. The copy's items
           become deletions, which the link carries to the room as well, so a
           later edit next to one of them is never left waiting for it. */
        ydoc.transact(() => fragment.delete(0, fragment.length), RELAY);
        unlinkRef.current = linkDocs(ydoc, roomDoc);
        if (merged) ed.commands.setContent(merged);
        const max = ed.state.doc.content.size;
        try { ed.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) }); } catch { /* ignore */ }
      }
      offlineMarkerRef.current = null;
      phaseRef.current = "live";
      setPhase("live");
      clearUndo();
      scheduleSave(ed);
    }

    const onSynced = (ok: boolean) => {
      if (!ok || unlinkRef.current || ed.isDestroyed) return;
      if (phaseRef.current === "pending") goLive();
      else if (phaseRef.current === "offline") recover();
    };
    provider.on("synced", onSynced);
    if (provider.synced) onSynced(true);

    const timer = setTimeout(() => {
      if (phaseRef.current === "pending" && !ed.isDestroyed) goOffline();
    }, OFFLINE_AFTER_MS);

    return () => {
      provider.off("synced", onSynced);
      clearTimeout(timer);
    };
  // initialContent is stable for the lifetime of this mount (keyed by pageId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, provider]);

  /* Keys pressed while the editor waits. It is read-only then, so they would
     otherwise vanish; they show at the end of the stand-in and are typed in
     when it opens. Only plain typing with nothing else focused. */
  useEffect(() => {
    if (phase !== "pending") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement;
      if (active && active !== document.body && !active.closest(".main-doc-container")) return;
      let next = pendingTypingRef.current;
      if (e.key === "Enter") next += "\n";
      else if (e.key === "Backspace" && next) next = next.slice(0, -1);
      else if (e.key.length === 1) next += e.key;
      else return;
      e.preventDefault();
      pendingTypingRef.current = next;
      setPendingTyping(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // ── Flush on close ───────────────────────────────────────────────────
  // The DB snapshot trails the live document by the save debounce. When the
  // tab is hidden or closed inside that window, send what is waiting instead
  // of dropping it. Only once the document has synced: before that the
  // editor may hold a partial doc, which must never overwrite the snapshot.
  useEffect(() => {
    if (!editor) return;
    const flush = () => {
      if (!saveTimer.current || !seededRef.current || editor.isDestroyed) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const body = snapshotBody(editor);
      fetch(`/api/pages/${pageId}/content`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: body.length < 60_000,
      }).catch(() => {});
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [editor, pageId, snapshotBody]);

  // ── Expose editor to parent ────────────────────────────────────────────

  const onEditorReadyRef = useRef(onEditorReady);
  useEffect(() => { onEditorReadyRef.current = onEditorReady; }, [onEditorReady]);
  useEffect(() => {
    onEditorReadyRef.current?.(editor);
    return () => { onEditorReadyRef.current?.(null); };
  }, [editor]);

  // ── Tablet ergonomics for the slash palette ───────────────────────────

  // Reposition the palette when the on-screen keyboard opens/closes.
  // visualViewport shrinks when the iPad keyboard slides up; without this
  // the palette can end up hidden behind the keyboard.
  const [, setViewportTick] = useState(0);
  useEffect(() => {
    if (!palette) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const bump = () => setViewportTick((t) => t + 1);
    vv.addEventListener("resize", bump);
    vv.addEventListener("scroll", bump);
    return () => {
      vv.removeEventListener("resize", bump);
      vv.removeEventListener("scroll", bump);
    };
  }, [palette]);

  // Tap-outside dismiss — a light stylus tap elsewhere must close the
  // palette even when it doesn't move the text cursor out of the
  // suggestion range.
  useEffect(() => {
    if (!palette) return;
    function onDown(e: PointerEvent) {
      const anchor = document.querySelector(".slash-palette-anchor");
      if (anchor && !anchor.contains(e.target as Node)) setPalette(null);
    }
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [palette]);


  // ── Palette item selection ────────────────────────────────────────────

  const handleSelect = useCallback(
    (item: SlashCommandItem) => {
      if (!palette) return;
      const q = palette.query;

      // Tafsir command with NO explicit verse key → open the verse picker
      // (defaults to the surah being studied). "/tabari 23:2" inserts directly.
      if (item.isTafsir && !/\d{1,3}:\d{1,3}/.test(q)) {
        let slug = item.tafsirSlug;
        if (!slug) {
          try { slug = localStorage.getItem("tl-tafsir-source") || "ibn-kathir-en"; }
          catch { slug = "ibn-kathir-en"; }
        }
        const range = (palette.props as unknown as { range: { from: number; to: number } }).range;
        setVersePicker({ slug, sourceName: item.tafsirSourceName ?? "Tafsīr", range, rect: palette.rect });
        setPalette(null);
        return;
      }

      /* /link needs the editor's source context and an async target search,
         so it is intercepted here rather than executed. */
      if (item.id === "link") {
        const range = (palette.props as unknown as { range: { from: number; to: number } }).range;
        /* Ask for the SOURCE first. This used to seed the whole current Surah
           and jump straight to the target, so a Connection silently recorded
           "Surah N" as its origin unless the author noticed and repicked it —
           a Connection whose source nobody chose is not a munāsaba anyone
           asserted. The picker searches āyāt, Selections and Surahs, and
           carries the current Surah, so typing a bare number resolves inside
           it; picking the whole Surah is still one keystroke away. */
        openLink(range, palette.rect);
        setPalette(null);
        return;
      }

      // /ayah with no usable reference or run → search instead of guessing 1:1.
      const arg = q.replace(/^\S+\s*/, "");
      if (item.id === "ayah" && !parseReference(arg) && !parseRange(arg)) {
        const range = (palette.props as unknown as { range: { from: number; to: number } }).range;
        setAyahSearch({ range, rect: palette.rect });
        setPalette(null);
        return;
      }

      (item as SlashCommandItem & { _query: string })._query = q;
      palette.props.command({ ...(item as object) });
      setPalette(null);
    },
    [palette],
  );

  /** Insert the chosen verse — or run of verses — using the EXISTING ayah
   *  block: the search changes how a verse is found, never how it is embedded. */
  const insertAyahTarget = useCallback((t: SearchTarget) => {
    if (!editor || !ayahSearch) return;
    // Close FIRST, so the panel cannot outlive the transaction if inserting
    // throws, and unmount before focus moves back into the document.
    setAyahSearch(null);
    editor.chain().focus()
      // deleteRange removes the leftover "/ayah …" text the command was typed
      // into; without it the slash text stays behind the inserted block.
      .deleteRange(ayahSearch.range)
      .insertContent([
        ayahBlockNode(t.surah ?? 1, t.ayah ?? 1, t.ayahEnd),
        // Trailing paragraph gives the caret somewhere to land after an atom
        // block, so focus returns to editable text rather than being trapped.
        { type: "paragraph" },
      ])
      .focus()
      .scrollIntoView()
      .run();
   
  }, [editor, ayahSearch]);

  /* Backing out of a picker (Escape, Cancel) takes the "/ayah …" it was opened
     from with it and puts the caret back where it was. Without this the
     command stayed in the note as text, and focus was left on the page, so
     everything typed next went nowhere. /link already worked this way. */
  const cancelPicker = useCallback((range: { from: number; to: number }, close: () => void) => {
    close();
    if (editor && !editor.isDestroyed) editor.chain().focus().deleteRange(range).run();
  }, [editor]);

  /* The āyah panel is a portal, so nothing unmounts it implicitly. /link's
     equivalent now lives inside useConnectionLink, with the state it resets. */
  useEffect(() => () => setAyahSearch(null), []);
  useEffect(() => { setAyahSearch(null); }, [pageId]);
  useEffect(() => {
    if (!editor || !ayahSearch) return;
    const close = () => setAyahSearch(null);
    // A destroyed editor can never receive the insertion.
    editor.on("destroy", close);
    return () => { editor.off("destroy", close); };
  }, [editor, ayahSearch]);

  /* After the verse is chosen, ask HOW much to embed rather than assuming the
     whole entry. A full tafsīr on a long āyah can be several screens, which
     swamps the note it was meant to support — but sometimes the whole thing is
     exactly what is wanted, so neither option is the default. */
  const insertTafsirVerse = useCallback((verseKey: string) => {
    if (!editor || !versePicker) return;
    setTafsirChoice({ verseKey, ...versePicker });
    setVersePicker(null);
   
  }, [editor, versePicker]);

  /** Embed the whole entry — the block fetches it from the empty contentHtml. */
  const embedWholeTafsir = useCallback(() => {
    if (!editor || !tafsirChoice) return;
    const { range, slug, sourceName, verseKey } = tafsirChoice;
    editor.chain().focus().deleteRange(range).insertContent([
      { type: "tafsirBlock", attrs: { verseKey, contentHtml: "", sourceName, sourceSlug: slug } },
      { type: "paragraph" },
    ]).scrollIntoView().run();
    setTafsirChoice(null);
  }, [editor, tafsirChoice]);

  /* Open the drawer at that verse so the reader can highlight a passage and
     use the Embed selection control there — one embedding path, reachable from
     both the drawer and the slash command, rather than two implementations. */
  const chooseTafsirPassage = useCallback(() => {
    if (!editor || !tafsirChoice) return;
    editor.chain().focus().deleteRange(tafsirChoice.range).run();
    ectx?.onOpenTafsir(tafsirChoice.verseKey);
    setTafsirChoice(null);
  }, [editor, tafsirChoice, ectx]);

  /* Embedding from the Tafsīr drawer. The drawer decides WHAT to embed (a
     highlighted passage or the whole entry); the editor owns insertion, so
     neither has to know about the other's internals. */
  useEffect(() => {
    if (!editor) return;
    const onEmbed = (e: Event) => {
      const d = (e as CustomEvent<{
        verseKey: string; sourceName: string; sourceSlug: string;
        contentHtml: string; partial: boolean;
      }>).detail;
      if (!d?.verseKey) return;
      editor.chain().focus().insertContent([
        { type: "tafsirBlock", attrs: {
          verseKey: d.verseKey, contentHtml: d.contentHtml,
          sourceName: d.sourceName, sourceSlug: d.sourceSlug, partial: d.partial,
        } },
        { type: "paragraph" },
      ]).scrollIntoView().run();
    };
    window.addEventListener("tl:embed-tafsir", onEmbed);
    return () => window.removeEventListener("tl:embed-tafsir", onEmbed);
  }, [editor]);

  /* Choosing a command in the /help sheet types its trigger back into the
     document. Inserting the TEXT rather than executing the command keeps the
     user in the normal flow — the slash menu opens on it, and they can still
     add an argument like "2:255" before committing. */
  useEffect(() => {
    if (!editor) return;
    const onInsert = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      editor.chain().focus().insertContent(`/${id}`).run();
    };
    window.addEventListener("tl:slash-insert", onInsert);
    return () => window.removeEventListener("tl:slash-insert", onInsert);
  }, [editor]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="page-editor" ref={pageEditorRef} data-sync={phase}>
      {/* Main container — same structure as the square ones: top drag bar,
          square chrome, movable (offset persisted per page) */}
      <div
        className="main-doc-container"
        style={{ transform: `translate(${docOffset.x}px, ${docOffset.y}px)` }}
      >
        <div
          className="main-doc-bar"
          title="Drag to move"
          onPointerDown={onDocBarDown}
          onPointerMove={onDocBarMove}
          onPointerUp={onDocBarUp}
          onPointerCancel={onDocBarUp}
        >
          <span className="free-textbox-gripdots" aria-hidden>⋯⋯</span>
        </div>
        <EditorContent editor={editor} />

        {/* The page's stored text, painted while Yjs is still catching up.
            Content in this editor does NOT come from initialContent — it
            arrives over the websocket, behind a collab-token fetch, a socket
            handshake and a sync. Three sequential network steps, on every page
            change, because the component is keyed by pageId and builds a fresh
            room each time. Until they finish the document is genuinely empty,
            which is the several seconds of blank page.

            The text was in initialContent the whole time. This shows it, in the
            same typography, and gets out of the way the moment the editor
            opens (first sync, or the offline copy). The editor underneath is
            read-only until then; keys pressed meanwhile appear at the end of
            this, with a caret, where they will be typed in. */}
        {phase === "pending" && (
          <div className="page-editor-content page-editor-prepaint" aria-hidden>
            {!docIsEmpty(startContent) && (
              <StaticDoc content={pendingTyping ? withoutTrailingBlank(startContent) : startContent} />
            )}
            {pendingTyping && pendingTyping.split("\n").map((line, i, all) => (
              <p key={i} className="page-editor-typed">
                {line}
                {i === all.length - 1 && <span className="page-editor-typed-caret" />}
              </p>
            ))}
            <p className="page-editor-wait">Connecting…</p>
          </div>
        )}
      </div>
      <SelectionToolbar editor={editor} />
      {/* The ⋮⋮ grip that appears beside whichever block the mouse is near. */}
      <BlockHandle editor={editor} wrapperRef={pageEditorRef} />
      <SlashHelp />

      {/* Freeform movable text containers — every one (including a freshly
          clicked temp) is the SAME full FreeTextBox: top bar, drag, resize,
          "/" palette, /ayah expansion. Keys are aliased across the
          temp→server swap so the component never remounts. */}
      {textBoxNotes.map((note) => (
        <FreeTextBox
          key={keyAliasRef.current.get(note.id) ?? note.id}
          note={note}
          startEditing={note.id === freshBoxId}
          onUpdated={onNoteUpdated}
          onDeleted={(id) => {
            if (id === freshBoxId) setFreshBoxId(null);
            onNoteDeleted?.(id);
          }}
          onPersistTemp={persistTemp}
        />
      ))}

      {extent && <div className="canvas-extent" aria-hidden style={{ left: extent.w - 1, top: extent.h - 1 }} />}

      {/* Stylus ink — pen draws directly, no buttons, no mode switch.
          The tool pill appears only while annotating. */}
      <EditorInkLayer pageId={pageId} />

      {palette &&
        typeof document !== "undefined" &&
        createPortal(
          (() => {
            // Keep the palette fully on-screen: flip above the caret when
            // there isn't enough room below, and clamp horizontally.
            // Uses visualViewport so the on-screen keyboard (which shrinks
            // the visual viewport, not the layout viewport) is respected.
            const MAX_H = 324;
            const MIN_W = 280;
            const vv = window.visualViewport;
            const visBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
            const vw = vv ? vv.offsetLeft + vv.width : window.innerWidth;
            const left = Math.max(8, Math.min(palette.rect.left, vw - MIN_W - 12));
            const spaceBelow = visBottom - palette.rect.bottom;
            const openUp = spaceBelow < MAX_H + 12 && (palette.rect.top - (vv?.offsetTop ?? 0)) > spaceBelow;
            const pos: React.CSSProperties = openUp
              ? { position: "fixed", bottom: window.innerHeight - palette.rect.top + 6, left, zIndex: 9999 }
              : { position: "fixed", top: Math.min(palette.rect.bottom + 6, visBottom - 120), left, zIndex: 9999 };
            // When opening downward with the keyboard up, cap the palette
            // height to the space actually visible above the keyboard.
            const maxH = openUp
              ? MAX_H
              : Math.min(MAX_H, Math.max(120, visBottom - palette.rect.bottom - 18));
            return (
              <div className="slash-palette-anchor" data-open-up={openUp ? "true" : "false"} style={pos}>
                <CommandList ref={commandListRef} items={palette.items} query={palette.query} onSelect={handleSelect} maxHeight={maxH} />
              </div>
            );
          })(),
          document.body,
        )}

      {/* Qurʾān search for /ayah — anchored where the command was typed. */}
      {ayahSearch && typeof document !== "undefined" &&
        createPortal(
          (() => {
            const MAX_H = 400, W = 380;
            const left = Math.max(8, Math.min(ayahSearch.rect.left, window.innerWidth - W - 12));
            const below = window.innerHeight - ayahSearch.rect.bottom;
            const openUp = below < MAX_H + 12 && ayahSearch.rect.top > below;
            const pos: React.CSSProperties = openUp
              ? { position: "fixed", bottom: window.innerHeight - ayahSearch.rect.top + 6, left, zIndex: 9999 }
              : { position: "fixed", top: ayahSearch.rect.bottom + 6, left, zIndex: 9999 };
            return (
              <div style={pos}>
                <QuranSearch
                  currentSurah={studySurah}
                  ranges
                  onSelect={insertAyahTarget}
                  onCancel={() => cancelPicker(ayahSearch.range, () => setAyahSearch(null))}
                />
              </div>
            );
          })(),
          document.body,
        )}

      {/* /link stage 1 — pick the other end. Same search component as /ayah,
          but accepting Selections and Surahs as final answers, and with its
          own state so neither command can strand the other. */}
      {linkUI}

      {/* Tafsir verse picker — surah fixed to what's being studied, pick the āyah */}
      {tafsirChoice && typeof document !== "undefined" &&
        createPortal(
          <div
            className="tafsir-choice"
            style={{ position: "fixed", top: tafsirChoice.rect.bottom + 6,
                     left: Math.max(8, Math.min(tafsirChoice.rect.left, window.innerWidth - 300)),
                     zIndex: 9999 }}
          >
            <p className="tafsir-choice-q">Embed {tafsirChoice.sourceName} on {tafsirChoice.verseKey}</p>
            <button className="tafsir-choice-btn" onClick={embedWholeTafsir}>
              Whole commentary
            </button>
            <button className="tafsir-choice-btn" onClick={chooseTafsirPassage}>
              Choose a passage…
            </button>
            <button className="tafsir-choice-cancel" onClick={() => cancelPicker(tafsirChoice.range, () => setTafsirChoice(null))}>
              Cancel
            </button>
          </div>,
          document.body,
        )}

      {versePicker && (
        <TafsirVersePicker
          surah={studySurah}
          sourceName={versePicker.sourceName}
          rect={versePicker.rect}
          ayahsOnPage={
            Array.from(new Set(
              pageVerses
                .map((v) => v.verse_key.split(":"))
                .filter(([s]) => Number(s) === studySurah)
                .map(([, a]) => Number(a))
            )).sort((a, b) => a - b)
          }
          onConfirm={insertTafsirVerse}
          onCancel={() => cancelPicker(versePicker.range, () => setVersePicker(null))}
        />
      )}
    </div>
  );
}
