"use client";

/**
 * PageEditor — TipTap free-writing editor for Mode A.
 *
 * Extensions active:
 *   StarterKit        — paragraph, heading 1-3, blockquote, bold, italic,
 *                       bullet/ordered list, horizontal rule, undo/redo.
 *   Placeholder       — "Type '/' for commands…" hint.
 *   AyahBlockExtension — custom node for embedded verses.
 *   SlashCommandExtension — "/" triggers the command palette.
 *
 * Collaborative cursors:
 *   Remote users' cursors are rendered as React overlays (position:fixed)
 *   positioned with editor.view.coordsAtPos().  This approach works
 *   independently of TipTap's internal dispatch cycle — the overlay always
 *   reflects the latest poll without needing ProseMirror to re-render.
 *
 * Content persistence:
 *   Debounced PATCH to /api/pages/[pageId]/content on every editor update.
 *   Initial content comes from page.tiptapContent (server-fetched).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";

import { AyahBlockExtension } from "./AyahBlockExtension";
import {
  SlashCommandExtension,
  buildCommands,
  filterCommands,
  type SlashCommandItem,
} from "./SlashCommand";
import CommandList, { type CommandListHandle } from "./CommandList";
import { getUserColor } from "./RemoteCursorsExtension";

// ── Constants ─────────────────────────────────────────────────────────────

const SAVE_DEBOUNCE_MS    = 900;
const CURSOR_SEND_DEBOUNCE = 300; // ms debounce before posting own cursor
const CURSOR_POLL_MS      = 1800; // ms between polling remote cursors

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  pageId:         string;
  initialContent: unknown;
  currentUserId:  string;
}

interface RemoteCursorData {
  userId: string;
  name:   string;
  color:  string;
  from:   number;
  to:     number;
}

interface PresenceUser {
  userId:     string;
  isTyping:   boolean;
  cursorFrom: number | null;
  cursorTo:   number | null;
  user: { id: string; name: string; avatarUrl: string | null };
}

interface CursorOverlay {
  userId:   string;
  name:     string;
  color:    string;
  // caret line  (viewport coords — safe for position:fixed)
  caretLeft:   number;
  caretTop:    number;
  caretHeight: number;
  // selection highlight rects (viewport coords)
  selRects: Array<{ left: number; top: number; width: number; height: number }>;
}

// ── Slash command portal state ────────────────────────────────────────────

interface PaletteState {
  items:   SlashCommandItem[];
  query:   string;
  rect:    DOMRect;
  props:   SuggestionProps;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function computeOverlays(
  editor: Editor,
  cursors: RemoteCursorData[],
): CursorOverlay[] {
  const maxPos = editor.state.doc.content.size;
  const out: CursorOverlay[] = [];

  for (const c of cursors) {
    try {
      const from = Math.max(1, Math.min(c.from, maxPos - 1));
      const to   = Math.max(from, Math.min(c.to,   maxPos - 1));

      const caretCoords = editor.view.coordsAtPos(to);

      // Selection highlight rects using a DOM Range
      const selRects: CursorOverlay["selRects"] = [];
      if (from !== to) {
        try {
          const range   = document.createRange();
          const fromDom = editor.view.domAtPos(from);
          const toDom   = editor.view.domAtPos(to);
          range.setStart(fromDom.node, fromDom.offset);
          range.setEnd(toDom.node, toDom.offset);
          for (const r of Array.from(range.getClientRects())) {
            if (r.width > 0)
              selRects.push({ left: r.left, top: r.top, width: r.width, height: r.height });
          }
        } catch { /* cross-node ranges can throw — skip highlight */ }
      }

      out.push({
        userId:      c.userId,
        name:        c.name,
        color:       c.color,
        caretLeft:   caretCoords.left,
        caretTop:    caretCoords.top,
        caretHeight: caretCoords.bottom - caretCoords.top,
        selRects,
      });
    } catch { /* coordsAtPos can throw for out-of-range positions */ }
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function PageEditor({ pageId, initialContent, currentUserId }: Props) {
  const [palette, setPalette]   = useState<PaletteState | null>(null);
  const commandListRef          = useRef<CommandListHandle>(null);
  const ALL_COMMANDS            = useRef(buildCommands());

  // ── Timers ────────────────────────────────────────────────────────────
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Remote cursors ────────────────────────────────────────────────────
  // Stored in a ref so polling callbacks always see latest without
  // triggering extra renders.
  const remoteCursorsRef    = useRef<RemoteCursorData[]>([]);
  const [cursorOverlays, setCursorOverlays] = useState<CursorOverlay[]>([]);

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
    [pageId]
  );

  useEffect(() => () => {
    if (saveTimer.current)   clearTimeout(saveTimer.current);
    if (cursorTimer.current) clearTimeout(cursorTimer.current);
  }, []);

  // ── TipTap editor ─────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading:        { levels: [1, 2, 3] },
        horizontalRule: {},
      }),

      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Heading…";
          return "Type '/' for commands, or start writing…";
        },
        includeChildren: true,
      }),

      AyahBlockExtension,

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
                setPalette({
                  items: props.items as SlashCommandItem[],
                  query: props.query,
                  rect:  props.clientRect() as DOMRect,
                  props,
                });
              },
              onUpdate(props: SuggestionProps) {
                if (!props.clientRect) return;
                setPalette({
                  items: props.items as SlashCommandItem[],
                  query: props.query,
                  rect:  props.clientRect() as DOMRect,
                  props,
                });
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

    content:          (initialContent as object | null) ?? { type: "doc", content: [{ type: "paragraph" }] },
    autofocus:        "end",
    immediatelyRender: false,

    onUpdate({ editor }) {
      scheduleSave(editor);
      // Recompute cursor overlay positions whenever local doc changes
      // so remote carets stay glued to the right words.
      if (remoteCursorsRef.current.length > 0) {
        setCursorOverlays(computeOverlays(editor, remoteCursorsRef.current));
      }
    },

    onSelectionUpdate({ editor }) {
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
      cursorTimer.current = setTimeout(() => {
        const { from, to } = editor.state.selection;
        fetch(`/api/pages/${pageId}/presence`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ isTyping: true, cursorFrom: from, cursorTo: to }),
        }).catch(() => {});
      }, CURSOR_SEND_DEBOUNCE);
    },

    editorProps: {
      attributes: { class: "page-editor-content", spellcheck: "true" },
    },
  });

  // ── Poll remote cursors ───────────────────────────────────────────────
  // This useEffect doesn't depend on `editor` — it runs once on mount
  // and uses a callback ref to access the editor without stale closures.
  const editorRef = useRef<Editor | null>(null);
  useEffect(() => { editorRef.current = editor; }, [editor]);

  useEffect(() => {
    function poll() {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/pages/${pageId}/presence`)
        .then((r) => r.ok ? r.json() : null)
        .then((data: { presence?: PresenceUser[] } | null) => {
          if (!data?.presence) return;

          const cursors: RemoteCursorData[] = data.presence
            .filter((p) => p.user?.id !== currentUserId && p.cursorFrom != null)
            .map((p) => ({
              userId: p.user.id,
              name:   p.user.name,
              color:  getUserColor(p.user.id),
              from:   p.cursorFrom!,
              to:     p.cursorTo ?? p.cursorFrom!,
            }));

          // Always update the ref so onUpdate callbacks use fresh data
          remoteCursorsRef.current = cursors;

          // Recompute overlays now (editor may or may not be ready)
          const ed = editorRef.current;
          if (ed && !ed.isDestroyed) {
            setCursorOverlays(computeOverlays(ed, cursors));
          } else {
            // Editor not ready yet — clear overlays
            setCursorOverlays([]);
          }
        })
        .catch(() => {});
    }

    poll();
    const interval = setInterval(poll, CURSOR_POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
    };
  // pageId and currentUserId are stable across navigations
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, currentUserId]);

  // ── Recompute overlay positions on scroll (keeps carets in sync) ──────
  useEffect(() => {
    function onScroll() {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed || remoteCursorsRef.current.length === 0) return;
      setCursorOverlays(computeOverlays(ed, remoteCursorsRef.current));
    }
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  // ── Initial overlay computation once editor is ready ─────────────────
  useLayoutEffect(() => {
    if (!editor || remoteCursorsRef.current.length === 0) return;
    setCursorOverlays(computeOverlays(editor, remoteCursorsRef.current));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // ── Palette item selection ────────────────────────────────────────────
  const handleSelect = useCallback(
    (item: SlashCommandItem) => {
      if (!palette) return;
      (item as SlashCommandItem & { _query: string })._query = palette.query;
      palette.props.command({ ...(item as object) });
      setPalette(null);
    },
    [palette]
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="page-editor">
      <EditorContent editor={editor} />

      {/* Remote cursor overlays — rendered into document.body so they
          sit above everything at the correct viewport coordinates */}
      {cursorOverlays.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {cursorOverlays.map((c) => (
              <div key={c.userId} className="rc-cursor-root" style={{ "--rc-color": c.color } as React.CSSProperties}>
                {/* Selection highlight spans */}
                {c.selRects.map((r, i) => (
                  <div
                    key={i}
                    className="rc-sel"
                    style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
                  />
                ))}
                {/* Caret line + name label */}
                <div
                  className="rc-caret"
                  style={{ left: c.caretLeft, top: c.caretTop, height: c.caretHeight }}
                >
                  <span className="rc-label">{c.name.split(" ")[0]}</span>
                </div>
              </div>
            ))}
          </>,
          document.body
        )}

      {/* Slash command palette */}
      {palette &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="slash-palette-anchor"
            style={{ position: "fixed", top: palette.rect.bottom + 6, left: palette.rect.left, zIndex: 9999 }}
          >
            <CommandList ref={commandListRef} items={palette.items} query={palette.query} onSelect={handleSelect} />
          </div>,
          document.body
        )}
    </div>
  );
}
