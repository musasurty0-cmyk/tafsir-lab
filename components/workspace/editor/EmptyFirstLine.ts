/**
 * An empty first line can be deleted.
 *
 * Backspace at the very start of a note had nothing before it to join with,
 * and Delete there tried to join the next block in — a list item or heading,
 * which it would not swallow. So a note that began with a blank line (a paste
 * that started with one, or a note started a line down) kept it for good, and
 * the title underneath could never reach the top.
 *
 * Here, with the caret in an empty first block and more below it, Backspace
 * or Delete removes that line and puts the caret at the start of what was
 * underneath.
 */

import { Extension } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";

export const EmptyFirstLine = Extension.create({
  name: "emptyFirstLine",
  // Ahead of the default Backspace/Delete handling, which does nothing here.
  priority: 1000,

  addKeyboardShortcuts() {
    const removeIt = () => {
      const { state, view } = this.editor;
      const { selection, doc } = state;
      if (!selection.empty || doc.childCount < 2) return false;
      const $at = selection.$from;
      const first = doc.firstChild;
      if ($at.depth !== 1 || $at.index(0) !== 0 || !first?.isTextblock || first.content.size > 0) return false;
      const tr = state.tr.delete(0, first.nodeSize);
      tr.setSelection(Selection.atStart(tr.doc));
      view.dispatch(tr.scrollIntoView());
      return true;
    };
    return { Backspace: removeIt, Delete: removeIt };
  },
});
