/**
 * TextDirection — per-block direction for mixed Arabic/English documents.
 *
 * The editor had no direction handling at all, so an Arabic paragraph
 * inherited the document's LTR and rendered left-aligned with its punctuation
 * in the wrong place.
 *
 * Direction is a BLOCK attribute, never a document-wide setting: one Arabic
 * quotation must not flip the English commentary around it. Each block carries
 * its own `dir`, so a paragraph, heading, quote or list item is independent of
 * its neighbours.
 *
 * The default is `dir="auto"`, which asks the browser to resolve direction
 * from the first strong directional character in the block. That is exactly
 * the rule wanted here — Arabic content goes RTL, English goes LTR — and it
 * costs no stored state, so notes written BEFORE this existed lay out
 * correctly the moment it ships, with no migration and no rewriting of
 * existing content.
 *
 * `ltr` and `rtl` are explicit overrides for the cases auto cannot know: a
 * paragraph opening with a number, a citation, or a Latin transliteration that
 * belongs to an otherwise Arabic passage.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { directionOf } from "@/lib/text-direction";

/** Block types that carry their own direction. */
const DIRECTIONAL_BLOCKS = [
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "taskItem",
];

export type TextDir = "ltr" | "rtl" | "auto";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textDirection: {
      /** Set direction on every block in the selection. */
      setTextDirection: (dir: TextDir) => ReturnType;
      /** Return the selection's blocks to automatic detection. */
      unsetTextDirection: () => ReturnType;
    };
  }
}

export const TextDirection = Extension.create({
  name: "textDirection",

  addGlobalAttributes() {
    return [
      {
        types: DIRECTIONAL_BLOCKS,
        attributes: {
          dir: {
            default: null,
            parseHTML: (el) => el.getAttribute("dir"),
            /* null renders as "auto" rather than being omitted. Omitting it
               would let the block inherit the document direction, which is
               the behaviour being fixed. */
            renderHTML: (attrs) => ({ dir: (attrs.dir as string | null) ?? "auto" }),
          },
        },
      },
    ];
  },

  /* Arabic lines need more room between them than English ones (the vowel
     signs stack above and below). A typed line is stored as dir="auto", so
     CSS cannot tell it is Arabic: [dir="rtl"] misses it, and :dir(rtl) is
     rewritten by the build into :lang() selectors that match nothing here.
     So each line that reads right to left is marked with a class, worked out
     from its letters on every change. Nothing is stored in the document. */
  addProseMirrorPlugins() {
    const key = new PluginKey("rtlLines");
    const build = (doc: PMNode) => {
      const decos: Decoration[] = [];
      doc.descendants((node, pos) => {
        if (!node.isTextblock) return true;
        const dir = node.attrs.dir ?? directionOf(node.textContent);
        if (dir === "rtl") decos.push(Decoration.node(pos, pos + node.nodeSize, { class: "is-rtl" }));
        return false;
      });
      return DecorationSet.create(doc, decos);
    };
    return [new Plugin({
      key,
      state: {
        init: (_, state) => build(state.doc),
        apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old),
      },
      props: { decorations: (state) => key.getState(state) },
    })];
  },

  addCommands() {
    return {
      setTextDirection:
        (dir: TextDir) =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          let touched = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!DIRECTIONAL_BLOCKS.includes(node.type.name)) return;
            // "auto" is stored as null so the document does not fill up with
            // attributes that only restate the default.
            tr.setNodeAttribute(pos, "dir", dir === "auto" ? null : dir);
            touched = true;
          });
          if (touched && dispatch) dispatch(tr);
          return touched;
        },

      unsetTextDirection:
        () =>
        ({ commands }) =>
          commands.setTextDirection("auto"),
    };
  },
});

export default TextDirection;
