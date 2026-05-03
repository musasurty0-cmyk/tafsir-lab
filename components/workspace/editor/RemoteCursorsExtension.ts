/**
 * RemoteCursorsExtension — TipTap extension for Google-Docs-style
 * collaborative cursor / selection highlighting.
 *
 * Usage:
 *   1. Add RemoteCursorsExtension to your editor's `extensions` array.
 *   2. Call setRemoteCursors(editor, cursors) whenever you receive new
 *      presence data.  Each call fully replaces the previous cursor set.
 *
 * Visual output:
 *   • A coloured blinking caret at the remote user's cursor position.
 *   • A semi-transparent highlight over their current text selection.
 *   • A small name label that floats above the caret.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";

// ── Public types ──────────────────────────────────────────────────────────────

export interface RemoteCursor {
  userId:    string;
  name:      string;
  color:     string;
  /** ProseMirror absolute position (from editor.state.selection.from) */
  from:      number;
  /** ProseMirror absolute position (from editor.state.selection.to) */
  to:        number;
}

// ── Colour palette ────────────────────────────────────────────────────────────

const CURSOR_COLORS = [
  "#4285F4", // Google blue
  "#EA4335", // Google red
  "#34A853", // Google green
  "#FF6D00", // deep orange
  "#7C4DFF", // purple
  "#00ACC1", // cyan
  "#E91E63", // pink
  "#F57C00", // orange
];

export function getUserColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (Math.imul(31, h) + userId.charCodeAt(i)) | 0;
  }
  return CURSOR_COLORS[Math.abs(h) % CURSOR_COLORS.length];
}

// ── Plugin key ────────────────────────────────────────────────────────────────

const PLUGIN_KEY = new PluginKey<DecorationSet>("remoteCursors");

// ── Extension ─────────────────────────────────────────────────────────────────

export const RemoteCursorsExtension = Extension.create({
  name: "remoteCursors",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: PLUGIN_KEY,

        state: {
          init() {
            return DecorationSet.empty;
          },

          apply(tr, old) {
            // Re-map existing decorations when the doc changes
            const cursors = tr.getMeta(PLUGIN_KEY) as RemoteCursor[] | undefined;
            if (!cursors) return old.map(tr.mapping, tr.doc);

            const decorations: Decoration[] = [];
            const maxPos = tr.doc.content.size;

            for (const cursor of cursors) {
              const from = Math.max(0, Math.min(cursor.from, maxPos));
              const to   = Math.max(from, Math.min(cursor.to, maxPos));
              const { color, name, userId } = cursor;

              // ── Name label + caret widget ──────────────────────────────
              const wrap = document.createElement("span");
              wrap.className = "rc-caret";
              wrap.setAttribute("data-user", userId);
              wrap.style.setProperty("--rc-color", color);

              const label = document.createElement("span");
              label.className = "rc-label";
              label.textContent = name.split(" ")[0]; // first name only
              wrap.appendChild(label);

              if (from === to) {
                // Pure caret (no selection)
                decorations.push(
                  Decoration.widget(from, wrap, {
                    key:  `rc-caret-${userId}`,
                    side: 1,
                  })
                );
              } else {
                // Highlight the selection range
                decorations.push(
                  Decoration.inline(
                    from,
                    to,
                    {
                      class: "rc-selection",
                      style: `--rc-color: ${color};`,
                    },
                    { key: `rc-sel-${userId}` }
                  )
                );
                // Caret at the head of the selection (= to)
                decorations.push(
                  Decoration.widget(to, wrap, {
                    key:  `rc-caret-${userId}`,
                    side: 1,
                  })
                );
              }
            }

            return DecorationSet.create(tr.doc, decorations);
          },
        },

        props: {
          decorations(state) {
            return PLUGIN_KEY.getState(state);
          },
        },
      }),
    ];
  },
});

// ── Imperative update ─────────────────────────────────────────────────────────

/**
 * Push a fresh set of remote cursors into the editor.
 * Call this from a polling loop whenever presence data arrives.
 */
export function setRemoteCursors(editor: Editor, cursors: RemoteCursor[]) {
  if (!editor || editor.isDestroyed) return;
  const { tr } = editor.state;
  tr.setMeta(PLUGIN_KEY, cursors);
  editor.view.dispatch(tr);
}
