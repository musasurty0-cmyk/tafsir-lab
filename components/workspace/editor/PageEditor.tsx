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
import { TextStyle } from "@tiptap/extension-text-style";
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
import EditorInkLayer from "./EditorInkLayer";
import FreeTextBox from "../FreeTextBox";
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

// ── Constants ──────────────────────────────────────────────────────────────

const SAVE_DEBOUNCE_MS = 900;

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  pageId:           string;
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
  initialContent,
  currentUserId,
  currentUserName,
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
      width: 260, height: null,
      isMinimized: false, zIndex: 1, isAdmin: false,
      createdAt: new Date().toISOString(),
      author: { id: currentUserId, name: currentUserName, avatarUrl: null },
    };
    onNoteCreated?.(temp);
    setFreshBoxId(tempId);
  }, [currentUserId, currentUserName, onNoteCreated]);

  const persistTemp = useCallback((tempId: string, text: string, at: { x: number; y: number }) => {
    const paragraphs = text.split("\n").map((line) => ({
      type:    "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    }));
    const persist = () =>
      fetch(`/api/pages/${pageId}/notes`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          noteType:   "textbox",
          anchorType: "editor",           // editor-surface container (content space)
          content:    { type: "doc", content: paragraphs },
          offsetX:    Math.round(at.x),
          offsetY:    Math.round(at.y),
          width:      260,
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
      (item as SlashCommandItem & { _query: string })._query = palette.query;
      palette.props.command({ ...(item as object) });
      setPalette(null);
    },
    [palette],
  );

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
    </div>
  );
}
