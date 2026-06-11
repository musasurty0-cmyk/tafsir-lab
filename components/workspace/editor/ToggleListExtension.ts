/**
 * ToggleListExtension — Notion-style collapsible toggle block.
 *
 * Structure: the node's FIRST child paragraph is the always-visible summary
 * line; every following block is the collapsible body.  This avoids a custom
 * summary node (which complicates the schema and Yjs sync) — collapsing is
 * purely presentational via CSS on [data-open].
 *
 * NodeView: plain DOM (no React) — a chevron button (contenteditable=false)
 * plus a content container ProseMirror manages.  Clicking the chevron flips
 * the `open` attribute through a transaction so the state syncs through Yjs
 * to collaborators.
 */

import { Node, mergeAttributes, type Editor } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    // Key must not collide with TipTap's built-in `toggleList` list command
    toggleListBlock: {
      /** Insert a new toggle block with an empty summary line */
      setToggleList: () => ReturnType;
    };
  }
}

const CHEVRON_SVG = `
<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="9 18 15 12 9 6"/>
</svg>`;

export const ToggleListExtension = Node.create({
  name: "toggleList",

  group:    "block",
  content:  "paragraph block*",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML:  (el) => el.getAttribute("data-open") !== "false",
        renderHTML: (attrs) => ({ "data-open": String(attrs.open) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-list"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "toggle-list", class: "toggle-list" }), 0];
  },

  addCommands() {
    return {
      setToggleList:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type:    this.name,
            attrs:   { open: true },
            content: [{ type: "paragraph" }],
          }),
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement("div");
      dom.className = "toggle-list";
      dom.dataset.type = "toggle-list";
      dom.dataset.open = String(node.attrs.open);

      const btn = document.createElement("button");
      btn.className = "toggle-list-chevron";
      btn.contentEditable = "false";
      btn.type = "button";
      btn.tabIndex = -1;
      btn.setAttribute("aria-label", "Toggle section");
      btn.innerHTML = CHEVRON_SVG;

      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = typeof getPos === "function" ? getPos() : null;
        if (pos == null) return;
        (editor as Editor)
          .chain()
          .command(({ tr }) => {
            const current = tr.doc.nodeAt(pos);
            if (!current || current.type.name !== "toggleList") return false;
            tr.setNodeMarkup(pos, undefined, { ...current.attrs, open: !current.attrs.open });
            return true;
          })
          .run();
      });

      const contentDOM = document.createElement("div");
      contentDOM.className = "toggle-list-content";

      dom.append(btn, contentDOM);

      return {
        dom,
        contentDOM,
        update(updated) {
          if (updated.type.name !== "toggleList") return false;
          dom.dataset.open = String(updated.attrs.open);
          return true;
        },
      };
    };
  },
});
