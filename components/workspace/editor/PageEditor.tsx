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
 * Content persistence:
 *   Debounced PATCH to /api/pages/[pageId]/content on every editor update.
 *   Initial content comes from page.tiptapContent (server-fetched).
 *
 * Slash command wiring:
 *   @tiptap/suggestion renders a floating <CommandList> via ReactDOM.createPortal.
 *   The portal is positioned by the clientRect of the cursor.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  RemoteCursorsExtension,
  setRemoteCursors,
  getUserColor,
  type RemoteCursor,
} from "./RemoteCursorsExtension";

// ── Constants ─────────────────────────────────────────────────────────────

const SAVE_DEBOUNCE_MS = 900;

const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  pageId:         string;
  initialContent: unknown; // page.tiptapContent from DB (JSON or null)
  currentUserId:  string;
}

// ── Presence types ────────────────────────────────────────────────────────

interface PresenceUser {
  userId:    string;
  isTyping:  boolean;
  cursorFrom: number | null;
  cursorTo:   number | null;
  user: { id: string; name: string; avatarUrl: string | null };
}

const CURSOR_SEND_DEBOUNCE = 400;  // ms — how often we POST our own cursor
const CURSOR_POLL_INTERVAL = 1800; // ms — how often we poll remote cursors

// ── Slash command portal state ────────────────────────────────────────────

interface PaletteState {
  items:   SlashCommandItem[];
  query:   string;
  rect:    DOMRect;
  props:   SuggestionProps;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function PageEditor({ pageId, initialContent, currentUserId }: Props) {
  const [palette, setPalette]   = useState<PaletteState | null>(null);
  const commandListRef          = useRef<CommandListHandle>(null);
  const ALL_COMMANDS            = useRef(buildCommands());

  // ── Save helper ───────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cursor send debounce ──────────────────────────────────────────────
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        heading:         { levels: [1, 2, 3] },
        horizontalRule:  {},
        // Keep undo/redo from StarterKit (History is included).
      }),

      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Heading…";
          return "Type '/' for commands, or start writing…";
        },
        includeChildren: true,
      }),

      AyahBlockExtension,
      RemoteCursorsExtension,

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
                if (event.key === "Escape") {
                  setPalette(null);
                  return true;
                }
                return commandListRef.current?.onKeyDown(event) ?? false;
              },

              onExit() {
                setPalette(null);
              },
            };
          },

          command({ editor, range, props }: {
            editor: Editor;
            range:  { from: number; to: number };
            props:  unknown;
          }) {
            const item  = props as SlashCommandItem & { _query: string };
            const query = item._query ?? "";
            item.execute(editor, range, query);
          },
        },
      }),
    ],

    content:          (initialContent as object | null) ?? EMPTY_DOC,
    autofocus:        "end",
    immediatelyRender: false,

    onUpdate({ editor }) {
      scheduleSave(editor);
    },

    onSelectionUpdate({ editor }) {
      // Debounce cursor position POST so we don't spam the API on every keystroke
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
      attributes: {
        class: "page-editor-content",
        spellcheck: "true",
      },
    },
  });

  // ── Palette item selection ────────────────────────────────────────────
  const handleSelect = useCallback(
    (item: SlashCommandItem) => {
      if (!palette) return;
      const { props } = palette;
      // Attach the query so execute() can parse params like the verse key.
      (item as SlashCommandItem & { _query: string })._query = palette.query;
      props.command({ ...(item as object) });
      setPalette(null);
    },
    [palette]
  );

  // ── Poll remote cursors and apply decorations ─────────────────────────
  useEffect(() => {
    if (!editor || !pageId) return;

    function poll() {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/pages/${pageId}/presence`)
        .then((r) => r.ok ? r.json() : null)
        .then((data: { presence?: PresenceUser[] } | null) => {
          if (!data?.presence || !editor || editor.isDestroyed) return;
          const cursors: RemoteCursor[] = data.presence
            .filter((p) => p.user?.id !== currentUserId && p.cursorFrom != null)
            .map((p) => ({
              userId: p.user.id,
              name:   p.user.name,
              color:  getUserColor(p.user.id),
              from:   p.cursorFrom!,
              to:     p.cursorTo ?? p.cursorFrom!,
            }));
          setRemoteCursors(editor, cursors);
        })
        .catch(() => {});
    }

    poll();
    const interval = setInterval(poll, CURSOR_POLL_INTERVAL);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, pageId, currentUserId]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="page-editor">
      <EditorContent editor={editor} />

      {/* Slash command palette — portaled to document.body for z-index freedom */}
      {palette &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="slash-palette-anchor"
            style={{
              position: "fixed",
              top:      palette.rect.bottom + 6,
              left:     palette.rect.left,
              zIndex:   9999,
            }}
          >
            <CommandList
              ref={commandListRef}
              items={palette.items}
              query={palette.query}
              onSelect={handleSelect}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
