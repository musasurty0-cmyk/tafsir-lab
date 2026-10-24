/**
 * AyahBlockExtension — TipTap Node for an embedded Qur'anic verse.
 *
 * Attributes persisted in the TipTap JSON doc:
 *   verseKey        — "2:255" (canonical reference)
 *   surahNumber     — parsed number for quick note lookup
 *   ayahNumber      — parsed number for quick note lookup
 *   arabicText      — cached Arabic text (avoids re-fetch on reload)
 *   translationText — cached translation text
 *   showTranslation — user preference per block
 *   endAyah         — last āyah of a selection ("/a 2:1-5" → 5); null for one āyah
 *
 * The NodeView (AyahBlockView) handles rendering, lazy verse-fetching,
 * notes, and progress controls via EditorContext.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import AyahBlockView from "./AyahBlockView";

export const AyahBlockExtension = Node.create({
  name: "ayahBlock",

  group: "block",

  // atom = true: TipTap treats the node as a single opaque unit.
  // The user cannot place the cursor inside it; it's selected as a whole.
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      verseKey:        { default: "" },
      surahNumber:     { default: 1 },
      ayahNumber:      { default: 1 },
      arabicText:      { default: "" },
      translationText: { default: "" },
      showTranslation: { default: true },

      /* A selection is the same block over a run of āyāt, so everything that
         works on one (drag, resize, translation, Tafsīr) works on several.
         Null is a single āyah, which is what every block written before this
         existed already is. */
      endAyah: {
        default: null,
        parseHTML: (el) => {
          const n = parseInt(el.getAttribute("data-end") ?? "", 10);
          return Number.isFinite(n) && n > 0 ? n : null;
        },
        renderHTML: (a) => (a.endAyah ? { "data-end": String(a.endAyah) } : {}),
      },

      /* Size is a property of THIS placement. Both axes are stored, and both
         are null by default — null means "fit the column / fit the content",
         so an untouched block stays fluid and reflows when the sheet or the
         reading size changes. Only a block the author actually dragged
         carries a number. */
      width:  {
        default: null,
        parseHTML: (el) => {
          const n = parseInt(el.getAttribute("data-w") ?? "", 10);
          return Number.isFinite(n) && n > 0 ? n : null;
        },
        renderHTML: (a) => (a.width ? { "data-w": String(a.width) } : {}),
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const n = parseInt(el.getAttribute("data-h") ?? "", 10);
          return Number.isFinite(n) && n > 0 ? n : null;
        },
        renderHTML: (a) => (a.height ? { "data-h": String(a.height) } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="ayah-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "ayah-block" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AyahBlockView);
  },
});
