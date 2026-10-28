/**
 * Block formatting from a selection, done the way the reader meant it.
 *
 * Two things made "select a line, press H2" format the wrong text:
 *
 *  1. A selection that reaches the end of a line usually ENDS at the start of
 *     the next one. Triple-click does it, and so does dragging off the end of
 *     a line — the browser puts the focus at offset 0 of the following block.
 *     ProseMirror's block commands then change every block the range touches,
 *     so the NEXT paragraph became the heading too.
 *  2. Text pasted in from elsewhere carries an inline font size. A heading
 *     whose words are all `font-size: 14px` looks exactly like body text, so
 *     the line that was made a heading seemed not to change at all.
 *
 * `formatBlocks` trims the first, and for headings clears the second.
 */

import type { ChainedCommands, Editor } from "@tiptap/core";
import { Selection, type EditorState, type Transaction } from "@tiptap/pm/state";

/** The selection, minus a trailing block it only touches at its very start. */
export function meantRange(state: EditorState): { from: number; to: number } {
  const { from, to, empty } = state.selection;
  if (empty) return { from, to };
  const $to = state.doc.resolve(to);
  if ($to.parentOffset !== 0 || !$to.parent.isTextblock || $to.start() <= from) return { from, to };
  // Back to the end of whatever text came before that block.
  const back = Selection.near(state.doc.resolve($to.before()), -1);
  return back.to > from ? { from, to: back.to } : { from, to };
}

/** Drop the inline font size from every textblock between from and to, keeping colour and face. */
export function clearBlockFontSize(tr: Transaction, from: number, to: number): void {
  const type = tr.doc.type.schema.marks.textStyle;
  if (!type) return;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    node.forEach((child, offset) => {
      const mark = child.marks.find((m) => m.type === type && m.attrs.fontSize);
      if (!mark) return;
      const start = pos + 1 + offset, end = start + child.nodeSize;
      tr.removeMark(start, end, mark);
      const rest = { ...mark.attrs, fontSize: null };
      if (Object.values(rest).some((v) => v != null && v !== "")) tr.addMark(start, end, type.create(rest));
    });
    return false;
  });
}

/**
 * Run a block command (heading, list, quote) over the blocks the selection
 * means. `heading` also clears inline sizes so the heading looks like one.
 */
export function formatBlocks(
  editor: Editor,
  run: (c: ChainedCommands) => ChainedCommands,
  opts: { heading?: boolean } = {},
): void {
  const range = meantRange(editor.state);
  let chain = editor.chain().focus();
  if (range.to !== editor.state.selection.to) chain = chain.setTextSelection(range);
  chain = run(chain);
  if (opts.heading) {
    // Only when the toggle made a heading — turning one back into text leaves sizes alone.
    chain = chain.command(({ tr }) => {
      if (tr.selection.$from.parent.type.name === "heading") clearBlockFontSize(tr, tr.selection.from, tr.selection.to);
      return true;
    });
  }
  chain.run();
}

// ── Which editor the reader is in ───────────────────────────────────────────
/* The top formatting bar was bound to the page's main editor alone, so with
   the caret in a text box, its H2 changed the main document — wherever that
   editor's last selection happened to be. Every editor announces itself on
   focus, and the bar follows the last one. */

type Listener = (e: Editor) => void;
const listeners = new Set<Listener>();

export function announceFocus(editor: Editor): void {
  for (const l of listeners) l(editor);
}

export function onEditorFocus(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
