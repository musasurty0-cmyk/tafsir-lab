import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import TafsirBlockView from "./TafsirBlockView";

export const TafsirBlockExtension = Node.create({
  name: "tafsirBlock",

  group: "block",

  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      verseKey:    { default: "" },
      contentHtml: { default: "" },
      sourceName:  { default: "Ibn Kathir" },
      // TafsirSource slug — any provisioned source (quran.com built-ins or
      // the spa5k catalog). Old blocks without this attr keep Ibn Kathīr.
      sourceSlug:  { default: "ibn-kathir-en" },
      /* True when contentHtml holds a passage the reader selected rather than
         the whole commentary. Attribution has to say so — quoting a fragment
         as if it were the full entry misrepresents the source. */
      partial:     { default: false },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tafsir-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "tafsir-block" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TafsirBlockView);
  },
});
