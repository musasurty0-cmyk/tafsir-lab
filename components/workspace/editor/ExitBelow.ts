/**
 * A way out of the bottom of a note.
 *
 * A table or a toggle that ends a note had no line under it and no key that
 * made one: Down stayed in the last cell, Enter added another line inside the
 * toggle, and a click below starts a separate text box (which is right for a
 * click, but it is not the same note). The only way to carry on writing under
 * a table was to have left a blank line there beforehand.
 *
 * Down on the last line of such a block now opens a new line beneath it.
 *
 * Deliberately a key, not a line added automatically: the note is shared
 * live, and two people's editors each "fixing" the ending would add two.
 * Lists and quotes are left alone, since Enter on an empty line already
 * leaves them.
 */

import { Extension } from "@tiptap/core";
import { Selection, TextSelection } from "@tiptap/pm/state";

const TRAPS = new Set(["table", "toggleList"]);

export const ExitBelow = Extension.create({
  name: "exitBelow",
  // Ahead of the table's own arrow handling, which swallows the key.
  priority: 200,

  addKeyboardShortcuts() {
    return {
      ArrowDown: ({ editor }) => {
        if (!editor.isEditable) return false;
        const { state, view } = editor;
        const { selection, doc, schema } = state;
        if (!selection.empty || !(selection instanceof TextSelection)) return false;

        const last = doc.lastChild;
        if (!last || !TRAPS.has(last.type.name)) return false;

        // Only from the very last line of the note: its last text block, and
        // the last visual line of that block.
        const $from = selection.$from;
        const end = Selection.atEnd(doc).$from;
        if ($from.start() !== end.start()) return false;
        if (!view.endOfTextblock("down")) return false;

        const paragraph = schema.nodes.paragraph?.createAndFill();
        if (!paragraph) return false;
        const at = doc.content.size;
        const tr = state.tr.insert(at, paragraph);
        tr.setSelection(TextSelection.create(tr.doc, at + 1)).scrollIntoView();
        view.dispatch(tr);
        return true;
      },
    };
  },
});
