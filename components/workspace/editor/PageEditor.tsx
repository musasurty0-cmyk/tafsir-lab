"use client";

/**
 * PageEditor — TipTap collaborative editor for Mode A.
 *
 * Extensions:
 *   StarterKit, Placeholder, Underline, Highlight, Color, TextStyle
 *   AyahBlockExtension, TafsirBlockExtension, SlashCommandExtension
 *   Collaboration       — Yjs CRDT, synced via YPartyKitProvider
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

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Color from "@tiptap/extension-color";
import { TextStyle, FontFamily } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";

import { PARTYKIT_HOST } from "@/lib/collab/config";
import { AyahBlockExtension } from "./AyahBlockExtension";
import { TafsirBlockExtension } from "./TafsirBlockExtension";
import { ToggleListExtension } from "./ToggleListExtension";
import { TextDirection } from "./TextDirection";
import { ConnectionBlockExtension } from "./ConnectionBlockExtension";
import EditorInkLayer from "./EditorInkLayer";
import FreeTextBox, { TEXTBOX_DEFAULT_WIDTH } from "../FreeTextBox";
import type { NoteData } from "../NoteCard";
import {
  SlashCommandExtension,
  buildCommands,
  filterCommands,
  type SlashCommandItem,
} from "./SlashCommand";
import CommandList, { type CommandListHandle } from "./CommandList";
import { getUserColor } from "./RemoteCursorsExtension";
import SelectionToolbar from "./SelectionToolbar";
import { useEditorCtxOptional } from "./EditorContext";
import TafsirVersePicker from "./TafsirVersePicker";
import QuranSearch from "./QuranSearch";
import ConnectionForm, { type Endpoint } from "./ConnectionForm";
import { ayahKey, surahKey, selectionKey } from "@/lib/quran-objects";
import { parseReference, type SearchTarget } from "@/lib/quran-search";

// ── Constants ──────────────────────────────────────────────────────────────

const SAVE_DEBOUNCE_MS = 900;

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
  const ectx        = useEditorCtxOptional();
  const studySurah  = ectx?.surahNumber ?? 1;
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

  /* /link runs in two stages and keeps its OWN state throughout. It never
     touches ayahSearch: the two commands share a search component but not a
     single byte of state, so cancelling one cannot leave the other half-open. */
  const [linkStage, setLinkStage] = useState<
    /* "pick" fills ONE end and remembers the other, so either side can be
       chosen or changed. Previously only the target was selectable and the
       source was silently the current surah — which meant the user controlled
       half of their own Connection. */
    | {
        step: "pick"; which: "source" | "target";
        range: { from: number; to: number }; rect: DOMRect;
        source?: Endpoint; target?: Endpoint;
      }
    | { step: "form"; range: { from: number; to: number }; rect: DOMRect; source: Endpoint; target: Endpoint }
    | null
  >(null);
  const [linkBusy,  setLinkBusy]  = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkDupe,  setLinkDupe]  = useState<{ id: string; name: string } | null>(null);
  /** Saved Selections offered as /link targets. Loaded lazily — only /link
   *  needs them, so /ayah never pays for the request. */
  const [selectionTargets, setSelectionTargets] = useState<import("@/lib/quran-search").SearchTarget[]>([]);

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
      offsetX: Math.round(x), offsetY: Math.round(y),
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
      const r = pe.getBoundingClientRect();
      createTempAt(e.clientX - r.left, e.clientY - r.top);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [createTempAt]);

  // ── Yjs document + PartyKit provider ─────────────────────────────────
  // Created synchronously on first render so the Collaboration and
  // CollaborationCursor extensions receive a real document + provider at
  // configuration time (an effect would run too late).  The component is
  // keyed by pageId in ModeAPage, so one instance = one room for its
  // whole lifetime.
  const collabRef  = useRef<{ ydoc: Y.Doc; provider: YPartyKitProvider } | null>(null);
  const mountedRef = useRef(false);

  if (!collabRef.current) {
    const ydoc = new Y.Doc();
    collabRef.current = {
      ydoc,
      provider: new YPartyKitProvider(PARTYKIT_HOST, pageId, ydoc, { connect: true }),
    };
  }
  const { ydoc, provider } = collabRef.current;

  // Connection lifecycle. Survives React Strict Mode's dev double-mount:
  // cleanup only disconnects; the delayed destroy is skipped if the same
  // instance re-mounted in the meantime.
  useEffect(() => {
    mountedRef.current = true;
    provider.connect();

    // Reconnect the Yjs socket promptly when an iPad tab is un-suspended —
    // otherwise the student writes into a disconnected doc until the
    // library's backoff timer fires.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const p = provider as unknown as { wsconnected?: boolean; connect: () => void };
      if (p.wsconnected === false) {
        try { p.connect(); } catch { /* already connecting */ }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      mountedRef.current = false;
      provider.disconnect();
      setTimeout(() => {
        if (!mountedRef.current) provider.destroy();
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
      try { p.disconnect(); } catch { /* ignore */ }
      try { p.connect(); }    catch { /* ignore */ }
    };
    roomSocket?.addEventListener("open", onSockOpen);

    const iv = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (p.wsconnected === false) { try { p.connect(); } catch { /* ignore */ } }
    }, 20000);

    return () => {
      roomSocket?.removeEventListener("open", onSockOpen);
      clearInterval(iv);
    };
  }, [provider, roomSocket]);

  // ── Save helper ───────────────────────────────────────────────────────

  const scheduleSave = useCallback(
    (editor: Editor) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch(`/api/pages/${pageId}/content`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ tiptapContent: editor.getJSON() }),
        }).catch(() => {});
      }, SAVE_DEBOUNCE_MS);
    },
    [pageId],
  );

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // ── TipTap editor ─────────────────────────────────────────────────────

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable StarterKit's built-in history — Collaboration provides Yjs undo
        history:        false,
        heading:        { levels: [1, 2, 3] },
        horizontalRule: {},
      }),

      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Heading…";
          return "Type '/' for commands, or start writing…";
        },
        // includeChildren stacked a placeholder on the list, the list item,
        // AND the inner paragraph at once — rendering doubled ghost text.
        includeChildren: false,
      }),

      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      FontFamily,
      Color,
      Subscript,
      Superscript,
      Link.configure({
        openOnClick:   false,   // click edits; Ctrl/Cmd-click opens
        autolink:      true,    // typed/pasted URLs become links
        linkOnPaste:   true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),

      AyahBlockExtension,
      TafsirBlockExtension,
      ToggleListExtension,
      TextDirection,
      // workspaceId lets the card fetch its Connection; the node itself only
      // ever stores an id.
      ConnectionBlockExtension.configure({ workspaceId }),

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

    autofocus:         "end",
    immediatelyRender: false,

    onUpdate({ editor }) {
      scheduleSave(editor);
    },

    editorProps: {
      attributes: { class: "page-editor-content", spellcheck: "true" },
      // Keep the caret visible above the iPad on-screen keyboard: ProseMirror
      // auto-scrolls the selection into view with this margin whenever it
      // comes within the threshold of the (visual) viewport edge.
      scrollThreshold: 80,
      scrollMargin:    160,
    },
  });

  // ── One-time content seeding ──────────────────────────────────────────
  // After the provider completes its first sync: if the shared Yjs doc is
  // still empty but the DB has content (pages created before live collab,
  // or PartyKit storage was cleared), seed the doc from the DB snapshot.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!editor) return;

    function seed() {
      if (seededRef.current || !editor || editor.isDestroyed) return;
      seededRef.current = true;
      const fragment = ydoc.getXmlFragment("default");
      if (fragment.length === 0 && initialContent) {
        editor.commands.setContent(initialContent as object);
      }
    }

    if (provider.synced) seed();
    else provider.on("synced", seed);
    return () => { provider.off("synced", seed); };
  // initialContent is stable for the lifetime of this mount (keyed by pageId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, provider]);

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
        setLinkStage({
          step: "pick", which: "target", range, rect: palette.rect,
          // A default, not a decision — the form lets it be changed.
          source: linkSource(),
        });
        setPalette(null);
        return;
      }

      // /ayah with no usable reference → search instead of guessing 1:1.
      if (item.id === "ayah" && !parseReference(q.replace(/^\S+\s*/, ""))) {
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

  /** Insert the chosen verse using the EXISTING ayah block — the search
   *  changes how a verse is found, never how it is embedded. */
  const insertAyahTarget = useCallback((t: SearchTarget) => {
    if (!editor || !ayahSearch) return;
    const surahNumber = t.surah ?? 1;
    const ayahNumber  = t.ayah ?? 1;
    // Close FIRST, so the panel cannot outlive the transaction if inserting
    // throws, and unmount before focus moves back into the document.
    setAyahSearch(null);
    editor.chain().focus()
      // deleteRange removes the leftover "/ayah …" text the command was typed
      // into; without it the slash text stays behind the inserted block.
      .deleteRange(ayahSearch.range)
      .insertContent([
        {
          type: "ayahBlock",
          attrs: { verseKey: `${surahNumber}:${ayahNumber}`, surahNumber, ayahNumber },
        },
        // Trailing paragraph gives the caret somewhere to land after an atom
        // block, so focus returns to editable text rather than being trapped.
        { type: "paragraph" },
      ])
      .focus()
      .scrollIntoView()
      .run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, ayahSearch]);

  /* Load the workspace Selections once /link opens, so they can be offered as
     targets alongside ayat and Surahs. */
  useEffect(() => {
    if (!linkStage) return;
    fetch(`/api/workspaces/${workspaceId}/segments`)
      .then((r) => (r.ok ? r.json() : { segments: [] }))
      .then((d) => setSelectionTargets(
        (d.segments ?? []).map((sg: { id: string; name: string; surahNumber: number; startAyah: number; endAyah: number }) => ({
          kind: "selection" as const,
          id: sg.id,
          label: sg.name || `Selection ${sg.startAyah}–${sg.endAyah}`,
          preview: `${sg.startAyah}–${sg.endAyah}`,
        })),
      ))
      .catch(() => setSelectionTargets([]));
  }, [linkStage, workspaceId]);

  /** The source of a Connection made from THIS editor is the Surah being
   *  studied — Surah-level notes are Surah-level context. */
  const linkSource = useCallback((): Endpoint => ({
    type: "surah",
    key: surahKey(studySurah),
    // The name, not "Surah 1" — a number alone does not tell you what you are
    // about to connect.
    label: surahName ? `${surahName} · ${studySurah}` : `Surah ${studySurah}`,
  }), [studySurah, surahName]);

  /** Close /link and put the caret back where the command was typed, with the
   *  "/link" text removed so no orphan command survives a cancel. */
  const closeLink = useCallback((removeCommand = true) => {
    const st = linkStage;
    setLinkStage(null);
    setLinkBusy(false);
    setLinkError(null);
    setLinkDupe(null);
    if (removeCommand && editor && st) {
      editor.chain().focus().deleteRange(st.range).run();
    }
  }, [editor, linkStage]);

  const chooseLinkTarget = useCallback((t: import("@/lib/quran-search").SearchTarget) => {
    if (!linkStage || linkStage.step !== "pick") return;

    const picked: Endpoint =
      t.kind === "ayah"
        ? { type: "ayah", key: ayahKey(t.surah ?? 1, t.ayah ?? 1), label: t.label, arabic: t.arabic }
        : t.kind === "selection"
        ? { type: "selection", key: selectionKey(t.id), label: t.label }
        // A Surah label carries its ayah count for search; drop that here,
        // where it is an endpoint rather than a result.
        : { type: "surah", key: surahKey(t.surah ?? Number(t.id)), label: t.label.split(" · ")[0] };

    const source = linkStage.which === "source" ? picked : linkStage.source;
    const target = linkStage.which === "target" ? picked : linkStage.target;

    if (source && target && source.key === target.key) {
      /* Refused here as well as on the server, so the user is told at the
         moment of choosing rather than after a round trip. The picker stays
         open so they can choose again without starting over. */
      setLinkError("An object cannot be connected to itself");
      return;
    }
    setLinkError(null);

    // Both ends known → name the relationship. Otherwise keep picking.
    if (source && target) {
      setLinkStage({ step: "form", range: linkStage.range, rect: linkStage.rect, source, target });
    } else {
      setLinkStage({ ...linkStage, source, target, which: source ? "target" : "source" });
    }
  }, [linkStage]);

  /** Reopen the picker for one end of a Connection being composed. */
  const repickEndpoint = useCallback((which: "source" | "target") => {
    if (!linkStage || linkStage.step !== "form") return;
    setLinkError(null);
    setLinkStage({
      step: "pick", which,
      range: linkStage.range, rect: linkStage.rect,
      // Keep the OTHER end, so changing one side never discards the other.
      source: which === "source" ? undefined : linkStage.source,
      target: which === "target" ? undefined : linkStage.target,
    });
  }, [linkStage]);

  const submitConnection = useCallback((v: {
    name: string; commentary?: string; category?: string; tags: string[];
  }) => {
    if (!linkStage || linkStage.step !== "form" || !editor) return;
    const { source, target, range } = linkStage;
    setLinkBusy(true);
    setLinkError(null);

    fetch(`/api/workspaces/${workspaceId}/connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: source.type, sourceKey: source.key,
        targetType: target.type, targetKey: target.key,
        ...v,
      }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.status === 409 && d.existing) {
          // Already connected: offer the existing Connection instead of
          // reporting a failure, keeping what was typed in the meantime.
          setLinkDupe({ id: d.existing.id, name: d.existing.name });
          return null;
        }
        if (!r.ok) throw new Error(d.error ?? String(r.status));
        return d.connection;
      })
      .then((conn) => {
        if (!conn) return;
        /* Insert a card that REFERENCES the record by id. The Connection is
           already saved, so a failure here loses a card, never the work. */
        try {
          editor.chain().focus()
            .deleteRange(range)
            .insertContent([
              { type: "connectionBlock", attrs: { connectionId: conn.id } },
              { type: "paragraph" },
            ])
            .focus()
            .scrollIntoView()
            .run();
        } catch {
          setLinkError("Connection saved, but the card could not be inserted.");
          return;
        }
        setLinkStage(null);
        setLinkDupe(null);
      })
      .catch((e) => setLinkError(String(e.message ?? e)))
      .finally(() => setLinkBusy(false));
  }, [linkStage, editor, workspaceId]);

  /* The panel is a portal, so nothing unmounts it implicitly. These close it
     for the cases the search itself cannot see: the editor going away, the
     page changing, or the block it was anchored to being edited out. */
  useEffect(() => () => { setAyahSearch(null); setLinkStage(null); }, []);
  useEffect(() => { setAyahSearch(null); setLinkStage(null); }, [pageId]);
  useEffect(() => {
    if (!editor || !ayahSearch) return;
    const close = () => setAyahSearch(null);
    // A destroyed editor can never receive the insertion.
    editor.on("destroy", close);
    return () => { editor.off("destroy", close); };
  }, [editor, ayahSearch]);

  // Insert a tafsir block at the picker's saved range for the chosen verse.
  const insertTafsirVerse = useCallback((verseKey: string) => {
    if (!editor || !versePicker) return;
    const { range, slug, sourceName } = versePicker;
    editor.chain().focus().deleteRange(range).insertContent([
      { type: "tafsirBlock", attrs: { verseKey, contentHtml: "", sourceName, sourceSlug: slug } },
      { type: "paragraph" },
    ]).scrollIntoView().run();
    setVersePicker(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, versePicker]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="page-editor" ref={pageEditorRef}>
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
      </div>
      <SelectionToolbar editor={editor} />

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
                  onSelect={insertAyahTarget}
                  onCancel={() => setAyahSearch(null)}
                />
              </div>
            );
          })(),
          document.body,
        )}

      {/* /link stage 1 — pick the other end. Same search component as /ayah,
          but accepting Selections and Surahs as final answers, and with its
          own state so neither command can strand the other. */}
      {linkStage?.step === "pick" && typeof document !== "undefined" &&
        createPortal(
          (() => {
            const W = 380, MAX_H = 400;
            const left = Math.max(8, Math.min(linkStage.rect.left, window.innerWidth - W - 12));
            const below = window.innerHeight - linkStage.rect.bottom;
            const openUp = below < MAX_H + 12 && linkStage.rect.top > below;
            const pos: React.CSSProperties = openUp
              ? { position: "fixed", bottom: window.innerHeight - linkStage.rect.top + 6, left, zIndex: 9999 }
              : { position: "fixed", top: linkStage.rect.bottom + 6, left, zIndex: 9999 };
            return (
              <div style={pos}>
                <QuranSearch
                  kinds={["ayah", "selection", "surah"]}
                  currentSurah={studySurah}
                  selections={selectionTargets}
                  placeholder={linkStage.which === "source"
                    ? "Choose the first passage…"
                    : "Link to an āyah, Selection or Surah…"}
                  onSelect={chooseLinkTarget}
                  onCancel={() => closeLink()}
                />
              </div>
            );
          })(),
          document.body,
        )}

      {/* /link stage 2 — name the relationship. */}
      {linkStage?.step === "form" && (
        <ConnectionForm
          source={linkStage.source}
          target={linkStage.target}
          busy={linkBusy}
          error={linkError}
          duplicateOf={linkDupe}
          onCancel={() => closeLink()}
          onChangeEndpoint={repickEndpoint}
          onOpenExisting={(id) => {
            // The pair is already connected: drop a card for the EXISTING
            // Connection rather than creating a second one.
            if (editor) {
              editor.chain().focus()
                .deleteRange(linkStage.range)
                .insertContent([
                  { type: "connectionBlock", attrs: { connectionId: id } },
                  { type: "paragraph" },
                ])
                .focus().run();
            }
            closeLink(false);
          }}
          onSubmit={submitConnection}
        />
      )}

      {/* Tafsir verse picker — surah fixed to what's being studied, pick the āyah */}
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
          onCancel={() => setVersePicker(null)}
        />
      )}
    </div>
  );
}
