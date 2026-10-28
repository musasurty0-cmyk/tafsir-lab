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
 *   drag a side  → widen or narrow it (the left side moves it as well)
 *   ✕ button     → delete
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { baseExtensions } from "./editor/sharedExtensions";
import { useConnectionLink } from "./editor/useConnectionLink";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";

import {
  SlashCommandExtension,
  buildCommands,
  filterCommands,
  type SlashCommandItem,
} from "./editor/SlashCommand";
import CommandList, { type CommandListHandle } from "./editor/CommandList";
import SelectionToolbar from "./editor/SelectionToolbar";
import TafsirVersePicker from "./editor/TafsirVersePicker";
import QuranSearch from "./editor/QuranSearch";
import { parseRange, type SearchTarget } from "@/lib/quran-search";
import { useEditorCtxOptional } from "./editor/EditorContext";
import type { NoteData } from "./NoteCard";
import { StaticDoc, docIsEmpty } from "@/lib/prosemirror-static";
import { announceFocus } from "./editor/blockFormat";

/** Default width for a freshly placed container — wide enough that the slash
 *  palette, ayah/tafsir search results and toolbars are comfortable without
 *  a manual resize. */
export const TEXTBOX_DEFAULT_WIDTH = 340;
/* Wide enough for a long passage laid out across the page; the sheet scrolls to fit. */
const MIN_WIDTH = 140, MAX_WIDTH = 2400;

/**
 * From a box's corner to the middle of its first line of text (its padding,
 * the hidden drag bar, half a line). A box placed by a click is moved back by
 * this, so the caret appears under the pointer rather than below and right of it.
 */
export const CARET_OFFSET = { x: 13, y: 35 };

/**
 * Screen pixels per canvas unit where `el` sits. Two kinds of zoom can apply:
 * the canvas's transform (whiteboards, the Muṣḥaf canvas) and CSS `zoom` (the
 * document page's 80%, 115%…). Missing the second is why, on a zoomed page, a
 * dragged box ran ahead of the cursor.
 */
export function zoomAt(el: HTMLElement): number {
  const inner = el.closest(".mode-b-inner") as HTMLElement | null;
  const t = inner ? new DOMMatrixReadOnly(getComputedStyle(inner).transform).a || 1 : 1;
  const css = (el as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom;
  return t * (typeof css === "number" && css > 0 ? css : 1);
}

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
  const [width, setWidth]     = useState(note.width || TEXTBOX_DEFAULT_WIDTH);
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

  // Sync position and width if the note changes remotely
  useEffect(() => { setPos({ x: note.offsetX, y: note.offsetY }); }, [note.offsetX, note.offsetY]);
  useEffect(() => { if (note.width) setWidth(note.width); }, [note.width]);

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

  // ── Scrolling the page while a box is carried ───────────────────────────
  /* The pointer cannot leave the window, so a box near the edge of the page
     could not be widened or moved any further: the only way was to drag it
     left, widen it, and drag it back. Now, while a box is held within EDGE px
     of the page's edge, the page scrolls on its own and the box keeps growing
     or moving with it, as far as the page needs to go. Rightward and downward
     are open-ended (the sheet grows to fit); left and up stop at the start. */
  const EDGE = 56;
  const autoRef = useRef<{ raf: number; x: number; y: number; ex: number; ey: number } | null>(null);

  function startAuto(el: HTMLElement, x: number, y: number, apply: () => void, vertical: boolean) {
    stopAuto();
    const scroller = el.closest(".doc-wrap") as HTMLElement | null;
    const a = { raf: 0, x, y, ex: 0, ey: 0 };
    autoRef.current = a;
    if (!scroller) return;   // boards and the Muṣḥaf canvas pan instead
    const speed = (over: number) => Math.min(24, 4 + over / 3);
    const tick = () => {
      if (autoRef.current !== a) return;
      const r = scroller.getBoundingClientRect();
      let sx = a.x > r.right - EDGE ? speed(a.x - (r.right - EDGE)) : a.x < r.left + EDGE ? -speed(r.left + EDGE - a.x) : 0;
      let sy = !vertical ? 0 : a.y > r.bottom - EDGE ? speed(a.y - (r.bottom - EDGE)) : a.y < r.top + EDGE ? -speed(r.top + EDGE - a.y) : 0;
      if (sx < 0 && scroller.scrollLeft <= 0) sx = 0;
      if (sy < 0 && scroller.scrollTop <= 0) sy = 0;
      if (sx || sy) {
        // Grow first, then scroll: the sheet is only as wide as what is on it.
        a.ex += sx; a.ey += sy;
        apply();
        scroller.scrollBy(sx, sy);
      }
      a.raf = requestAnimationFrame(tick);
    };
    a.raf = requestAnimationFrame(tick);
  }

  function stopAuto() {
    if (autoRef.current) cancelAnimationFrame(autoRef.current.raf);
    autoRef.current = null;
  }

  // ── Drag (grip handle) ──────────────────────────────────────────────────

  function applyDrag() {
    const d = dragRef.current, a = autoRef.current;
    if (!d || !a) return;
    setPos({
      x: d.startX + (a.x - d.startMx + a.ex) / d.zoom,
      y: d.startY + (a.y - d.startMy + a.ey) / d.zoom,
    });
  }

  function onGripDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Drag deltas map 1:1 to canvas-space units at any zoom level.
    const zoom = zoomAt(e.currentTarget as HTMLElement);
    dragRef.current = { startMx: e.clientX, startMy: e.clientY, startX: pos.x, startY: pos.y, zoom };
    startAuto(e.currentTarget as HTMLElement, e.clientX, e.clientY, applyDrag, true);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  }

  function onGripMove(e: React.PointerEvent) {
    const a = autoRef.current;
    if (!dragRef.current || !a) return;
    a.x = e.clientX; a.y = e.clientY;
    applyDrag();
  }

  function onGripUp() {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    stopAuto();
    if (isTemp) return; // geometry persists with the server note
    fetch(`/api/notes/${note.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ offsetX: posRef.current.x, offsetY: posRef.current.y }),
    }).catch(() => {});
  }

  // ── Resize (either side) ────────────────────────────────────────────────
  /* The box could only be widened from its bottom-right corner (CSS resize),
     a few pixels you had to find. Both whole sides are handles now. The left
     one keeps the right edge where it is, so it moves the box as it widens. */
  const sizeRef = useRef<{ side: "left" | "right"; startMx: number; startW: number; startX: number; zoom: number } | null>(null);

  function applySize() {
    const r = sizeRef.current, a = autoRef.current;
    if (!r || !a) return;
    const dx = (a.x - r.startMx + a.ex) / r.zoom;
    const w = Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, r.startW + (r.side === "right" ? dx : -dx))));
    setWidth(w);
    if (r.side === "left") setPos((p) => ({ ...p, x: r.startX + (r.startW - w) }));
  }

  function onSideDown(side: "left" | "right", e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    sizeRef.current = { side, startMx: e.clientX, startW: width, startX: pos.x, zoom: zoomAt(e.currentTarget as HTMLElement) };
    startAuto(e.currentTarget as HTMLElement, e.clientX, e.clientY, applySize, false);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  }

  function onSideMove(e: React.PointerEvent) {
    const a = autoRef.current;
    if (!sizeRef.current || !a) return;
    a.x = e.clientX; a.y = e.clientY;
    applySize();
  }

  function onSideUp() {
    const r = sizeRef.current;
    if (!r) return;
    sizeRef.current = null;
    stopAuto();
    // The width is saved by the ResizeObserver above; a left-side drag also moved the box.
    if (isTemp || r.side !== "left") return;
    fetch(`/api/notes/${note.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ offsetX: posRef.current.x }),
    }).catch(() => {});
  }

  // Never leave a scroll loop running after the box goes away.
  useEffect(() => () => stopAuto(), []);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      ref={boxRef}
      className="free-textbox"
      data-focused={focused ? "true" : "false"}
      data-empty={empty ? "true" : "false"}
      style={{ left: pos.x, top: pos.y, width }}
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

      {!empty && (["left", "right"] as const).map((side) => (
        <span
          key={side}
          className="free-textbox-side"
          data-side={side}
          aria-hidden
          onPointerDown={(e) => onSideDown(side, e)}
          onPointerMove={onSideMove}
          onPointerUp={onSideUp}
          onPointerCancel={onSideUp}
        />
      ))}
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
  /**
   * Content typed but not yet CONFIRMED saved. Cleared only on a 2xx.
   *
   * Autosave used to be a bare debounced fetch whose failure was swallowed and
   * whose pending timer was cleared on unmount — so text typed in the 900ms
   * before navigating to another surah, closing the panel or switching mode
   * was discarded before it was ever sent. Destroying a TipTap editor emits
   * "destroy" and then removeAllListeners(); it never emits "blur", so the
   * commit-on-blur path could not cover it either.
   *
   * Holding the content here instead of relying on the editor means the flush
   * still works after the editor is gone.
   */
  const pendingRef     = useRef<object | null>(null);

  // Surah being studied + verses on this page — for the tafsir verse picker
  // (same context the main editor reads; falls back to surah 1 on boards).
  const ectx       = useEditorCtxOptional();
  const studySurah = ectx?.surahNumber || 1;
  const workspaceId = ectx?.workspaceId ?? "";
  const pageVerses = ectx?.verses ?? [];

  // Verse picker: opened when a tafsir command — or, in ayahInline mode, the
  // /ayah command — is chosen WITHOUT a verse key, so the user picks the āyah
  // within the surah they're studying. `kind` decides what gets inserted on
  // confirm: a tafsir block, or the verse's plain Arabic + translation text.
  /* /ayah opens the SAME whole-Qur'an search the main editor uses. It used to
     open TafsirVersePicker, which only lists ayat of the surah being studied —
     so on the canvas you could not reach a verse outside it. The two surfaces
     are the same command and must reach the same place. */
  const [ayahSearch, setAyahSearch] = useState<{
    range: { from: number; to: number }; rect: DOMRect;
  } | null>(null);

  const [versePicker, setVersePicker] = useState<{
    kind: "tafsir" | "ayah";
    slug: string; sourceName: string; range: { from: number; to: number }; rect: DOMRect;
  } | null>(null);

  // Fresh values inside editor callbacks (created once, closures go stale)
  const noteRef = useRef(note);
  noteRef.current = note;
  const cbRef = useRef({ onFocusChange, onEmptyChange, onUpdated, onDelete, onPersistTemp });
  cbRef.current = { onFocusChange, onEmptyChange, onUpdated, onDelete, onPersistTemp };

  /**
   * Send whatever is pending. Survives the page being torn down.
   *
   * `keepalive` is what lets the request outlive the document, so a flush
   * fired from pagehide or from unmount-during-navigation still arrives.
   * A failure keeps pendingRef set and retries once, matching what the drawing
   * layer already does — before, one dropped request meant the edit was gone
   * with nothing on screen to say so.
   */
  const flush = useCallback((opts: { keepalive?: boolean; retry?: boolean } = {}) => {
    const { keepalive = false, retry = true } = opts;
    const json = pendingRef.current;
    const cur  = noteRef.current;
    if (!json) return;

    /* A container that has never reached the server is CREATED, not patched.
       Without this branch, typing a new note and navigating away before
       blurring lost it outright — it existed only in React state. The
       create-once guard is the same one commit() uses, so a blur followed by
       an unmount cannot POST twice. */
    if (cur.id.startsWith("temp-")) {
      if (persistedRef.current) return;
      persistedRef.current = true;
      cbRef.current.onPersistTemp?.(cur.id, json, { x: posRef.current.x, y: posRef.current.y });
      return;
    }

    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }

    fetch(`/api/notes/${cur.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ content: json }),
      keepalive,
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        /* Only clear if nothing newer arrived while this was in flight —
           otherwise a slow success would mark later keystrokes as saved. */
        if (pendingRef.current === json) pendingRef.current = null;
      })
      .catch(() => {
        if (retry && pendingRef.current === json) {
          saveTimer.current = setTimeout(() => flush({ retry: false }), 3000);
        }
      });
  }, []);

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

    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    pendingRef.current = json;   // stays set until the server confirms
    fetch(`/api/notes/${cur.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ content: json }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { note?: NoteData } | null) => {
        if (pendingRef.current === json) pendingRef.current = null;
        if (d?.note) cbRef.current.onUpdated?.(d.note);
      })
      /* Leave pendingRef set on failure so the unmount / pagehide flush and
         the retry below still have the text. Losing a blur-save used to be
         silent AND permanent: the poll would then overwrite the editor with
         the older server copy. */
      .catch(() => {
        if (pendingRef.current === json) {
          saveTimer.current = setTimeout(() => flush({ retry: false }), 3000);
        }
      });
  }, [posRef, flush]);

  const editor = useEditor({
    extensions: [
      /* The shared set. History stays ON here — these boxes are standalone,
         with no Yjs to own undo. */
      ...baseExtensions({
        history: true,
        /* Nothing: clicking the page should give a caret and no more. The
           slash palette is still there the moment "/" is typed. */
        placeholder: "",
        workspaceId,
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
      /* Recorded BEFORE the debounce, and for temps too, so an unmount or a
         tab close inside the 900ms window still has something to save. A
         brand-new container is the most valuable thing here — it exists only
         in memory until its first POST lands. */
      pendingRef.current = editor.isEmpty ? null : editor.getJSON();
      // Temps are created, not patched: they persist via onPersistTemp.
      if (noteRef.current.id.startsWith("temp-")) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flush(), 900);
    },

    onFocus({ editor }) { cbRef.current.onFocusChange(true); announceFocus(editor); },

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

  /* /link, from the shared hook — same four-step flow, same rules, as the main
     editor. It was written twice before, which is how the canvas ended up with
     a version that inserted a node its own schema could not hold. */
  const { openLink, linkUI } = useConnectionLink({ editor, workspaceId, currentSurah: studySurah });

  /* Unmount FLUSHES rather than discarding. This cleanup used to be a bare
     clearTimeout, which is what made "typed, navigated, lost it" possible:
     the pending PATCH was cancelled and, because destroying the editor never
     emits blur, commit() never ran either. */
  useEffect(() => () => { flush({ keepalive: true }); }, [flush]);

  /* …and the browser going away is the same event as far as the note is
     concerned. pagehide covers closing the tab and the iOS back-forward
     cache; visibilitychange covers switching app or tab, which on mobile is
     usually the last callback that runs before the page is frozen. The main
     editor and the drawing layer already do this; notes did not. */
  useEffect(() => {
    const onHide = () => flush({ keepalive: true });
    const onVis  = () => { if (document.visibilityState === "hidden") onHide(); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [flush]);

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
        // A run ("/a 2:1-5") is checked first: its start would also match keyMatch.
        const run = parseRange(q.replace(/^\S+\s*/, ""));
        if (run) insertAyahRunInline(run.surah, run.from, run.to, range);
        else if (keyMatch) insertAyahInline(keyMatch[0], range);
        else setAyahSearch({ range, rect: palette.rect });
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

      /* /link is intercepted, never executed — its execute() is deliberately
         empty because the command needs the editor's source context and an
         async target search. Asking for the SOURCE first: a Connection whose
         origin nobody chose is not a munasaba anyone asserted. */
      if (item.id === "link") {
        openLink(range, palette.rect);
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

  /* A run as plain text, the same shape as one āyah: the Arabic as one
     passage with each verse closed by its number, then the translation verse
     by verse. One request for the surah rather than one per āyah. */
  const insertAyahRunInline = useCallback((surah: number, from: number, to: number, range: { from: number; to: number }) => {
    if (!editor) return;
    const ref = `${surah}:${from}–${to}`;
    editor.chain().focus().deleteRange(range).run();
    const at = editor.state.selection.from;
    editor.chain().insertContent(`⏳ ${ref}…`).run();
    const end = editor.state.selection.from;

    fetch(`/api/quran/surah/${surah}/verses`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ verses }: { verses: { ayah: number; arabic: string; translation?: string }[] }) => {
        const run = verses.filter((v) => v.ayah >= from && v.ayah <= to);
        if (!run.length) throw new Error("empty");
        const ar = run.map((v) => `${v.arabic.trim()} ﴿${surah}:${v.ayah}﴾`).join(" ");
        const content: object[] = [{ type: "paragraph", content: [{ type: "text", text: ar }] }];
        for (const v of run) {
          if (v.translation) content.push({ type: "paragraph", content: [{ type: "text", text: `(${v.ayah}) ${v.translation}` }] });
        }
        content.push({ type: "paragraph" });
        editor.chain().focus().insertContentAt({ from: at, to: end }, content).scrollIntoView().run();
      })
      .catch(() => {
        editor.chain().focus().insertContentAt({ from: at, to: end }, `/a ${surah}:${from}-${to}`).run();
      });
  }, [editor]);

  /* Until TipTap has mounted, paint the stored document statically in the same
     typography classes the editor uses. `immediatelyRender` has to stay false
     (notes are seeded from server-rendered page data, so TipTap's own DOM would
     not match on hydration) — which otherwise leaves every box EMPTY while
     fifteen extensions build a schema. On a canvas of notes that is several
     ProseMirror instances in series, and a box that sits blank then pops reads
     as "my note is gone", not "my note is loading".

     Both layers are the same text in the same place, so the handover has
     nothing to see. */
  const showStatic = !editor && !docIsEmpty(note.content);

  return (
    <>
      {showStatic && (
        <div className="page-editor-content free-textbox-richbody" aria-hidden>
          <StaticDoc content={note.content} />
        </div>
      )}
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
      {ayahSearch && typeof document !== "undefined" &&
        createPortal(
          (() => {
            const W = 380, MAX_H = 400;
            const left = Math.max(8, Math.min(ayahSearch.rect.left, window.innerWidth - W - 12));
            const below = window.innerHeight - ayahSearch.rect.bottom;
            const openUp = below < MAX_H + 12 && ayahSearch.rect.top > below;
            const pos: React.CSSProperties = openUp
              ? { position: "fixed", bottom: window.innerHeight - ayahSearch.rect.top + 6, left, zIndex: 9999 }
              : { position: "fixed", top: ayahSearch.rect.bottom + 6, left, zIndex: 9999 };
            return (
              <div style={pos}>
                <QuranSearch
                  kinds={["ayah"]}
                  ranges
                  onSelect={(t: SearchTarget) => {
                    const { range } = ayahSearch;
                    setAyahSearch(null);
                    if (t.surah != null && t.ayah != null && t.ayahEnd != null && t.ayahEnd > t.ayah) {
                      insertAyahRunInline(t.surah, t.ayah, t.ayahEnd, range);
                    } else if (t.surah != null && t.ayah != null) {
                      insertAyahInline(`${t.surah}:${t.ayah}`, range);
                    }
                  }}
                  onCancel={() => setAyahSearch(null)}
                />
              </div>
            );
          })(),
          document.body,
        )}

      {linkUI}

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
