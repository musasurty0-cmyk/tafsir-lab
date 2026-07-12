"use client";

/**
 * FreeTextBox — free-floating text box on the Mode B canvas.
 *
 * Stored as a StructuredNote with noteType "textbox" + anchorType "page";
 * offsetX/offsetY hold RAW canvas-space coordinates (unlike anchored notes,
 * which are clamped beside the Mushaf card).
 *
 * Lives inside .mode-b-inner, so it pans and zooms with the viewport.
 *
 * Interactions (hand tool active — the drawing overlay passes events through):
 *   click text   → edit in place (autosizing textarea)
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
import { TextStyle } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";

import { AyahBlockExtension } from "./editor/AyahBlockExtension";
import { TafsirBlockExtension } from "./editor/TafsirBlockExtension";
import { ToggleListExtension } from "./editor/ToggleListExtension";
import {
  SlashCommandExtension,
  buildCommands,
  filterCommands,
  type SlashCommandItem,
} from "./editor/SlashCommand";
import CommandList, { type CommandListHandle } from "./editor/CommandList";
import type { NoteData } from "./NoteCard";

// ── Helpers ────────────────────────────────────────────────────────────────

function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (!n.content) return "";
  return n.content.map(extractText).join("\n").replace(/\n+/g, "\n").trim();
}

function toDoc(text: string): object {
  const paragraphs = text.split("\n").map((line) => ({
    type:    "paragraph",
    content: line ? [{ type: "text", text: line }] : [],
  }));
  return { type: "doc", content: paragraphs.length ? paragraphs : [{ type: "paragraph" }] };
}

// ── Mini "/" palette ────────────────────────────────────────────────────────
// Plain-text containers get the commands that make sense in a text box
// (the full block palette needs the rich editor).

const MINI_COMMANDS = [
  { id: "ayah",    label: "Ayah",    desc: "Embed a verse — type the key (e.g. 2:255), then Enter" },
  { id: "divider", label: "Divider", desc: "Horizontal line" },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  note:        NoteData;
  /** Autofocus the editor on mount (set for freshly placed boxes) */
  startEditing?: boolean;
  /** Rich TipTap body — full slash menu, headings, lists, ayah blocks…
   *  (Mode A editor surface). Default: plain textarea (Mode B canvas). */
  rich?:       boolean;
  onUpdated?:  (note: NoteData) => void;
  onDeleted?:  (noteId: string) => void;
  /** Local-only temp container blurred with content — owner persists it.
   *  Receives the temp id, the TipTap doc JSON, and the CURRENT position
   *  (the user may have dragged the temp before saving). */
  onPersistTemp?: (tempId: string, content: object, at: { x: number; y: number }) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function FreeTextBox({ note, startEditing = false, rich = false, onUpdated, onDeleted, onPersistTemp }: Props) {
  const [text, setText]       = useState(() => extractText(note.content));
  const [pos, setPos]         = useState({ x: note.offsetX, y: note.offsetY });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [slashItems, setSlashItems] = useState<typeof MINI_COMMANDS | null>(null);

  const boxRef      = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef     = useRef<{ startMx: number; startMy: number; startX: number; startY: number; zoom: number } | null>(null);

  // Unsaved optimistic containers haven't got a server id yet — no network.
  const isTemp = note.id.startsWith("temp-");

  // Current position, readable from inside stale closures (rich body commit)
  const posRef = useRef(pos);
  posRef.current = pos;

  // Sync position if the note moves remotely
  useEffect(() => { setPos({ x: note.offsetX, y: note.offsetY }); }, [note.offsetX, note.offsetY]);

  // Sync content if the note changes remotely (skip while the user types;
  // never let an EMPTY incoming doc wipe non-empty local text — that
  // happens during the temp→server swap of a freshly created container)
  useEffect(() => {
    if (textareaRef.current === document.activeElement) return;
    const incoming = extractText(note.content);
    setText((cur) => (!incoming.trim() && cur.trim() ? cur : incoming));
    requestAnimationFrame(() => { if (textareaRef.current) autosize(textareaRef.current); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.content]);

  // Body is ALWAYS a live textarea — click places the caret exactly where
  // clicked, double-click selects a word, drag selects — no edit-mode flip.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    autosize(ta);
    if (startEditing) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  // run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist manual width resize (CSS resize handle) — debounced PATCH
  useEffect(() => {
    const el = boxRef.current;
    if (!el || isTemp) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth);
      if (!w || Math.abs(w - (note.width || 220)) < 4) return;
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

  function autosize(ta: HTMLTextAreaElement) {
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

  // ── Slash palette in containers ─────────────────────────────────────────
  // Typing "/" opens a mini command menu (like the main container's).
  // Detected on the CURRENT LINE: "/" + optional letters, no space yet.
  function updateSlashPalette(ta: HTMLTextAreaElement) {
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/(^|\n)\/(\w*)$/);
    if (!m) { setSlashItems(null); return; }
    const q = m[2].toLowerCase();
    const items = MINI_COMMANDS.filter((c) => c.id.startsWith(q));
    setSlashItems(items.length ? items : null);
  }

  function applySlashItem(item: (typeof MINI_COMMANDS)[number]) {
    const ta = textareaRef.current;
    if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart);
    const after  = ta.value.slice(ta.selectionStart);
    const m = before.match(/(^|\n)\/(\w*)$/);
    if (!m) { setSlashItems(null); return; }
    const tokenStart = before.length - (m[0].length - m[1].length);
    const base = ta.value.slice(0, tokenStart);
    const insert = item.id === "ayah" ? "/ayah " : "────────────\n";
    const next = base + insert + after;
    setText(next);
    setSlashItems(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const caret = (base + insert).length;
      el.setSelectionRange(caret, caret);
      autosize(el);
    });
  }

  // ── Slash commands in containers ────────────────────────────────────────
  // Pressing Enter on a line ending "/ayah 2:255" expands it in place to
  // the verse's Arabic + translation (same endpoint the editor embeds use).
  function maybeExpandSlash(e: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
    const ta = e.currentTarget;
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/(^|\n)\/ayah\s+(\d{1,3}:\d{1,3})\s*$/);
    if (!m) return false;
    e.preventDefault();

    const key = m[2];
    const tokenStart = before.length - (m[0].length - m[1].length);
    const after = ta.value.slice(ta.selectionStart);
    const placeholder = `⏳ ${key}…`;
    const next = ta.value.slice(0, tokenStart) + placeholder + after;
    setText(next);
    requestAnimationFrame(() => { if (textareaRef.current) autosize(textareaRef.current); });

    fetch(`/api/ayah/${key.replace(":", "_")}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ verse }: { verse: { text_uthmani?: string; translations?: { text?: string }[] } }) => {
        const ar = verse.text_uthmani ?? "";
        const tr = (verse.translations?.[0]?.text ?? "").replace(/<[^>]+>/g, "");
        const insert = `${ar} ﴿${key}﴾${tr ? `\n${tr}` : ""}\n`;
        setText((prev) => prev.replace(placeholder, insert));
        requestAnimationFrame(() => { if (textareaRef.current) autosize(textareaRef.current); });
      })
      .catch(() => {
        setText((prev) => prev.replace(placeholder, `/ayah ${key}`));
      });
    return true;
  }

  // ── Save / delete ───────────────────────────────────────────────────────

  function commitText() {
    setFocused(false);
    const trimmed = text.trim();
    if (trimmed === extractText(note.content).trim() && !isTemp) return;

    // Empty box on commit → delete it entirely
    if (!trimmed) { handleDelete(); return; }

    if (isTemp) {
      // Local-only container: the owner creates the server note now
      // (content + current position in one shot).
      onPersistTemp?.(note.id, toDoc(trimmed), { x: pos.x, y: pos.y });
      return;
    }

    fetch(`/api/notes/${note.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ content: toDoc(trimmed) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { note?: NoteData } | null) => {
        if (d?.note) onUpdated?.(d.note);
      })
      .catch(() => {});
  }

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
      style={{ left: pos.x, top: pos.y, width: note.width || 220 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Top drag bar — IN FLOW (same structure as the main container's bar;
          absolute -16px positioning was clipped by the resize overflow). */}
      <div
        className="free-textbox-chrome"
        data-visible={hovered || focused ? "true" : "false"}
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

      {rich ? (
        /* Rich TipTap body — SAME extension set, typography and slash menu
           as the main container (class "page-editor-content" carries the
           identical font family / size / colour). */
        <RichBody
          note={note}
          startEditing={startEditing}
          posRef={posRef}
          onFocusChange={setFocused}
          onUpdated={onUpdated}
          onDelete={handleDelete}
          onPersistTemp={onPersistTemp}
        />
      ) : (
        <>
          {/* Always-live textarea body — natural caret/selection, blur saves */}
          <textarea
            ref={textareaRef}
            className="free-textbox-input"
            value={text}
            placeholder="Type something…"
            rows={1}
            onFocus={() => setFocused(true)}
            onChange={(e) => { setText(e.target.value); autosize(e.target); updateSlashPalette(e.target); }}
            onBlur={() => { setSlashItems(null); commitText(); }}
            onKeyDown={(e) => {
              if (slashItems?.length && e.key === "Enter") { e.preventDefault(); applySlashItem(slashItems[0]); return; }
              if (slashItems && e.key === "Escape") { e.preventDefault(); setSlashItems(null); return; }
              if (e.key === "Enter" && maybeExpandSlash(e)) return;
              if (e.key === "Escape") { e.preventDefault(); e.currentTarget.blur(); }
            }}
          />

          {/* Mini "/" palette */}
          {slashItems && (
            <div className="slash-palette free-textbox-slash">
              {slashItems.map((item, i) => (
                <button
                  key={item.id}
                  className="slash-palette-item"
                  data-active={i === 0 ? "true" : "false"}
                  onMouseDown={(e) => { e.preventDefault(); applySlashItem(item); }}
                >
                  <span className="slash-palette-icon">{item.id === "ayah" ? "📖" : "—"}</span>
                  <span className="slash-palette-text">
                    <span className="slash-palette-title">{item.label}</span>
                    <span className="slash-palette-desc">{item.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <span className="free-textbox-author">{note.author.name.split(" ")[0]}</span>
    </div>
  );
}

// ── Rich body — standalone TipTap editor per container ─────────────────────
// Mirrors the main container's PageEditor: full extension list, the SAME
// slash-command palette (h1…h3, quote, lists, tasks, code, toggle, divider,
// ayah + tafsir blocks) and the same "page-editor-content" typography class.
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
  posRef:        React.MutableRefObject<{ x: number; y: number }>;
  onFocusChange: (focused: boolean) => void;
  onUpdated?:    (note: NoteData) => void;
  onDelete:      () => void;
  onPersistTemp?: (tempId: string, content: object, at: { x: number; y: number }) => void;
}

function RichBody({
  note, startEditing, posRef,
  onFocusChange, onUpdated, onDelete, onPersistTemp,
}: RichBodyProps) {
  const [palette, setPalette] = useState<PaletteState | null>(null);
  const commandListRef = useRef<CommandListHandle>(null);
  const ALL_COMMANDS   = useRef(buildCommands());
  const paletteOpenRef = useRef(false);
  const saveTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistedRef   = useRef(false);

  // Fresh values inside editor callbacks (created once, closures go stale)
  const noteRef = useRef(note);
  noteRef.current = note;
  const cbRef = useRef({ onFocusChange, onUpdated, onDelete, onPersistTemp });
  cbRef.current = { onFocusChange, onUpdated, onDelete, onPersistTemp };

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

    onUpdate({ editor }) {
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
      // Clicking a palette item steals focus for a moment — not a real exit
      const rel = (event as FocusEvent).relatedTarget as HTMLElement | null;
      if (rel?.closest?.(".slash-palette-anchor")) return;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      (item as SlashCommandItem & { _query: string })._query = palette.query;
      palette.props.command({ ...(item as object) });
      paletteOpenRef.current = false;
      setPalette(null);
    },
    [palette],
  );

  return (
    <>
      <EditorContent editor={editor} />

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
    </>
  );
}
