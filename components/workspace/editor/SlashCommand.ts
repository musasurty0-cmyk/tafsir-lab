/**
 * SlashCommand — TipTap extension that fires a command palette when the
 * user types "/" at the start of a new block.
 *
 * Each command item is { title, description, icon, execute(editor, query) }.
 * The `execute` function is called when the user confirms an item; it
 * receives the full query string so it can extract params (e.g. a verse key).
 *
 * Uses @tiptap/suggestion for the ProseMirror plugin mechanics.
 * The React rendering (CommandList) is wired in PageEditor.tsx.
 */

import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import type { Editor } from "@tiptap/core";

// ── Command descriptor ────────────────────────────────────────────────────

export interface SlashCommandItem {
  id:          string;
  title:       string;
  description: string;
  icon:        string;
  /** Aliases that also match (e.g. ["h1", "header"]) */
  aliases?:    string[];
  /**
   * Called when the user selects this command.
   * @param editor  the TipTap editor instance
   * @param range   the range currently occupied by the "/" trigger + query text
   * @param query   the raw query string after "/" (e.g. "ayah 2:255")
   */
  execute(editor: Editor, range: { from: number; to: number }, query: string): void;
}

// ── Available commands ────────────────────────────────────────────────────

export function buildCommands(): SlashCommandItem[] {
  return [
    {
      id:          "ayah",
      title:       "Ayah block",
      description: "Embed a Qur'anic verse (e.g. /ayah 2:255)",
      icon:        "📖",
      aliases:     ["verse", "quran", "ayat"],
      execute(editor, range, query) {
        // Parse verse key from query: "ayah 2:255" → "2:255"
        const parts    = query.trim().split(/\s+/);
        const rawKey   = parts.slice(1).join("").trim(); // "2:255"
        const verseKey = rawKey || "1:1";

        const [surahStr, ayahStr] = verseKey.split(":");
        const surahNumber = parseInt(surahStr, 10) || 1;
        const ayahNumber  = parseInt(ayahStr,  10) || 1;

        // Insert the ayah block AND a trailing paragraph in one transaction.
        // The trailing paragraph gives the editor a text-selection target after
        // the atom block so the cursor is never trapped.
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent([
            {
              type: "ayahBlock",
              attrs: {
                verseKey,
                surahNumber,
                ayahNumber,
                arabicText:      "",   // fetched lazily by AyahBlockView
                translationText: "",
                showTranslation: true,
              },
            },
            // Empty paragraph — cursor lands here after insertion.
            { type: "paragraph" },
          ])
          .scrollIntoView()
          .run();
      },
    },
    {
      id:          "tafsir",
      title:       "Ibn Kathir Tafsir",
      description: "Embed Ibn Kathīr's commentary (e.g. /tafsir 2:255)",
      icon:        "📚",
      aliases:     ["ibn", "kathir", "commentary", "tafseer"],
      execute(editor, range, query) {
        const parts    = query.trim().split(/\s+/);
        const rawKey   = parts.slice(1).join("").trim();
        const verseKey = rawKey || "1:1";

        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent([
            {
              type: "tafsirBlock",
              attrs: {
                verseKey,
                contentHtml: "",
                sourceName:  "Ibn Kathir",
              },
            },
            { type: "paragraph" },
          ])
          .scrollIntoView()
          .run();
      },
    },
    {
      id:          "h1",
      title:       "Heading 1",
      description: "Large section heading",
      icon:        "H₁",
      aliases:     ["heading", "title"],
      execute(editor, range) {
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
      },
    },
    {
      id:          "h2",
      title:       "Heading 2",
      description: "Medium sub-heading",
      icon:        "H₂",
      aliases:     ["subheading"],
      execute(editor, range) {
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
      },
    },
    {
      id:          "h3",
      title:       "Heading 3",
      description: "Small section label",
      icon:        "H₃",
      aliases:     ["subheading"],
      execute(editor, range) {
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
      },
    },
    {
      id:          "quote",
      title:       "Quote",
      description: "Block quotation",
      icon:        "❝",
      aliases:     ["blockquote"],
      execute(editor, range) {
        editor.chain().focus().deleteRange(range).setBlockquote().run();
      },
    },
    {
      id:          "bullet",
      title:       "Bullet list",
      description: "Unordered list",
      icon:        "•",
      aliases:     ["list", "ul"],
      execute(editor, range) {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      id:          "numbered",
      title:       "Numbered list",
      description: "Ordered list",
      icon:        "1.",
      aliases:     ["ordered", "ol", "number"],
      execute(editor, range) {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      id:          "task",
      title:       "Task list",
      description: "Checklist with tickable items",
      icon:        "☑",
      aliases:     ["todo", "checkbox", "checklist", "check"],
      execute(editor, range) {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      id:          "code",
      title:       "Code block",
      description: "Monospaced block",
      icon:        "</>",
      aliases:     ["codeblock", "pre", "snippet"],
      execute(editor, range) {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      id:          "toggle",
      title:       "Toggle list",
      description: "Collapsible section — click the chevron to fold",
      icon:        "▸",
      aliases:     ["collapse", "fold", "details", "dropdown"],
      execute(editor, range) {
        editor.chain().focus().deleteRange(range).setToggleList().run();
      },
    },
    {
      id:          "divider",
      title:       "Divider",
      description: "Horizontal rule",
      icon:        "—",
      aliases:     ["hr", "rule", "separator"],
      execute(editor, range) {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
  ];
}

// ── Filter helper (used by PageEditor to pass items to CommandList) ────────

export function filterCommands(
  items: SlashCommandItem[],
  query: string
): SlashCommandItem[] {
  if (!query) return items;
  const q    = query.toLowerCase().trim();
  // Match against the first word of the query (before any space + param)
  const word = q.split(/\s+/)[0];
  return items.filter(
    (cmd) =>
      cmd.id.startsWith(word) ||
      cmd.title.toLowerCase().includes(word) ||
      cmd.aliases?.some((a) => a.startsWith(word))
  );
}

// ── TipTap extension ──────────────────────────────────────────────────────

export const SlashCommandExtension = Extension.create<{
  suggestion: Partial<SuggestionOptions>;
}>({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char:            "/",
        startOfLine:     false,
        allowSpaces:     true,
        decorationClass: "slash-command-decoration",
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
