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
  /** Tafsir commands: when NO verse key is typed, PageEditor opens a small
   *  verse picker defaulting to the surah being studied, instead of inserting
   *  1:1. When a key IS typed (e.g. "/tabari 23:2") it inserts directly. */
  isTafsir?:          boolean;
  /** Source slug for the block; undefined → resolve last-used drawer source. */
  tafsirSlug?:        string;
  tafsirSourceName?:  string;
  /**
   * Called when the user selects this command.
   * @param editor  the TipTap editor instance
   * @param range   the range currently occupied by the "/" trigger + query text
   * @param query   the raw query string after "/" (e.g. "ayah 2:255")
   */
  execute(editor: Editor, range: { from: number; to: number }, query: string): void;
}

// ── Tafsir shortcuts ──────────────────────────────────────────────────────
// "/saadi 2:255" → al-Saʿdī's commentary on 2:255, "/jalalayn 18:10" → the
// Jalālayn on 18:10, etc. Each inserts a tafsirBlock pre-set to that source;
// the block's own dropdown can still switch afterwards.

const TAFSIR_SHORTCUTS: {
  id: string; title: string; slug: string; sourceName: string; aliases?: string[];
}[] = [
  { id: "kathir",    title: "Ibn Kathīr",           slug: "ibn-kathir-en",                sourceName: "Ibn Kathīr (English)",      aliases: ["ibnkathir", "ibn"] },
  { id: "saadi",     title: "al-Saʿdī",             slug: "ar-tafsir-as-saadi",           sourceName: "Tafsir As-Saadi",           aliases: ["sadi", "sa'di"] },
  { id: "tabari",    title: "al-Ṭabarī",            slug: "ar-tafsir-al-tabari",          sourceName: "Tafsir al-Tabari" },
  { id: "qurtubi",   title: "al-Qurṭubī",           slug: "ar-tafseer-al-qurtubi",        sourceName: "Tafseer Al Qurtubi" },
  { id: "razi",      title: "al-Rāzī",              slug: "tafsir-al-razi",               sourceName: "Tafsir Al-Razi" },
  { id: "jalalayn",  title: "al-Jalālayn",          slug: "en-al-jalalayn",               sourceName: "Al-Jalalayn",               aliases: ["jalayn", "jalal"] },
  { id: "baghawi",   title: "al-Baghawī",           slug: "ar-tafsir-al-baghawi",         sourceName: "Tafseer Al-Baghawi" },
  { id: "muyassar",  title: "al-Muyassar",          slug: "ar-tafsir-muyassar",           sourceName: "Tafsir Muyassar" },
  { id: "mukhtasar", title: "al-Mukhtaṣar",         slug: "en-tafsir-al-mukhtasar",       sourceName: "English Al-Mukhtasar" },
  { id: "maarif",    title: "Maʿārif al-Qurʾān",    slug: "maarif-en",                    sourceName: "Maʿārif al-Qurʾān (English)" },
  { id: "tahrir",    title: "Ibn ʿĀshūr",           slug: "ar-tafseer-tahrir-al-tanwir",  sourceName: "Tafsir al-Tahrir wa al-Tanwir", aliases: ["ashur", "ibnashur"] },
  { id: "shawkani",  title: "al-Shawkānī",          slug: "fath-al-qadir-al-shawkani",    sourceName: "Fath Al-Qadir Al-Shawkani", aliases: ["fath"] },
  { id: "uthaymeen", title: "Ibn ʿUthaymīn",        slug: "tafsir-ibn-uthaymeen",         sourceName: "Tafsir Ibn Uthaymeen",      aliases: ["uthaymin", "othaimeen"] },
  { id: "kashshaf",  title: "al-Zamakhsharī",       slug: "al-kashshaf-al-zamakhshari",   sourceName: "Al-Kashshaf Al-Zamakhshari", aliases: ["zamakhshari"] },
  { id: "baydawi",   title: "al-Bayḍāwī",           slug: "tafsir-al-baydawi",            sourceName: "Tafsir Al-Baydawi",         aliases: ["baidawi"] },
];

/** Shared insert used by /tafsir and every scholar shortcut. */
function insertTafsirBlock(
  editor: Editor,
  range: { from: number; to: number },
  query: string,
  sourceSlug: string,
  sourceName: string,
): void {
  const parts    = query.trim().split(/\s+/);
  const rawKey   = parts.slice(1).join("").trim(); // "saadi 2:255" → "2:255"
  const verseKey = /^\d{1,3}:\d{1,3}$/.test(rawKey) ? rawKey : "1:1";

  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent([
      {
        type: "tafsirBlock",
        attrs: { verseKey, contentHtml: "", sourceName, sourceSlug },
      },
      { type: "paragraph" },
    ])
    .scrollIntoView()
    .run();
}

// ── Available commands ────────────────────────────────────────────────────

export function buildCommands(): SlashCommandItem[] {
  const tafsirShortcuts: SlashCommandItem[] = TAFSIR_SHORTCUTS.map((t) => ({
    id:               t.id,
    title:            `Tafsīr ${t.title}`,
    description:      `${t.title}'s commentary — pick a verse (or /${t.id} 2:255)`,
    icon:             "📚",
    aliases:          t.aliases,
    isTafsir:         true,
    tafsirSlug:       t.slug,
    tafsirSourceName: t.sourceName,
    execute(editor, range, query) {
      insertTafsirBlock(editor, range, query, t.slug, t.sourceName);
    },
  }));

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
      title:       "Tafsir block",
      description: "Embed commentary — 67+ English & Arabic sources",
      icon:        "📚",
      aliases:     ["commentary", "tafseer"],
      isTafsir:    true,   // tafsirSlug undefined → resolves last-used source
      execute(editor, range, query) {
        // Default to the source last chosen in the tafsir drawer; the block's
        // own dropdown can switch to any provisioned source afterwards.
        let sourceSlug = "ibn-kathir-en";
        try {
          const stored = localStorage.getItem("tl-tafsir-source");
          if (stored) sourceSlug = stored;
        } catch { /* SSR / private mode */ }
        insertTafsirBlock(editor, range, query, sourceSlug, "Tafsīr");
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

    // Scholar shortcuts last — the block palette stays first when browsing
    ...tafsirShortcuts,
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
