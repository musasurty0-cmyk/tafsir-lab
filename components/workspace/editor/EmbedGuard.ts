/**
 * An embedded āyah, tafsīr passage or Connection is not deleted by one stray key.
 *
 * ProseMirror's own Backspace at the start of a line deletes an atom block
 * just above it outright, and Delete at the end of a line does the same below.
 * An embed can be a run of āyāt or a passage chosen from a commentary, so one
 * key too many while tidying a line threw it away. Now the first press
 * selects the embed (its outline shows), and a second press deletes it, as in
 * Notion or Google Docs. An empty line between the caret and the embed goes
 * on the first press, so Backspace after inserting one still walks back.
 */

import { Extension } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

const EMBEDS = new Set(["ayahBlock", "tafsirBlock", "connectionBlock"]);

export const EmbedGuard = Extension.create({
  name: "embedGuard",
  // Ahead of the default Backspace/Delete, which would delete the embed.
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        if (!selection.empty) return false;
        const $from = selection.$from;
        if ($from.parentOffset !== 0 || !$from.parent.isTextblock) return false;
        const depth = $from.depth - 1;
        const index = $from.index(depth);
        if (index === 0) return false;
        const before = $from.node(depth).child(index - 1);
        if (!EMBEDS.has(before.type.name)) return false;
        const blockStart = $from.before();
        const embedPos = blockStart - before.nodeSize;
        const tr = state.tr;
        // An empty line under the embed goes, and the embed is selected.
        if ($from.parent.content.size === 0) tr.delete(blockStart, blockStart + $from.parent.nodeSize);
        tr.setSelection(NodeSelection.create(tr.doc, embedPos));
        editor.view.dispatch(tr.scrollIntoView());
        return true;
      },
      Delete: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        if (!selection.empty) return false;
        const $from = selection.$from;
        if (!$from.parent.isTextblock || $from.parentOffset !== $from.parent.content.size) return false;
        const depth = $from.depth - 1;
        const index = $from.index(depth);
        const parent = $from.node(depth);
        if (index + 1 >= parent.childCount) return false;
        const after = parent.child(index + 1);
        if (!EMBEDS.has(after.type.name)) return false;
        editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, $from.after())).scrollIntoView());
        return true;
      },
    };
  },
});
