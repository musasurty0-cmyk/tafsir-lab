/**
 * BlockMove — Alt+ArrowUp / Alt+ArrowDown moves the current top-level block.
 *
 * The keyboard counterpart to dragging a block by its handle: swap the block
 * under the caret with its neighbour in ONE transaction (one undo step, one
 * Yjs update), keeping the caret at the same offset inside the moved block so
 * repeated presses walk the block up or down the page.
 *
 * Whole blocks only — a selection spanning two top-level blocks does nothing
 * rather than doing something surprising.
 */

import { Extension } from "@tiptap/core";
import { TextSelection, NodeSelection } from "@tiptap/pm/state";
import { Fragment } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";

function moveBlock(editor: Editor, dir: -1 | 1): boolean {
  const { state } = editor;
  const sel = state.selection;
  const { $from, $to } = sel;

  /* Bounds of the top-level block the selection lives in. A NodeSelection of
     a top-level atom (ayah/tafsir block) has depth 0 and IS its own bounds;
     anything deeper resolves through depth 1. */
  let from: number, to: number;
  const isNodeSel = sel instanceof NodeSelection && $from.depth === 0;
  if (isNodeSel) {
    from = sel.from;
    to   = sel.to;
  } else {
    if ($from.depth === 0 || $to.depth === 0) return false;
    if ($from.index(0) !== $to.index(0)) return false;   // spans blocks
    from = $from.before(1);
    to   = $from.after(1);
  }

  const index  = state.doc.resolve(from).index(0);
  const target = index + dir;
  if (target < 0 || target >= state.doc.childCount) return false;

  const node  = state.doc.child(index);
  const other = state.doc.child(target);

  /* Replace [min, max) — the two blocks side by side — with the same two
     blocks swapped. One ReplaceStep: atomic for undo AND for collaborators,
     who see a move rather than a delete-then-insert flicker. */
  const min = dir < 0 ? from - other.nodeSize : from;
  const max = dir < 0 ? to : to + other.nodeSize;
  const swapped = dir < 0 ? [node, other] : [other, node];

  const tr = state.tr.replaceWith(min, max, Fragment.from(swapped));

  const newBlockStart = dir < 0 ? min : min + other.nodeSize;
  if (isNodeSel) {
    tr.setSelection(NodeSelection.create(tr.doc, newBlockStart));
  } else {
    tr.setSelection(TextSelection.create(
      tr.doc,
      newBlockStart + (sel.from - from),
      newBlockStart + (sel.to - from),
    ));
  }

  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export const BlockMove = Extension.create({
  name: "blockMove",

  addKeyboardShortcuts() {
    return {
      "Alt-ArrowUp":   () => moveBlock(this.editor, -1),
      "Alt-ArrowDown": () => moveBlock(this.editor, 1),
    };
  },
});
