/**
 * The trailer's spec, as data.
 *
 * Kept apart from the composition on purpose: the verification suite imports
 * THIS file, so the numbers it checks are the numbers that render. A test that
 * restates its constants is a test that silently stops being true.
 */

import { typeEnd } from "./parts";
import { distOf, tierOf, FRAME_W, FRAME_H, type MState, type Leg } from "./morph";

export const TRAILER_FRAMES = 2740;   // 45.7s @ 60fps
export const FPS = 60;

/* ── Layout ───────────────────────────────────────────────────────────────*/

export const NOTE = { pad: 48, slashY: 480, lineH: 44, menuGap: 12, menuH: 104 };
export const NOTE_H = {
  plain: NOTE.slashY + NOTE.pad,                                            // 528
  slash: NOTE.slashY + NOTE.lineH + NOTE.pad,                               // 572
  menu:  NOTE.slashY + NOTE.lineH + NOTE.menuGap + NOTE.menuH + NOTE.pad,   // 688
};

export const MOD = {
  pad: 44,
  nameLab: 150, nameFld: 177, nameH: 62,
  commLab: 300, commFld: 327, commH: 100,
  catLab: 470,  catRow: 497,  catH: 62,
  btnY: 590, btnH: 70, btnW: 240,
};
export const MOD_H = MOD.btnY + MOD.btnH + MOD.pad;   // 704

export const STACK = { pad: 30, rowH: 138, gap: 12, step: 26 };
export const STACK_H = STACK.pad * 2 + STACK.rowH * 4 + STACK.gap * 3;   // 648

/** The appearance row, and the switch inside it the cursor actually throws. */
export const TOG = { pad: 34, swW: 96, swH: 50, knob: 40 };

/** The paired-verse card: two passages and the connector drawn between them. */
/** The paired-verse card. linkH is the connector's run between the two
 *  passages — lengthened with the card, so the taller silhouette is filled by
 *  the LINE being drawn rather than by a gap opening between two rows. The
 *  connector is the point of that beat; it should be the thing that grew. */
export const PAIR = { pad: 36, rowH: 162, linkH: 150 };

/* ── States ───────────────────────────────────────────────────────────────
   The subject stays CENTRED. Every state parks in the middle of the frame;
   nothing drifts off to one side and sits there. What varies instead:

     SHAPE      rect, wide slab, stadium, pill, and one true circle — the
                container is not always the same oblong
     DIRECTION  each transition carries content left, right, up or down, so
                the width and height of the frame are used by the MOVEMENT
                rather than by parking the subject somewhere off-centre
     CURVE      four different eases, chosen per transition
     TONE       one real mode drop, thrown on camera

   Morph lengths stay derived from distance, so a state that changes more is
   never given a transition too short to carry it.                          */

/** Named indices, so nothing downstream depends on positional guesswork. */
export const IX = {
  title0: 0, verseA: 1, verseB: 2, verseBoth: 3, note: 4, slash: 5, menu: 6,
  modal: 7, saved: 8, stack: 9, toggle: 10, wheel: 11, count: 12, countInf: 13,
  cta: 14, title1: 15,
} as const;

const raw: Omit<MState, "morph">[] = [
  { key: "title",  at: 0,    w: 640, h: 360, r: 26 },

  /* The opening has to leave a stranger GROUNDED, not curious. Two passages in
     Arabic one after the other explain nothing to someone who cannot read
     them, so each carries its reference and its meaning, and a third state
     puts both in one card with a line drawn between them. The idea of a
     Connection is SHOWN before the product that makes one, using the very
     same pair the rest of the trailer goes on to create. */
  /* These four used to be one shape inflating: 760x270, 760x270, 820x500,
     900x528 — every one a rounded rect between 760 and 900 wide, each slightly
     bigger than the last, all centred. verseA and verseB were geometrically
     IDENTICAL, so the container did not change at all between them; only the
     content swapped, which is a cut wearing a slide. Ten seconds of that reads
     as one thing happening four times.

     The shapes now carry the variation the spec's own header promises. Aspect
     runs 3.1 -> 1.7 -> 1.1 -> 1.7: a wide slab, a tall card, a portrait sheet,
     then back to wide. The tall pair in the middle is the contrast the run was
     missing, and it earns itself — two passages stacked with a long connector
     drawn down between them wants height, not width. */
  { key: "verseA",    at: 156, w: 800, h: 256, r: 16, ease: "back",  dir: "right" },
  { key: "verseB",    at: 320, w: 620, h: 360, r: 30, ease: "snap",  dir: "left" },
  { key: "verseBoth", at: 500, w: 700, h: 640, r: 22, ease: "glide", dir: "up" },

  /* …and the note comes back DOWN out of it. Three consecutive "up" moves is
     the direction going as flat as the shapes were. */
  { key: "note",   at: 680,  w: 900, h: NOTE_H.plain, r: 24, ease: "smooth", dir: "down" },

  /* These two are REFLOWS, not morphs. The note is not replaced when a command
     line appears under it, and it is not replaced again when the suggestion
     opens — it is the same document making room, which is what the editor
     actually does. Blurring the pane away and rebuilding it identical, 44px
     taller, is a transition the viewer cannot account for. */
  { key: "slash",  at: 830,  w: 900, h: NOTE_H.slash, r: 24, via: "reflow" },
  { key: "menu",   at: 960,  w: 900, h: NOTE_H.menu,  r: 24, via: "reflow" },

  { key: "modal",  at: 1100, w: 880, h: MOD_H, r: 24, ease: "glide", dir: "left" },

  /* Create is clicked and the form drops out of the bottom of the card — the
     one exit in the piece that is not a sideways slide. What is left is a
     stadium, a different silhouette entirely. */
  { key: "saved",  at: 1420, w: 800, h: 190, r: 95, ease: "smooth", exit: "fall" },
  { key: "stack",  at: 1580, w: 820, h: STACK_H, r: 22, ease: "glide", dir: "up" },

  /* The appearance switch. Dark mode is not simply presented — the cursor
     crosses the frame and throws it. */
  { key: "toggle", at: 1800, w: 560, h: 170, r: 85, ease: "snap", dir: "right" },

  /* A circle. The ring finally gets a container shaped like itself. */
  { key: "wheel",  at: 2000, w: 860, h: 860, r: 430, ease: "smooth", dir: "up" },

  /* The map collapses into one pill. The word is then replaced by the symbol
     for it, in place, as a reflow — same surface, one word becoming a glyph,
     and the pill narrows to fit. */
  { key: "count",    at: 2380, w: 460, h: 120, r: 60, ease: "glide", exit: "fall" },
  { key: "countInf", at: 2470, w: 380, h: 120, r: 60, via: "reflow" },

  { key: "cta",    at: 2570, w: 660, h: 420, r: 26, ease: "back", dir: "left" },
  { key: "title",  at: 2680, w: 640, h: 360, r: 26, ease: "snap", dir: "right" },
];

export const STATES: MState[] = raw.map((s, i) => ({
  ...s,
  /* The first state has nothing before it; its morph value only backdates the
     content arrival so frame 0 is already settled, which the loop needs.
     A fall needs longer on screen than a slide, so those get extra frames. */
  morph: i === 0 ? 220
    : tierOf(distOf(raw[i - 1] as MState, s as MState)) + (s.exit === "fall" ? 16 : 0),
}));

/* ── Typing, the switch, and the symbol ───────────────────────────────────*/

export const CMD = "/link";
export const NAME = "The seven oft-repeated verses";

export const T = {
  /* The cursor clicks at the end of the written note and the command line
     appears BECAUSE of it — the reflow follows the click by six frames. A caret
     blinking before anything was clicked puts the events in the wrong order. */
  caretAt:    800,
  slashStart: 866, slashCps: 0.10,
  nameStart: 1144, nameCps:  0.42,
  catRack:   1294,
  btnRack:   1330,
  /** The frame the appearance switch is thrown. */
  themeAt:   1860,
  themeOver:   32,
  /** The frame the word gives way to the symbol, inside the same pill. */
  infAt:     2446,
  infOver:     24,
} as const;

export const T_END = {
  slash: typeEnd(CMD, T.slashStart, T.slashCps),
  name:  typeEnd(NAME, T.nameStart, T.nameCps),
};

/** Light until the switch is thrown, then dark until the closing morph. The
 *  tone change is CAUSED by the click rather than laid over a transition. */
export const THEME_KEYS = [
  { at: 0, t: 0 },
  { at: T.themeAt, t: 0 },
  { at: T.themeAt + T.themeOver, t: 1 },
  { at: STATES[IX.title1].at - STATES[IX.title1].morph, t: 1 },
  { at: STATES[IX.title1].at, t: 0 },
];

/* ── The explanation ──────────────────────────────────────────────────────
   Text lives on the STAGE, above or below the centred container — never over
   it. Alternating which side it takes gives the words somewhere different to
   be without the subject having to move.

   Every beat that could leave a first-time viewer asking "what am I looking
   at?" gets a line: the pair at the top, the note, and the ring. */

export const SAYS = [
  /* The opening four ALTERNATE above and below the container. They used to sit
     at 1240, 1240, 420, 1360 — the first two in the identical position, under
     two cards that were then the identical shape, so three beats running put
     the same words in the same place under the same rectangle. Each now clears
     its own card by the same 136px the note's line does, which keeps the gap
     even while the composition changes every beat. */
  { from: 180,  to: 284,  text: "The Qurʾān explains itself.",     top: 634 },
  { from: 334,  to: 452,  text: "One passage names another.",      top: 1276 },
  { from: 516,  to: 632,  text: "That link is worth keeping.",     top: 440 },
  { from: 700,  to: 790,  text: "Your own study notes.",           top: 1360 },
  { from: 1120, to: 1330, text: "Name it. Explain it. Keep it.",   top: 300 },
  { from: 1430, to: 1530, text: "It lives inside your note.",      top: 1180 },
  { from: 1600, to: 1740, text: "And they accumulate.",            top: 300 },
  { from: 2012, to: 2140, text: "Every sūrah, around one ring.",   top: 250 },
  { from: 2160, to: 2310, text: "Each Connection draws a chord.",  top: 1470 },
];

/* ── Cursor ───────────────────────────────────────────────────────────────
   Click targets are DERIVED from the layout constants above, so a click can
   never drift off the control it is supposed to hit. */

const left = (w: number) => FRAME_W / 2 - w / 2;
const top = (h: number) => FRAME_H / 2 - h / 2;

export const LEGS: Leg[] = [
  { at: 0,    to: { x: 900, y: 1560 } },
  { at: 700,  to: { x: 860, y: 1440 } },
  /* Clicks at the end of the written note. The command line appears because of
     this, not alongside it. */
  { at: T.caretAt, to: { x: left(900) + NOTE.pad + 26,
                         y: top(NOTE_H.plain) + 470 }, click: true },
  { at: 1010, to: { x: left(900) + NOTE.pad + 200,
                    y: top(NOTE_H.menu) + NOTE.slashY + NOTE.lineH + NOTE.menuGap + 48 } },
  { at: 1030, to: { x: left(900) + NOTE.pad + 200,
                    y: top(NOTE_H.menu) + NOTE.slashY + NOTE.lineH + NOTE.menuGap + 52 }, click: true },
  { at: 1130, to: { x: left(880) + MOD.pad + 110,
                    y: top(MOD_H) + MOD.nameFld + MOD.nameH / 2 }, click: true },
  { at: 1290, to: { x: left(880) + MOD.pad + 150,
                    y: top(MOD_H) + MOD.catRow + MOD.catH / 2 }, click: true },
  { at: 1350, to: { x: left(880) + 880 - MOD.pad - MOD.btnW / 2,
                    y: top(MOD_H) + MOD.btnY + MOD.btnH / 2 }, click: true },
  { at: 1480, to: { x: 900, y: 1620 } },
  /* A long diagonal travel to the switch. The CURSOR uses the width and height
     of the frame; the subject it is operating never leaves centre. */
  { at: T.themeAt, to: { x: left(560) + 560 - TOG.pad - TOG.swW / 2,
                         y: FRAME_H / 2 }, click: true },
  { at: 1940, to: { x: 930, y: 1660 } },
];

/** Clicks that COMMIT something get the heavier magnetic snap; the light taps
 *  (placing a caret, focusing a field) keep the soft click. */
export const MAGNETIC = new Set<number>([1030, 1350, T.themeAt]);

/** Frames where the outgoing content drops out of the container. */
export const FALLS = STATES
  .filter((st) => st.exit === "fall")
  .map((st) => st.at - st.morph);

/** Which state each click is meant to land on, asserted by the suite. */
export const CLICK_TARGET: Record<number, string> = {
  [T.caretAt]: "note", 1030: "menu", 1130: "modal", 1290: "modal", 1350: "modal",
  [T.themeAt]: "toggle",
};

/* ── The map ──────────────────────────────────────────────────────────────*/

export const LINKS = [
  { a: 1, b: 15 },  { a: 2, b: 8 },   { a: 4, b: 24 },  { a: 7, b: 20 },
  { a: 12, b: 40 }, { a: 18, b: 31 }, { a: 55, b: 2 },  { a: 67, b: 29 },
  { a: 36, b: 50 }, { a: 9, b: 47 },  { a: 76, b: 91 }, { a: 22, b: 59 },
  { a: 44, b: 88 }, { a: 6, b: 105 }, { a: 13, b: 72 }, { a: 28, b: 64 },
  { a: 19, b: 83 }, { a: 3, b: 3 },
];
export const WHEEL_IN = STATES[IX.wheel].at;
export const DRAW_FOR = 30;
/* Spread across the whole map hold, so the ring is still resolving right up to
   the moment the container closes rather than sitting finished and static. */
export const STARTS = LINKS.map((_, i) => WHEEL_IN - 8 + i * 17);

/* ── Content ──────────────────────────────────────────────────────────────*/

export interface Conn { name: string; a: string; b: string; cat: string }

/**
 * The two passages the opening links.
 *
 * Each carries its reference AND its meaning. Arabic alone tells a viewer who
 * cannot read it nothing at all, and the whole point of the beat is that they
 * should be able to see WHY these two belong together: one is seven verses,
 * the other names seven verses.
 */
export const VERSES = [
  {
    ref: "Al-Fātiḥah 1:1",
    ar: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    en: "The Opening — seven verses in all.",
  },
  {
    ref: "Al-Ḥijr 15:87",
    ar: "وَلَقَدْ آتَيْنَاكَ سَبْعًا مِّنَ الْمَثَانِي",
    en: "And We have given you seven of the oft-repeated.",
  },
];

export const CONNS: Conn[] = [
  { name: "The seven oft-repeated verses", a: "Al-Fātiḥah 1:1", b: "Al-Ḥijr 15:87",    cat: "Tafsīr" },
  { name: "Opening and closing in praise", a: "Al-Fātiḥah 1:2", b: "Yūnus 10:10",      cat: "Naẓm" },
  { name: "The straight path, named twice", a: "Al-Fātiḥah 1:6", b: "Al-Anʿām 6:153",  cat: "Naẓm" },
  { name: "Those who earned displeasure",  a: "Al-Fātiḥah 1:7", b: "Al-Baqarah 2:61",  cat: "Lughah" },
];
