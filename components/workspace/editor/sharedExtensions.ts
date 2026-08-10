/**
 * The one extension list both editors are built from.
 *
 * TafsirLab has two editing surfaces — the main page editor and the free text
 * boxes on the canvas — and they were assembled independently from the same
 * ingredients. Every difference between them was therefore accidental, and
 * each one surfaced only when somebody tried the same thing in both places:
 *
 *   · /ayah on the canvas opened a surah-scoped picker, so a note there could
 *     not reach a verse outside the surah being studied
 *   · /link on the canvas did nothing at all — its command is deliberately
 *     inert and only PageEditor intercepted it
 *   · the canvas never loaded FontSize, so the size control failed silently
 *   · connectionBlock was registered only on the main editor, so the /link
 *     port would have inserted a node the canvas schema could not hold
 *
 * Four bugs, one cause. This module is the fix for the cause: the shared set
 * lives here once, and a surface may only ADD to it. Anything a surface adds
 * is a deliberate difference with a reason next to it, not a divergence
 * nobody noticed.
 *
 * The two genuine differences are parameters rather than forks. `history` is
 * off on the main editor because Yjs owns undo there and two undo stacks fight
 * each other; the canvas boxes are standalone and keep theirs. `placeholder`
 * differs because the main editor prompts per node type and a box does not.
 */

import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Color from "@tiptap/extension-color";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import type { Extensions } from "@tiptap/react";

import { AyahBlockExtension } from "./AyahBlockExtension";
import { TafsirBlockExtension } from "./TafsirBlockExtension";
import { ConnectionBlockExtension } from "./ConnectionBlockExtension";
import { ToggleListExtension } from "./ToggleListExtension";
import { TextDirection } from "./TextDirection";

export interface BaseEditorOptions {
  /**
   * StarterKit's undo stack. FALSE wherever Yjs is attached — Collaboration
   * brings its own history and running both means an undo can be applied twice.
   */
  history: boolean;
  /** A string, or a function for per-node-type prompting. */
  placeholder: string | ((ctx: { node: { type: { name: string } } }) => string);
  /** The drop line shown while dragging a block. Main editor only. */
  dropcursor?: boolean;
  /** Connection cards store only an id; the extension needs the workspace to
   *  fetch the record. Both surfaces create Connections, so both need it. */
  workspaceId: string;
}

/**
 * Everything both surfaces share. A caller spreads this and appends what is
 * genuinely its own — Yjs, tables and block-drag on the main editor; nothing
 * so far on the canvas.
 */
export function baseExtensions(o: BaseEditorOptions): Extensions {
  return [
    StarterKit.configure({
      history:        o.history === false ? false : undefined,
      heading:        { levels: [1, 2, 3] },
      horizontalRule: {},
      /* Accent rather than the default black, so the drop target reads as part
         of the app rather than a browser default. */
      ...(o.dropcursor ? { dropcursor: { color: "var(--accent)", width: 2 } } : {}),
    } as Parameters<typeof StarterKit.configure>[0]),

    Placeholder.configure({
      placeholder: o.placeholder,
      /* includeChildren stacked a placeholder on the list, the list item AND
         the inner paragraph at once, rendering doubled ghost text. */
      includeChildren: false,
    }),

    Underline,
    Highlight.configure({ multicolor: true }),
    TextStyle,
    FontFamily,
    /* Size rides the same textStyle mark as colour and family, so a run can
       carry all three and they round-trip through the stored HTML together. */
    FontSize,
    Color,
    Subscript,
    Superscript,
    Link.configure({
      openOnClick:    false,   // click edits; Ctrl/Cmd-click opens
      autolink:       true,
      linkOnPaste:    true,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),

    /* The Qur'anic block widgets. connectionBlock belongs here rather than on
       the main editor alone: /link now runs on both surfaces, and a schema
       without the node silently drops the card it inserts. */
    AyahBlockExtension,
    TafsirBlockExtension,
    ConnectionBlockExtension.configure({ workspaceId: o.workspaceId }),
    ToggleListExtension,
    TextDirection,
  ];
}
