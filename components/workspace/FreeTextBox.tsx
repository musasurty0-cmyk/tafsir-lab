"use client";

/**
 * FreeTextBox — free-floating rich text container on a canvas surface
 * (Mode B Mushaf canvas, word/ayah annotation layers, and whiteboards).
 *
 * Stored as a StructuredNote with noteType "textbox"; offsetX/offsetY hold
 * RAW canvas-space coordinates. Lives inside .mode-b-inner, so it pans and
 * zooms with the viewport.
 *
 * The body is ONE shared implementation: the same TipTap editor as the main
 * page editor — same extensions, same slash palette (CommandList), same
 * /ayah and /tafsir block widgets, same SelectionToolbar, same typography
 * ("page-editor-content"). Containers differ from the main editor ONLY in
 * persistence (notes REST API instead of Yjs). There is deliberately no
 * "simplified" plain-text fallback — that was a second, divergent editor.
 *
 * Interactions (hand tool active — the drawing overlay passes events through):
 *   click text   → edit in place
 *   drag grip    → move (PATCH offsetX/offsetY on release)
 *   ✕ button     → delete
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
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";

import { AyahBlockExtension } from "./editor/AyahBlockExtension";
import { TafsirBlockExtension } from "./editor/TafsirBlockExtension";
import { ToggleListExtension } from "./editor/ToggleListExtension";
import { TextDirection } from "./editor/TextDirection";
import {
  SlashCommandExtension,
  buildCommands,
  filterCommands,
  type SlashCommandItem,
} from "./editor/SlashCommand";
import CommandList, { type CommandListHandle } from "./editor/CommandList";
import SelectionToolbar from "./editor/SelectionToolbar";
import TafsirVersePicker from "./editor/TafsirVersePicker";
import { useEditorCtxOptional } from "./editor/EditorContext";
import type { NoteData } from "./NoteCard";

/** Default width for a freshly placed container — wide enough that the slash
 *  palette, ayah/tafsir search results and toolbars are comfortable without
 *  a manual resize. */
export const TEXTBOX_DEFAULT_WIDTH = 340;

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  note:        NoteData;
  /** Autofocus the editor on mount (set for freshly placed boxes) */
  startEditing?: boolean;
  /** Mushaf-canvas containers: /ayah drops the verse's Arabic + translation
   *  as plain inline text (the classic canvas behaviour) instead of the
   *  interactive Ayah block widget. /tafsir is unaffected — always the block
   *  widget. Defaults to false (widget), which is what the main document and
   *  whiteboards use. */
  ayahInline?: boolean;
  onUpdated?:  (note: NoteData) => void;
  onDeleted?:  (noteId: string) => void;
  /** Local-only temp container blurred with content — owner persists it.
   *  Receives the temp id, the TipTap doc JSON, and the CURRENT position
   *  (the user may have dragged the temp before saving). */
  onPersistTemp?: (tempId: string, content: object, at: { x: number; y: number }) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function FreeTextBox({ note, startEditing = false, ayahInline = false, onUpdated, onDeleted, onPersistTemp }: Props) {
  const [pos, setPos]         = useState({ x: note.offsetX, y: note.offsetY });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /* An empty container shows NO chrome, even while focused: clicking a blank
     spot should give you a caret, not a placed component. The border and drag
     bar appear the moment there is something to frame. */
  const [empty, setEmpty] = useState(true);

  const boxRef  = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startMx: number; startMy: number; startX: number; startY: number; zoom: number } | null>(null);

  // Unsaved optimistic containers haven't got a server id yet — no network.
  const isTemp = note.id.startsWith("temp-");

  // Current position, readable from inside stale closures (rich body commit)
  const posRef = useRef(pos);
  posRef.current = pos;

  // Sync position if the note moves remotely
  useEffect(() => { setPos({ x: note.offsetX, y: note.offsetY }); }, [note.offsetX, note.offsetY]);

  // Persist manual width resize (CSS resize handle) — debounced PATCH
  useEffect(() => {
    const el = boxRef.current;
    if (!el || isTemp) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth);
      if (!w || Math.abs(w - (note.width || TEXTBOX_DEFAULT_WIDTH)) < 4) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetch(`/api/notes/${note.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ width: w }),
        }).catch(() => {});
      }, 600);
    });
    ro.observe(el);
    return () => { ro.disconnect(); if (timer) clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  function handleDelete() {
    if (isTemp) { onDeleted?.(note.id); return; } // local-only removal
    fetch(`/api/notes/${note.id}`, { method: "DELETE" })
      .then((r) => { if (r.ok) onDeleted?.(note.id); })
      .catch(() => {});
  }

  // ── Drag (grip handle) ──────────────────────────────────────────────────

  function onGripDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Derive current zoom from the transformed parent so drag deltas map
    // 1:1 to canvas-space units at any zoom level.
    const inner = (e.currentTarget as HTMLElement).closest(".mode-b-inner") as HTMLElement | null;
    let zoom = 1;
    if (inner) {
      const m = new DOMMatrixReadOnly(getComputedStyle(inner).transform);
      zoom = m.a || 1;
    }
    dragRef.current = { startMx: e.clientX, startMy: e.clientY, startX: pos.x, startY: pos.y, zoom };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onGripMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setPos({
      x: d.startX + (e.clientX - d.startMx) / d.zoom,
      y: d.startY + (e.clientY - d.startMy) / d.zoom,
    });
  }

  function onGripUp() {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (isTemp) return; // geometry persists with the server note
    fetch(`/api/notes/${note.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ offsetX: pos.x, offsetY: pos.y }),
    }).catch(() => {});
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      ref={boxRef}
      className="free-textbox"
      data-focused={focused ? "true" : "false"}
      data-empty={empty ? "true" : "false"}
      style={{ left: pos.x, top: pos.y, width: note.width || TEXTBOX_DEFAULT_WIDTH }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Top drag bar — IN FLOW (same structure as the main container's bar;
          absolute -16px positioning was clipped by the resize overflow). */}
      <div
        className="free-textbox-chrome"
        data-visible={!empty && (hovered || focused) ? "true" : "false"}
        title="Drag to move"
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
      >
        <span className="free-textbox-gripdots" aria-hidden>⋯⋯</span>
        <button
          className="free-textbox-delete"
          title="Delete"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
        >
          ✕
        </button>
      </div>

      <RichBody
        note={note}
        startEditing={startEditing}
        ayahInline={ayahInline}
        posRef={posRef}
  onFocusChange={setFocused}
        onEmptyChange={setEmpty}
        onUpdated={onUpdated}
        onDelete={handleDelete}
        onPersistTemp={onPersistTemp}
      />

      <span className="free-textbox-author">{note.author.name.split(" ")[0]}</span>
    </div>
  );
}

// ── Rich body — standalone TipTap editor per container ─────────────────────
// Mirrors the main container's PageEditor: full extension list, the SAME
// slash-command palette (h1…h3, quote, lists, tasks, code, toggle, divider,
// ayah + tafsir blocks), the same SelectionToolbar, the same tafsir verse
// picker, and the same "page-editor-content" typography class.
// No Yjs here — containers sync via the notes REST API like before.

interface PaletteState {
  items: SlashCommandItem[];
  query: string;
  rect:  DOMRect;
  props: SuggestionProps;
}

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

function isEmptyDoc(d: unknown): boolean {
  const doc = d as { content?: { type?: string; content?: unknown[] }[] } | null;
  if (!doc?.content?.length) return true;
  return doc.content.every((n) => n.type === "paragraph" && !(n.content?.length));
}

interface RichBodyProps {
  note:          NoteData;
  startEditing:  boolean;
  ayahInline:    boolean;
  posRef:        React.MutableRefObject<{ x: number; y: number }>;
  onFocusChange: (focused: boolean) => void;
  /** Drives the invisible-until-typed chrome on the wrapper. */
  onEmptyChange: (empty: boolean) => void;
  onUpdated?:    (note: NoteData) => void;
  onDelete:      () => void;
  onPersistTemp?: (tempId: string, content: object, at: { x: number; y: number }) => void;
}

function RichBody({
  note, startEditing, ayahInline, posRef,
  onFocusChange, onEmptyChange, onUpdated, onDelete, onPersistTemp,
}: RichBodyProps) {
  const [palette, setPalette] = useState<PaletteState | null>(null);
  const commandListRef = useRef<CommandListHandle>(null);
  const ALL_COMMANDS   = useRef(buildCommands());
  const paletteOpenRef = useRef(false);
  const saveTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistedRef   = useRef(false);

  // Surah being studied + verses on this page — for the tafsir verse picker
  // (same context the main editor reads; falls back to surah 1 on boards).
  const ectx       = useEditorCtxOptional();
  const studySurah = ectx?.surahNumber || 1;
  const pageVerses = ectx?.verses ?? [];

  // Verse picker: opened when a tafsir command — or, in ayahInline mode, the
  // /ayah command — is chosen WITHOUT a verse key, so the user picks the āyah
  // within the surah they're studying. `kind` decides what gets inserted on
  // confirm: a tafsir block, or the verse's plain Arabic + translation text.
  const [versePicker, setVersePicker] = useState<{
    kind: "tafsir" | "ayah";
    slug: string; sourceName: string; range: { from: number; to: number }; rect: DOMRect;
  } | null>(null);

  // Fresh values inside editor callbacks (created once, closures go stale)
  const noteRef = useRef(note);
  noteRef.current = note;
  const cbRef = useRef({ onFocusChange, onEmptyChange, onUpdated, onDelete, onPersistTemp });
  cbRef.current = { onFocusChange, onEmptyChange, onUpdated, onDelete, onPersistTemp };

  const commit = useCallback((ed: Editor) => {
    const cur  = noteRef.current;
    const temp = cur.id.startsWith("temp-");

    // Empty container on exit → remove it entirely (temp just evaporates)
    if (ed.isEmpty) { cbRef.current.onDelete(); return; }

    const json = ed.getJSON();

    if (temp) {
      if (persistedRef.current) return;           // create-once guard
      persistedRef.current = true;
      cbRef.current.onPersistTemp?.(cur.id, json, { x: posRef.current.x, y: posRef.current.y });
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current); // final content flushes now
    fetch(`/api/notes/${cur.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ content: json }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { note?: NoteData } | null) => { if (d?.note) cbRef.current.onUpdated?.(d.note); })
      .catch(() => {});
  }, [posRef]);

  const editor = useEditor({
    extensions: [
      // History stays ON — standalone editor, no Yjs/Collaboration here.
      StarterKit.configure({
        heading:        { levels: [1, 2, 3] },
        horizontalRule: {},
      }),
      Placeholder.configure({
        placeholder:     "Type '/' for commands…",
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
        openOnClick:    false,
        autolink:       true,
        linkOnPaste:    true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),

      AyahBlockExtension,
      TafsirBlockExtension,
      ToggleListExtension,
      TextDirection,

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
                paletteOpenRef.current = true;
                setPalette({ items: props.items as SlashCommandItem[], query: props.query, rect: props.clientRect() as DOMRect, props });
              },
              onUpdate(props: SuggestionProps) {
                if (!props.clientRect) return;
                setPalette({ items: props.items as SlashCommandItem[], query: props.query, rect: props.clientRect() as DOMRect, props });
              },
              onKeyDown({ event }: SuggestionKeyDownProps) {
                if (event.key === "Escape") { paletteOpenRef.current = false; setPalette(null); return true; }
                return commandListRef.current?.onKeyDown(event) ?? false;
              },
              onExit() { paletteOpenRef.current = false; setPalette(null); },
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

    content: (note.content as object) ?? EMPTY_DOC,

    autofocus:         startEditing ? "end" : false,
    immediatelyRender: false,

    onCreate({ editor }) { cbRef.current.onEmptyChange(editor.isEmpty); },

    onUpdate({ editor }) {
      /* Drives the invisible-until-typed behaviour. Read from the editor
         rather than tracked by hand, so deleting the last character hides the
         chrome again exactly as typing the first character showed it. */
      cbRef.current.onEmptyChange(editor.isEmpty);
      // Debounced autosave while typing (server containers only —
      // temps persist once on blur via onPersistTemp)
      if (noteRef.current.id.startsWith("temp-")) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch(`/api/notes/${noteRef.current.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ content: editor.getJSON() }),
        }).catch(() => {});
      }, 900);
    },

    onFocus() { cbRef.current.onFocusChange(true); },

    onBlur({ editor, event }) {
      // Clicking a palette / picker item steals focus for a moment — not a real exit
      const rel = (event as FocusEvent).relatedTarget as HTMLElement | null;
      if (rel?.closest?.(".slash-palette-anchor, .verse-picker")) return;
      cbRef.current.onFocusChange(false);
      commit(editor);
    },

    editorProps: {
      // page-editor-content = EXACT main-container typography (font family,
      // size, colour, heading scale, quote blocks — everything)
      attributes: { class: "page-editor-content free-textbox-richbody", spellcheck: "true" },
      handleKeyDown(view, event) {
        if (event.key === "Escape" && !paletteOpenRef.current) {
          (view.dom as HTMLElement).blur();
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // Remote content sync — skip while typing; never let an empty incoming doc
  // wipe non-empty local content (happens during the temp→server swap)
  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isFocused) return;
    const incoming = note.content as object | null;
    if (!incoming) return;
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(incoming)) return;
    if (isEmptyDoc(incoming) && !editor.isEmpty) return;
    editor.commands.setContent(incoming);
   
  }, [editor, note.content]);

  // Tap-outside dismiss for the palette (portal lives outside the box)
  useEffect(() => {
    if (!palette) return;
    function onDown(e: PointerEvent) {
      const anchor = document.querySelector(".slash-palette-anchor");
      if (anchor && !anchor.contains(e.target as Node)) {
        paletteOpenRef.current = false;
        setPalette(null);
      }
    }
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [palette]);

  // Reposition when the on-screen keyboard opens/closes (tablets)
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

  const handleSelect = useCallback(
    (item: SlashCommandItem) => {
      if (!palette) return;
      const q = palette.query;
      const keyMatch = q.match(/\d{1,3}:\d{1,3}/);
      const range = (palette.props as unknown as { range: { from: number; to: number } }).range;

      // Ayah command on the Mushaf canvas → insert the verse's Arabic +
      // translation as plain inline text (the classic canvas behaviour),
      // NOT the interactive Ayah block widget. "/ayah 2:255" inserts directly;
      // "/ayah" with no key opens the verse picker (surah being studied).
      if (ayahInline && item.id === "ayah") {
        paletteOpenRef.current = false;
        setPalette(null);
        if (keyMatch) insertAyahInline(keyMatch[0], range);
        else setVersePicker({ kind: "ayah", slug: "", sourceName: "Āyah", range, rect: palette.rect });
        return;
      }

      // Tafsir command with NO explicit verse key → open the verse picker
      // (defaults to the surah being studied) — same flow as the main editor.
      // "/tabari 23:2" inserts directly.
      if (item.isTafsir && !keyMatch) {
        let slug = item.tafsirSlug;
        if (!slug) {
          try { slug = localStorage.getItem("tl-tafsir-source") || "ibn-kathir-en"; }
          catch { slug = "ibn-kathir-en"; }
        }
        setVersePicker({ kind: "tafsir", slug, sourceName: item.tafsirSourceName ?? "Tafsīr", range, rect: palette.rect });
        paletteOpenRef.current = false;
        setPalette(null);
        return;
      }

      (item as SlashCommandItem & { _query: string })._query = q;
      palette.props.command({ ...(item as object) });
      paletteOpenRef.current = false;
      setPalette(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette, ayahInline],
  );

  // Insert a tafsir block at the picker's saved range for the chosen verse.
  const insertTafsirVerse = useCallback((verseKey: string) => {
    if (!editor || !versePicker) return;
    const { range, slug, sourceName } = versePicker;
    editor.chain().focus().deleteRange(range).insertContent([
      { type: "tafsirBlock", attrs: { verseKey, contentHtml: "", sourceName, sourceSlug: slug } },
      { type: "paragraph" },
    ]).scrollIntoView().run();
    setVersePicker(null);
   
  }, [editor, versePicker]);

  // Insert the verse's Arabic + translation as PLAIN inline text at a slash
  // range (classic canvas /ayah). Fetches the verse; shows a loading marker
  // meanwhile; replaces it (or restores the command on failure).
  const insertAyahInline = useCallback((verseKey: string, range: { from: number; to: number }) => {
    if (!editor) return;
    const placeholder = `⏳ ${verseKey}…`;
    editor.chain().focus().deleteRange(range).run();
    const from = editor.state.selection.from;
    editor.chain().insertContent(placeholder).run();
    const to = editor.state.selection.from;

    fetch(`/api/ayah/${verseKey.replace(":", "_")}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ verse }: { verse: { text_uthmani?: string; translations?: { text?: string }[] } }) => {
        const ar = (verse.text_uthmani ?? "").trim();
        const tr = (verse.translations?.[0]?.text ?? "").replace(/<[^>]+>/g, "").trim();
        const content: object[] = [
          { type: "paragraph", content: ar ? [{ type: "text", text: `${ar} ﴿${verseKey}﴾` }] : [] },
        ];
        if (tr) content.push({ type: "paragraph", content: [{ type: "text", text: tr }] });
        content.push({ type: "paragraph" });
        editor.chain().focus().insertContentAt({ from, to }, content).scrollIntoView().run();
      })
      .catch(() => {
        editor.chain().focus().insertContentAt({ from, to }, `/ayah ${verseKey}`).run();
      });
  }, [editor]);

  return (
    <>
      <EditorContent editor={editor} />

      {/* Same floating formatting toolbar as the main editor */}
      <SelectionToolbar editor={editor} />

      {palette &&
        typeof document !== "undefined" &&
        createPortal(
          (() => {
            // Same viewport-aware clamping as the main editor's palette
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

      {/* Verse picker — surah fixed to what's being studied, pick the āyah.
          Confirms into a tafsir block or inline āyah text per picker.kind. */}
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
          onConfirm={(verseKey) => {
            if (versePicker.kind === "ayah") {
              const { range } = versePicker;
              setVersePicker(null);
              insertAyahInline(verseKey, range);
            } else {
              insertTafsirVerse(verseKey);
            }
          }}
          onCancel={() => setVersePicker(null)}
        />
      )}
    </>
  );
}
