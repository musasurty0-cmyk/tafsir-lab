/**
 * "Studying a sūrah" — the spec, as data.
 *
 * Every command, tool, colour and block style here is the product's own, read
 * out of the codebase rather than invented:
 *   /ayah, /tafsir      components/workspace/editor/SlashCommand.ts
 *   the tafsīr sources  the TAFSIRS table in the same file
 *   the canvas tools    components/workspace/CanvasToolRail.tsx
 *   block metrics       .ayah-block-* / .tafsir-block-* in app/globals.css
 *
 * The verification suite imports THIS file, so the numbers it checks are the
 * numbers that render.
 */

import { typeEnd } from "./parts";
import { distOf, tierOf, FRAME_W, FRAME_H, type MState, type Leg } from "./morph";

export const STUDY_FRAMES = 3230;   // 53.8s @ 60fps
export const FPS = 60;

/* ── Layout ───────────────────────────────────────────────────────────────*/

/** The desktop the app is launched from. */
export const DESK = {
  menuH: 34,
  dockW: 560, dockH: 108, dockCy: 1700,
  icon: 84, gap: 20,
};

/** The note, and everything the editor grows to fit. Heights are content
 *  heights: each state adds exactly the block it gained. */
export const ED = {
  pad: 44,
  headH: 132,          // title + subtitle
  proseH: 118,         // the paragraph the study starts from
  lineH: 44,           // one command line
  menuGap: 12,
  menuH: 116,          // one suggestion row
  menuH2: 232,         // the tafsīr picker: two rows
  ayahH: 154,          // .ayah-block-node: ref + arabic + rule + translation
  tafH: 216,           // .tafsir-block-node: head + three lines of serif
};
const base = ED.pad * 2 + ED.headH + ED.proseH;                 // 338
export const ED_H = {
  note:    base,                                                 // 338
  ayahCmd: base + ED.lineH,                                      // 382
  ayahMenu: base + ED.lineH + ED.menuGap + ED.menuH,             // 510
  ayah:    base + ED.ayahH,                                      // 492
  tafCmd:  base + ED.ayahH + ED.lineH,                           // 536
  tafMenu: base + ED.ayahH + ED.lineH + ED.menuGap + ED.menuH2,  // 780
  tafsir:  base + ED.ayahH + ED.tafH,                            // 708
};

/** The muṣḥaf sheet, its tool rail, and the marks made on it. */
export const MUS = {
  pad: 30, railW: 64, headH: 104, line0: 168, lineH: 96, lines: 7,
};
export const MUS_H = MUS.pad * 2 + MUS.headH + MUS.line0 - MUS.headH
                   + MUS.lineH * MUS.lines + 60;   // 960

/** Canvas tools, exactly as the rail defines them. */
export const TOOLS = [
  { id: "hand",      glyph: "✋", title: "Pan" },
  { id: "pen",       glyph: "✎",  title: "Pen" },
  { id: "highlight", glyph: "▬",  title: "Highlight" },
  { id: "arrow",     glyph: "↗",  title: "Arrow" },
  { id: "text",      glyph: "T",  title: "Text box" },
  { id: "eraser",    glyph: "◻",  title: "Eraser" },
] as const;

/** The rail's own palette. */
export const INK = {
  pen:       "#2563eb",   // Blue
  penRed:    "#dc2626",   // Red
  highlight: "#fbbf24",   // Yellow
};

/* ── States ───────────────────────────────────────────────────────────────
   The subject stays centred throughout. The single exception is the dock icon,
   which sits where a dock icon sits — that is not a scene parked off-centre for
   effect, it is the launch surface, and the container travels up out of it.  */

export const IX = {
  dock: 0, window: 1, note: 2, ayahCmd: 3, ayahMenu: 4, ayah: 5,
  tafCmd: 6, tafMenu: 7, tafsir: 8, mode: 9, mushaf: 10,
  done: 11, cta: 12, title: 13,
} as const;

const raw: Omit<MState, "morph">[] = [
  /* The app icon in the dock. The container IS the icon — it magnifies, takes
     the click, and then flies up and becomes the window, so the launch is one
     continuous object rather than a cut to a running app. */
  { key: "dock",     at: 0,    w: 120, h: 120, r: 28, cy: DESK.dockCy },

  { key: "window",   at: 240,  w: 880, h: 560, r: 22, ease: "glide",  dir: "up" },
  { key: "note",     at: 460,  w: 900, h: ED_H.note, r: 22, ease: "smooth", dir: "up" },

  /* Everything from here to the tafsīr block is ONE document growing. None of
     it may blur away and rebuild — a note does not cease to exist because a
     command line appeared in it. */
  { key: "ayahCmd",  at: 640,  w: 900, h: ED_H.ayahCmd,  r: 22, via: "reflow" },
  { key: "ayahMenu", at: 820,  w: 900, h: ED_H.ayahMenu, r: 22, via: "reflow" },
  { key: "ayah",     at: 980,  w: 900, h: ED_H.ayah,     r: 22, via: "reflow" },
  { key: "tafCmd",   at: 1180, w: 900, h: ED_H.tafCmd,   r: 22, via: "reflow" },
  { key: "tafMenu",  at: 1324, w: 900, h: ED_H.tafMenu,  r: 22, via: "reflow" },
  { key: "tafsir",   at: 1480, w: 900, h: ED_H.tafsir,   r: 22, via: "reflow" },

  /* A different surface: the mode switch, then the muṣḥaf itself. */
  { key: "mode",     at: 1800, w: 520, h: 160, r: 80, ease: "snap",   dir: "right" },
  { key: "mushaf",   at: 1960, w: 840, h: MUS_H, r: 24, ease: "smooth", dir: "up" },

  { key: "done",     at: 2896, w: 480, h: 120, r: 60, ease: "glide", exit: "fall" },
  { key: "cta",      at: 3032, w: 660, h: 420, r: 26, ease: "back",  dir: "left" },
  { key: "title",    at: 3164, w: 640, h: 360, r: 26, ease: "snap",  dir: "right" },
];

export const STATES: MState[] = raw.map((s, i) => ({
  ...s,
  morph: i === 0 ? 220
    : tierOf(distOf(raw[i - 1] as MState, s as MState)) + (s.exit === "fall" ? 16 : 0),
}));

/* ── Beats ────────────────────────────────────────────────────────────────*/

export const AYAH_CMD = "/ayah 15:87";
export const TAF_CMD  = "/tafsir";
export const MARK_TEXT = "the pivot of the sūrah";

export const T = {
  /** The dock icon takes the click and bounces. */
  dockHover: 120, dockClick: 150,

  caretA:     600,
  ayahStart:  676, ayahCps: 0.11,
  ayahPick:   900,

  caretB:    1140,
  tafStart:  1216, tafCps: 0.11,
  tafPick:   1400,
  /** The tafsīr block arrives empty and shimmers before the text lands, which
   *  is what the product actually does while the source is fetched. */
  tafSkeleton: 1480, tafResolve: 1590,

  modeClick: 1860,

  /** Each mark: the tool is chosen, then the mark is made. */
  hlTool: 2060, hlDraw: 2090, hlFor: 62,
  penTool: 2200, penDraw: 2230, penFor: 56,
  arrTool: 2340, arrDraw: 2370, arrFor: 50,
  txtTool: 2480, txtDraw: 2510, txtCps: 0.30,
} as const;

export const T_END = {
  ayah: typeEnd(AYAH_CMD, T.ayahStart, T.ayahCps),
  taf:  typeEnd(TAF_CMD,  T.tafStart,  T.tafCps),
  txt:  typeEnd(MARK_TEXT, T.txtDraw,  T.txtCps),
};

/* ── The explanation ──────────────────────────────────────────────────────*/

export const SAYS = [
  { from: 80,   to: 190,  text: "One sūrah. One sitting.",            top: 820 },
  { from: 300,  to: 420,  text: "Open where you left off.",           top: 1360 },
  { from: 500,  to: 600,  text: "Write in your own words.",           top: 1290 },
  { from: 1010, to: 1140, text: "Pull the āyah in with a command.",   top: 300 },
  { from: 1620, to: 1750, text: "And the commentary beside it.",      top: 250 },
  { from: 1995, to: 2120, text: "Then mark up the muṣḥaf itself.",    top: 200 },
  { from: 2680, to: 2820, text: "Your reading, kept.",                top: 1600 },
];

/* ── Cursor ───────────────────────────────────────────────────────────────
   Every target is DERIVED from the layout constants, so a click can never
   drift off the control it is meant to hit. */

const left = (w: number) => FRAME_W / 2 - w / 2;
const top = (h: number) => FRAME_H / 2 - h / 2;

/** Marks are placed in card-local coordinates and converted once, here. */
export const MARK = {
  /* Line 5 is "the straight path" — the highlight sits on it. */
  hl:   { x0: 360, y: 664, x1: 640, h: 48 },
  /* Line 4 is "You alone we worship" — underlined. */
  pen:  { x0: 400, y: 626, x1: 690 },
  arr:  { x0: 190, y: 800, x1: 392, y1: 694 },
  txt:  { x: 130, y: 826, w: 320, h: 84 },
};
const mx = (v: number) => left(840) + v;
const my = (v: number) => top(MUS_H) + v;

export const LEGS: Leg[] = [
  { at: 0,   to: { x: 880, y: 1180 } },
  /* Down to the dock, then the click that launches. */
  { at: T.dockHover, to: { x: 566, y: DESK.dockCy - 6 } },
  { at: T.dockClick, to: { x: 562, y: DESK.dockCy }, click: true },
  { at: 300, to: { x: 900, y: 1420 } },

  /* End of the written note, so the command line appears because of it. */
  { at: T.caretA, to: { x: left(900) + ED.pad + 24,
                        y: top(ED_H.note) + ED.pad + ED.headH + ED.proseH - 26 }, click: true },
  { at: 870, to: { x: left(900) + ED.pad + 190,
                   y: top(ED_H.ayahMenu) + ED_H.ayahMenu - ED.pad - ED.menuH / 2 } },
  { at: T.ayahPick, to: { x: left(900) + ED.pad + 190,
                          y: top(ED_H.ayahMenu) + ED_H.ayahMenu - ED.pad - ED.menuH / 2 + 4 }, click: true },

  { at: T.caretB, to: { x: left(900) + ED.pad + 24,
                        y: top(ED_H.ayah) + ED_H.ayah - ED.pad - 22 }, click: true },
  { at: 1370, to: { x: left(900) + ED.pad + 190,
                    y: top(ED_H.tafMenu) + ED_H.tafMenu - ED.pad - ED.menuH2 + 52 } },
  { at: T.tafPick, to: { x: left(900) + ED.pad + 190,
                         y: top(ED_H.tafMenu) + ED_H.tafMenu - ED.pad - ED.menuH2 + 56 }, click: true },

  { at: 1720, to: { x: 900, y: 1480 } },
  { at: T.modeClick, to: { x: left(520) + 520 - 40 - 48, y: FRAME_H / 2 }, click: true },

  /* Into the muṣḥaf: pick a tool, make the mark, pick the next. The pointer
     rides each stroke as it is drawn. */
  { at: T.hlTool,  to: { x: mx(MUS.pad + MUS.railW / 2), y: my(MUS.pad + 46 + 2 * 56) }, click: true },
  { at: T.hlDraw,  to: { x: mx(MARK.hl.x1), y: my(MARK.hl.y + 22) } },
  { at: T.hlDraw + T.hlFor, to: { x: mx(MARK.hl.x0), y: my(MARK.hl.y + 22) } },

  { at: T.penTool, to: { x: mx(MUS.pad + MUS.railW / 2), y: my(MUS.pad + 46 + 1 * 56) }, click: true },
  { at: T.penDraw, to: { x: mx(MARK.pen.x1), y: my(MARK.pen.y) } },
  { at: T.penDraw + T.penFor, to: { x: mx(MARK.pen.x0), y: my(MARK.pen.y) } },

  { at: T.arrTool, to: { x: mx(MUS.pad + MUS.railW / 2), y: my(MUS.pad + 46 + 3 * 56) }, click: true },
  { at: T.arrDraw, to: { x: mx(MARK.arr.x0), y: my(MARK.arr.y) } },
  { at: T.arrDraw + T.arrFor, to: { x: mx(MARK.arr.x1), y: my(MARK.arr.y1) } },

  { at: T.txtTool, to: { x: mx(MUS.pad + MUS.railW / 2), y: my(MUS.pad + 46 + 4 * 56) }, click: true },
  { at: T.txtDraw, to: { x: mx(MARK.txt.x + 30), y: my(MARK.txt.y + 30) }, click: true },
  { at: 2700, to: { x: 900, y: 1560 } },
  { at: 2820, to: { x: 940, y: 1640 } },
];

/** Clicks that commit something get the magnetic snap. */
export const MAGNETIC = new Set<number>([
  T.dockClick, T.ayahPick, T.tafPick, T.modeClick,
]);

export const FALLS = STATES
  .filter((st) => st.exit === "fall")
  .map((st) => st.at - st.morph);

export const CLICK_TARGET: Record<number, string> = {
  [T.dockClick]: "dock",
  [T.caretA]: "note",
  [T.ayahPick]: "ayahMenu",
  [T.caretB]: "ayah",
  [T.tafPick]: "tafMenu",
  [T.modeClick]: "mode",
  [T.hlTool]: "mushaf", [T.penTool]: "mushaf",
  [T.arrTool]: "mushaf", [T.txtTool]: "mushaf",
};

/** States that are the same surface, so a transition between any two of them
 *  must reflow rather than blur. */
export const SAME_SURFACE = [
  "note", "ayahCmd", "ayahMenu", "ayah", "tafCmd", "tafMenu", "tafsir",
];

/* ── Content ──────────────────────────────────────────────────────────────*/

/** Al-Fātiḥah, the sūrah being studied. */
export const FATIHA = [
  "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
  "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
  "الرَّحْمَٰنِ الرَّحِيمِ",
  "مَالِكِ يَوْمِ الدِّينِ",
  "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
  "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
  "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ",
];

/** The āyah /ayah 15:87 pulls in — the same verse the Connections trailer
 *  links al-Fātiḥah to, so the two pieces describe one study. */
export const AYAH = {
  ref: "15:87",
  ar: "وَلَقَدْ آتَيْنَاكَ سَبْعًا مِّنَ الْمَثَانِي وَالْقُرْآنَ الْعَظِيمَ",
  en: "And We have certainly given you seven of the oft-repeated verses and the Great Qurʾān.",
};

/** Two of the real sources from the TAFSIRS table. */
export const SOURCES = [
  { title: "Tafsīr Ibn Kathīr", note: "Ibn Kathīr (English)" },
  { title: "Tafsīr al-Saʿdī",   note: "Tafsir As-Saadi" },
];

export const TAFSIR_TEXT = [
  "The seven oft-repeated verses are al-Fātiḥah, by the consensus of the majority.",
  "They are called al-mathānī because they are repeated in every rakʿah of prayer.",
];
