/**
 * "Every tool" — the spec, as data.
 *
 * Modelled on Apple's Wonderful tools: a flat stage, ONE reduced object at a
 * time, and a continuous morph from each to the next. No feature is explained
 * and no interface is shown whole — each is opened, glimpsed for a beat, and
 * put away again.
 *
 * The rhythm is icon → open → glimpse → minimise → next icon, and it is
 * carried by the container alone: the icon IS the window IS the next icon.
 *
 * Content is the product's own — the library catalogue and the slash command
 * registry are read out of the app.
 */

import { distOf, tierOf, type MState } from "./morph";

export const TOOLS_FRAMES = 2120;   // 35.3s @ 60fps
export const FPS = 60;

/** Every icon is the same tile, so an icon-to-icon change is a pure content
 *  swap with nothing else moving — the clearest possible "and now this". */
export const TILE = { w: 290, h: 290, r: 72 };

export const IX = {
  mark: 0, padIcon: 1, padOpen: 2, padMin: 3,
  wbIcon: 4, wbOpen: 5, wbMin: 6,
  libIcon: 7, libOpen: 8, libMin: 9,
  slashIcon: 10, slashOpen: 11, wordmark: 12,
} as const;

const tile = (key: string, at: number, dir: MState["dir"]) =>
  ({ key, at, ...TILE, ease: "snap" as const, dir });

const raw: Omit<MState, "morph">[] = [
  /* The mark, alone. Everything that follows comes out of it. */
  { key: "mark",      at: 0,    ...TILE },

  tile("padIcon", 100, "right"),
  /* Opens rise, minimises drop. Direction is not decoration here — it is what
     makes a window opening and a window being put away read as opposites. */
  { key: "padOpen",   at: 220,  w: 820, h: 430, r: 24, ease: "glide", dir: "up" },
  tile("padMin", 480, "down"),

  tile("wbIcon", 564, "left"),
  { key: "wbOpen",    at: 684,  w: 880, h: 620, r: 24, ease: "glide", dir: "up" },
  tile("wbMin", 944, "down"),

  tile("libIcon", 1028, "right"),
  { key: "libOpen",   at: 1148, w: 880, h: 500, r: 24, ease: "glide", dir: "up" },
  tile("libMin", 1408, "down"),

  tile("slashIcon", 1492, "left"),
  { key: "slashOpen", at: 1612, w: 800, h: 940, r: 20, ease: "glide", dir: "up" },

  { key: "wordmark",  at: 2012, w: 760, h: 300, r: 26, ease: "back", dir: "down" },
];

export const STATES: MState[] = raw.map((s, i) => ({
  ...s,
  morph: i === 0 ? 220 : tierOf(distOf(raw[i - 1] as MState, s as MState)),
}));

/* ── Beats inside the open states ─────────────────────────────────────────*/

export const T = {
  /** The note writes itself. */
  padType: 244, padCps: 0.46,
  /** Whiteboard marks, each drawn in turn. */
  wbFrom: 696, wbStep: 38, wbFor: 40,
  /** Books arrive one after another. */
  libFrom: 1166, libStep: 24,
  /** The command list runs past. */
  slashFrom: 1640, slashFor: 300,
} as const;

export const NOTE_TEXT =
  "Seven verses, and the naming of them is given elsewhere — in Sūrat al-Ḥijr.";

/** Marks drawn on the whiteboard, in the order a hand would make them. */
export const WB_MARKS = [
  { kind: "box",    x: 70,  y: 80,  w: 270, h: 150 },
  { kind: "arrow",  x: 365, y: 155, w: 150, h: 0 },
  { kind: "circle", x: 535, y: 80,  w: 210, h: 150 },
  { kind: "line",   x: 80,  y: 310, w: 650, h: 0 },
  { kind: "squig",  x: 90,  y: 360, w: 560, h: 120 },
] as const;

/** The board's drawing surface, so the marks above are in its coordinates and
 *  not stretched by a viewBox that does not match the pane. */
export const WB_VIEW = { w: 800, h: 540 };

/* ── Content, read out of the app ─────────────────────────────────────────*/

/** lib/books/library-catalog.ts */
export const BOOKS = [
  { ar: "الأصول الثلاثة",     en: "The Three Fundamental Principles", by: "Muḥammad ibn ʿAbd al-Wahhāb", cat: "ʿAqīdah" },
  { ar: "العقيدة الواسطية",   en: "Al-ʿAqīdah al-Wāsiṭiyyah",         by: "Ibn Taymiyyah",               cat: "ʿAqīdah" },
  { ar: "الأربعون النووية",   en: "The Forty Ḥadīth of an-Nawawī",    by: "Imām an-Nawawī",              cat: "Ḥadīth" },
  { ar: "عمدة الأحكام",       en: "ʿUmdat al-Aḥkām",                  by: "ʿAbd al-Ghanī al-Maqdisī",    cat: "Ḥadīth" },
  { ar: "المنظومة البيقونية", en: "Al-Manẓūmah al-Bayqūniyyah",       by: "al-Bayqūnī",                  cat: "Muṣṭalaḥ" },
];

/** Tone by category, as the book objects in BooksHome are toned. */
export const BOOK_TONE: Record<string, string> = {
  "ʿAqīdah":  "#6b7f9e",
  "Ḥadīth":   "#8a7a5e",
  "Muṣṭalaḥ": "#7d6b86",
};

/**
 * The slash registry, in the order buildCommands() returns it: the fixed
 * commands, then every tafsīr shortcut, then the block types.
 * components/workspace/editor/SlashCommand.ts
 */
export const COMMANDS: { cmd: string; title: string; icon: string }[] = [
  { cmd: "/help",   title: "All commands",          icon: "?" },
  { cmd: "/link",   title: "Link Qurʾanic passage", icon: "🔗" },
  { cmd: "/ayah",   title: "Ayah block",            icon: "📖" },
  { cmd: "/tafsir", title: "Tafsir block",          icon: "📚" },
  { cmd: "/kathir",    title: "Tafsīr Ibn Kathīr",      icon: "📚" },
  { cmd: "/saadi",     title: "Tafsīr al-Saʿdī",        icon: "📚" },
  { cmd: "/tabari",    title: "Tafsīr al-Ṭabarī",       icon: "📚" },
  { cmd: "/qurtubi",   title: "Tafsīr al-Qurṭubī",      icon: "📚" },
  { cmd: "/razi",      title: "Tafsīr al-Rāzī",         icon: "📚" },
  { cmd: "/jalalayn",  title: "Tafsīr al-Jalālayn",     icon: "📚" },
  { cmd: "/baghawi",   title: "Tafsīr al-Baghawī",      icon: "📚" },
  { cmd: "/muyassar",  title: "Tafsīr al-Muyassar",     icon: "📚" },
  { cmd: "/mukhtasar", title: "Tafsīr al-Mukhtaṣar",    icon: "📚" },
  { cmd: "/maarif",    title: "Maʿārif al-Qurʾān",      icon: "📚" },
  { cmd: "/tahrir",    title: "Tafsīr Ibn ʿĀshūr",      icon: "📚" },
  { cmd: "/shawkani",  title: "Tafsīr al-Shawkānī",     icon: "📚" },
  { cmd: "/uthaymeen", title: "Tafsīr Ibn ʿUthaymīn",   icon: "📚" },
  { cmd: "/kashshaf",  title: "Tafsīr al-Zamakhsharī",  icon: "📚" },
  { cmd: "/baydawi",   title: "Tafsīr al-Bayḍāwī",      icon: "📚" },
  { cmd: "/h1",       title: "Heading 1",     icon: "H₁" },
  { cmd: "/h2",       title: "Heading 2",     icon: "H₂" },
  { cmd: "/h3",       title: "Heading 3",     icon: "H₃" },
  { cmd: "/quote",    title: "Quote",         icon: "❝" },
  { cmd: "/bullet",   title: "Bullet list",   icon: "•" },
  { cmd: "/numbered", title: "Numbered list", icon: "1." },
  { cmd: "/task",     title: "Task list",     icon: "☑" },
  { cmd: "/code",     title: "Code block",    icon: "</>" },
  { cmd: "/toggle",   title: "Toggle list",   icon: "▸" },
  { cmd: "/divider",  title: "Divider",       icon: "—" },
];

export const CMD_ROW_H = 76;

/** Every state that is an icon tile, for the suite to check they match. */
export const TILE_STATES = [
  "mark", "padIcon", "padMin", "wbIcon", "wbMin",
  "libIcon", "libMin", "slashIcon",
];

/** Windows open upward and are put away downward — asserted, not assumed. */
export const OPENS = ["padOpen", "wbOpen", "libOpen", "slashOpen"];
export const MINIMISES = ["padMin", "wbMin", "libMin"];
