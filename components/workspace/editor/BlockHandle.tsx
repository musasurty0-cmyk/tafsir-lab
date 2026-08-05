"use client";

/**
 * BlockHandle — the contextual ⋮⋮ grip beside the hovered block.
 *
 * Invisible until the pointer is near a top-level block, then fades in at the
 * block's left gutter. Dragging it moves the block (ProseMirror's own drop
 * handling does the splice, so the drop cursor, undo grouping and Yjs all see
 * one ordinary move). Clicking it selects the block, which arms every
 * block-level affordance — Backspace deletes, Alt+↑/↓ walks it, Ctrl+C copies.
 *
 * The handle lives OUTSIDE the contenteditable, absolutely positioned in the
 * editor wrapper: nothing about it enters the document, the collab doc, or
 * the saved HTML. Mouse-only by design — it appears on hover, which touch
 * devices do not have.
 */

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

interface Props {
  editor: Editor | null;
  /** The positioned wrapper (.page-editor) the handle is absolute within. */
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}

interface HandleBox { top: number; left: number }

/** Top-level block position for a pointer height, or null. */
function blockPosAt(editor: Editor, clientY: number): number | null {
  const view = editor.view;
  const rect = view.dom.getBoundingClientRect();
  if (clientY < rect.top - 4 || clientY > rect.bottom + 4) return null;
  const found = view.posAtCoords({
    left: rect.left + Math.min(48, rect.width / 2),
    top:  clientY,
  });
  if (!found) return null;

  const inside = found.inside >= 0 ? found.inside : found.pos;
  const $pos   = view.state.doc.resolve(inside);
  if ($pos.depth > 0) return $pos.before(1);
  // Depth 0: `inside` is either the start of a top-level node (atoms land
  // here) or a gap between blocks.
  const node = view.state.doc.nodeAt(inside);
  return node ? inside : null;
}

export default function BlockHandle({ editor, wrapperRef }: Props) {
  const [box, setBox] = useState<HandleBox | null>(null);
  const posRef  = useRef<number | null>(null);
  const rafRef  = useRef(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!editor || editor.isDestroyed || !wrapper) return;

    const place = (clientY: number) => {
      const pos = blockPosAt(editor, clientY);
      if (pos === null) { posRef.current = null; setBox(null); return; }
      const dom = editor.view.nodeDOM(pos);
      if (!(dom instanceof HTMLElement)) { posRef.current = null; setBox(null); return; }

      const wRect = wrapper.getBoundingClientRect();
      const bRect = dom.getBoundingClientRect();
      posRef.current = pos;
      setBox({
        /* Hug the first line: line boxes are ~28px in body text, so centre
           the 22px handle on that; tall cards just get it at their top. */
        top:  bRect.top - wRect.top + Math.min(4, Math.max(0, (bRect.height - 22) / 2)),
        left: bRect.left - wRect.left - 30,
      });
    };

    const onMove = (e: MouseEvent) => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        place(e.clientY);
      });
    };
    /* The handle goes away the moment the interaction stops being a hover:
       typing, scrolling, or leaving the editor column. Its position would be
       stale within one frame of any of those. */
    const clear = () => { posRef.current = null; setBox(null); };

    wrapper.addEventListener("mousemove", onMove);
    wrapper.addEventListener("mouseleave", clear);
    document.addEventListener("scroll", clear, true);
    editor.view.dom.addEventListener("keydown", clear);
    return () => {
      wrapper.removeEventListener("mousemove", onMove);
      wrapper.removeEventListener("mouseleave", clear);
      document.removeEventListener("scroll", clear, true);
      editor.view.dom.removeEventListener("keydown", clear);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [editor, wrapperRef]);

  if (!editor || !box) return null;

  const selectBlock = (): number | null => {
    const pos = posRef.current;
    if (pos === null) return null;
    const view = editor.view;
    if (pos > view.state.doc.content.size) return null;
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
    view.focus();
    return pos;
  };

  return (
    <button
      type="button"
      className="block-handle"
      style={{ top: box.top, left: box.left }}
      title="Drag to move — click to select"
      aria-label="Move block"
      draggable
      /* preventDefault would kill the native drag; select on mousedown so the
         block is already highlighted as the drag image forms. */
      onMouseDown={selectBlock}
      onDragStart={(e) => {
        const pos = selectBlock();
        if (pos === null) { e.preventDefault(); return; }
        const view  = editor.view;
        const slice = (view.state.selection as NodeSelection).content();
        /* This is the exact contract ProseMirror's own in-editor dragstart
           sets up: with view.dragging populated, the drop handler MOVES the
           slice instead of copying whatever is on the dataTransfer. */
        view.dragging = { slice, move: true };
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", "");
          const dom = view.nodeDOM(pos);
          if (dom instanceof HTMLElement) e.dataTransfer.setDragImage(dom, 0, 0);
        }
      }}
      onDragEnd={() => setBox(null)}
    >
      <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden>
        {[2, 8].map((x) => [2, 8, 14].map((y) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />
        )))}
      </svg>
    </button>
  );
}
