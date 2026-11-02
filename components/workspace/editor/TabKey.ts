/**
 * Tab inside a note stays inside the note.
 *
 * Outside a list or table nothing handled Tab, so the browser did: focus
 * jumped out of the editor, and everything typed after it went nowhere. A
 * student coming from OneNote presses Tab to indent a line and lost the next
 * sentence. Now Tab writes a tab at the caret and Shift+Tab takes back the
 * one before it.
 *
 * Low priority on purpose: lists (indent / outdent an item) and tables (next
 * cell) keep Tab for themselves and run first; this only catches what they
 * leave.
 */

import { Extension } from "@tiptap/core";

export const TabKey = Extension.create({
  name: "tabKey",
  priority: 50,

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (!editor.isEditable) return false;
        return editor.commands.insertContent("\t");
      },
      "Shift-Tab": ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        // Swallow it either way: Shift+Tab must not send focus out of the note.
        if (!empty || $from.parentOffset === 0) return true;
        const before = $from.parent.textBetween($from.parentOffset - 1, $from.parentOffset);
        if (before === "\t") editor.commands.deleteRange({ from: $from.pos - 1, to: $from.pos });
        return true;
      },
    };
  },
});
