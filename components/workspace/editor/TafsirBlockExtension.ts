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
