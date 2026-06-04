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
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";

import { AyahBlockExtension } from "./AyahBlockExtension";
import { TafsirBlockExtension } from "./TafsirBlockExtension";
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
const PARTYKIT_HOST    =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999")
    : "localhost:1999";

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  pageId:           string;
  initialContent:   unknown;
  currentUserId:    string;
  currentUserName:  string;
  roomSocket?:      import("partysocket").default | null;
  onEditorReady?:   (editor: Editor | null) => void;
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
}: Props) {
  const [palette, setPalette] = useState<PaletteState | null>(null);
  const commandListRef        = useRef<CommandListHandle>(null);
  const ALL_COMMANDS          = useRef(buildCommands());
  const saveTimer             = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Yjs document + PartyKit provider ─────────────────────────────────
  // Stable across re-renders; recreated only when pageId changes.
  const ydocRef    = useRef<Y.Doc | null>(null);
  const providerRef = useRef<YPartyKitProvider | null>(null);

  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }

  useEffect(() => {
    const ydoc = ydocRef.current!;

    const provider = new YPartyKitProvider(PARTYKIT_HOST, pageId, ydoc, {
      connect: true,
    });
    providerRef.current = provider;

    // If the Yjs doc is empty on first sync, seed it from the DB content.
    // This handles the transition from the old debounced-PATCH model.
    provider.once("sync", (synced: boolean) => {
      if (!synced) return;
      const ytext = ydoc.getText("content");
      if (ytext.length === 0 && initialContent) {
        // The Collaboration extension owns the Y.XmlFragment "default".
        // We can't set it from raw TipTap JSON here without the editor
        // instance, so we leave this to the editor's onCreate handler below.
      }
    });

    return () => {
      provider.destroy();
      providerRef.current = null;
    };
  // pageId change = new room; initialContent is stable per page mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

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
        includeChildren: true,
      }),

      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,

      AyahBlockExtension,
      TafsirBlockExtension,

      // ── Collaboration (Yjs CRDT) ──────────────────────────────────────
      Collaboration.configure({
        document: ydocRef.current!,
      }),

      // ── Collaboration cursors ─────────────────────────────────────────
      CollaborationCursor.configure({
        provider: providerRef.current ?? undefined,
        user: {
          name:  currentUserName || "Anonymous",
          color: getUserColor(currentUserId),
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

    // When the Yjs doc is empty (first ever load), seed from DB content.
    // Once seeded, Yjs owns the document — subsequent loads come from the
    // synced Yjs state, not from initialContent.
    content: ydocRef.current!.getText("content").length === 0
      ? ((initialContent as object | null) ?? { type: "doc", content: [{ type: "paragraph" }] })
      : undefined,

    autofocus:         "end",
    immediatelyRender: false,

    onCreate({ editor }) {
      // If doc was seeded from initialContent, the Yjs doc is now populated.
      // Trigger an initial save snapshot.
      scheduleSave(editor);
    },

    onUpdate({ editor }) {
      scheduleSave(editor);
    },

    editorProps: {
      attributes: { class: "page-editor-content", spellcheck: "true" },
    },
  });

  // Update CollaborationCursor user info when provider becomes available
  useEffect(() => {
    if (!editor || !providerRef.current) return;
    editor.commands.updateUser?.({
      name:  currentUserName || "Anonymous",
      color: getUserColor(currentUserId),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, currentUserName, currentUserId]);

  // ── Expose editor to parent ────────────────────────────────────────────

  const onEditorReadyRef = useRef(onEditorReady);
  useEffect(() => { onEditorReadyRef.current = onEditorReady; }, [onEditorReady]);
  useEffect(() => {
    onEditorReadyRef.current?.(editor);
    return () => { onEditorReadyRef.current?.(null); };
  }, [editor]);

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
    <div className="page-editor">
      <EditorContent editor={editor} />
      <SelectionToolbar editor={editor} />

      {palette &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="slash-palette-anchor"
            style={{ position: "fixed", top: palette.rect.bottom + 6, left: palette.rect.left, zIndex: 9999 }}
          >
            <CommandList ref={commandListRef} items={palette.items} query={palette.query} onSelect={handleSelect} />
          </div>,
          document.body,
        )}
    </div>
  );
}
