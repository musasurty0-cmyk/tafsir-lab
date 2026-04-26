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
