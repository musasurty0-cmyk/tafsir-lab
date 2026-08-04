/**
 * Eight strokes, rearranged.
 *
 * The previous attempt at this reel blurred one icon out, resized an empty
 * box, and faded the next icon in. Measured against Apple's Wonderful tools it
 * moved a third as much per frame, sat near-still 80% of the time against
 * their 57%, and its biggest transformation was a seventh the size of theirs.
 * Theirs has ZERO hard cuts in 107 seconds. A crossfade is not a morph, and
 * that is exactly why the icons read as unrelated things appearing.
 *
 * So: there are eight strokes on screen, always, and they never fade. Every
 * scene is an ARRANGEMENT of those same eight. Going from one to the next
 * moves each stroke's endpoints, weight and colour — nothing appears and
 * nothing disappears, so the connection between one idea and the next is
 * carried by the same eight objects travelling.
 *
 * Space is 1000 x 1000, centred, mapped onto the frame at render time.
 */

/** x1,y1,x2,y2 in the 1000-square, plus weight and colour. */
export interface Stroke {
  x1: number; y1: number; x2: number; y2: number;
  w: number; c: string;
  /** Bow, as a fraction of the stroke's length. 0 is straight. */
  b?: number;
}

export type Shape = Stroke[];
export const N = 8;

/**
 * The field the strokes sit on.
 *
 * Eight lines on a pale stage change too few pixels to ever produce a real
 * transformation: measured against the reference, the strokes alone peaked at
 * a seventh of its biggest move. The reference gets its peaks from LARGE
 * forms — a grey disc filling the frame, a black box, a white field — so a
 * scene change swings most of the picture at once. This is that form: one
 * rounded rectangle behind the strokes, whose size, radius and colour are part
 * of every arrangement. A circle is simply r = w / 2.
 */
export interface Field {
  w: number; h: number; r: number; c: string;
  /** Outline. A ring is a transparent fill with a heavy stroke — without it
   *  the chords read as a scribble rather than as chords across something. */
  sc?: string; sw?: number;
}

const INK    = "#1e1a14";
const PAPER  = "#fcfbf8";
const ACCENT = "#448061";
const MARKER = "#e8c25a";
const PEN    = "#2563eb";
const RED    = "#dc2626";
const FAINT  = "#b9b3a7";

/* ── The scenes ───────────────────────────────────────────────────────────*/

/** The mark. Three strokes make the bar, five the stem. */
const mark: Shape = [
  { x1: 348, y1: 372, x2: 652, y2: 372, w: 58, c: PAPER },
  { x1: 348, y1: 412, x2: 652, y2: 412, w: 58, c: PAPER },
  { x1: 476, y1: 432, x2: 476, y2: 640, w: 58, c: PAPER },
  { x1: 490, y1: 432, x2: 490, y2: 640, w: 58, c: PAPER },
  { x1: 504, y1: 432, x2: 504, y2: 640, w: 58, c: PAPER },
  { x1: 518, y1: 432, x2: 518, y2: 640, w: 58, c: PAPER },
  { x1: 490, y1: 432, x2: 490, y2: 640, w: 58, c: PAPER },
  { x1: 504, y1: 432, x2: 504, y2: 640, w: 58, c: PAPER },
];

/** A written page: the same eight, laid down as lines of text. */
const page: Shape = [
  { x1: 250, y1: 250, x2: 640, y2: 250, w: 44, c: INK },
  { x1: 250, y1: 330, x2: 750, y2: 330, w: 24, c: FAINT },
  { x1: 250, y1: 390, x2: 700, y2: 390, w: 24, c: FAINT },
  { x1: 250, y1: 450, x2: 745, y2: 450, w: 24, c: FAINT },
  { x1: 250, y1: 510, x2: 610, y2: 510, w: 24, c: FAINT },
  { x1: 250, y1: 590, x2: 700, y2: 590, w: 24, c: FAINT },
  { x1: 250, y1: 650, x2: 745, y2: 650, w: 24, c: FAINT },
  { x1: 250, y1: 710, x2: 560, y2: 710, w: 24, c: FAINT },
];

/** The command. All eight rake into one thick diagonal. */
const slash: Shape = [
  { x1: 404, y1: 726, x2: 570, y2: 274, w: 44, c: PAPER },
  { x1: 428, y1: 726, x2: 594, y2: 274, w: 44, c: PAPER },
  { x1: 452, y1: 726, x2: 618, y2: 274, w: 44, c: PAPER },
  { x1: 476, y1: 726, x2: 642, y2: 274, w: 44, c: PAPER },
  { x1: 500, y1: 726, x2: 666, y2: 274, w: 44, c: PAPER },
  { x1: 524, y1: 726, x2: 690, y2: 274, w: 44, c: PAPER },
  { x1: 548, y1: 726, x2: 714, y2: 274, w: 44, c: PAPER },
  { x1: 572, y1: 726, x2: 738, y2: 274, w: 44, c: PAPER },
];

/** The menu the command opens: eight rows. */
const menu: Shape = [
  { x1: 250, y1: 250, x2: 750, y2: 250, w: 46, c: "#e4e0d8" },
  { x1: 250, y1: 320, x2: 750, y2: 320, w: 46, c: "#efece6" },
  { x1: 250, y1: 390, x2: 750, y2: 390, w: 46, c: "#e4e0d8" },
  { x1: 250, y1: 460, x2: 750, y2: 460, w: 46, c: "#efece6" },
  { x1: 250, y1: 530, x2: 750, y2: 530, w: 46, c: "#e4e0d8" },
  { x1: 250, y1: 600, x2: 750, y2: 600, w: 46, c: "#efece6" },
  { x1: 250, y1: 670, x2: 750, y2: 670, w: 46, c: "#e4e0d8" },
  { x1: 250, y1: 740, x2: 750, y2: 740, w: 46, c: "#efece6" },
];

/** The muṣḥaf: seven āyāt, right-aligned, under a header rule. */
const mushaf: Shape = [
  { x1: 330, y1: 232, x2: 670, y2: 232, w: 10, c: FAINT },
  { x1: 430, y1: 320, x2: 760, y2: 320, w: 9, c: FAINT },
  { x1: 400, y1: 392, x2: 760, y2: 392, w: 9, c: FAINT },
  { x1: 520, y1: 464, x2: 760, y2: 464, w: 9, c: FAINT },
  { x1: 500, y1: 536, x2: 760, y2: 536, w: 9, c: FAINT },
  { x1: 350, y1: 608, x2: 760, y2: 608, w: 9, c: FAINT },
  { x1: 420, y1: 680, x2: 760, y2: 680, w: 9, c: FAINT },
  { x1: 300, y1: 752, x2: 760, y2: 752, w: 9, c: FAINT },
];

/** The same page, marked up. Two strokes take the marker and the pen; one
 *  swings out into an arrow. Nothing has been added — the lines were already
 *  there and simply changed job. */
const annotated: Shape = [
  { x1: 330, y1: 232, x2: 670, y2: 232, w: 10, c: FAINT },
  { x1: 430, y1: 320, x2: 760, y2: 320, w: 9, c: FAINT },
  { x1: 400, y1: 392, x2: 760, y2: 392, w: 9, c: FAINT },
  { x1: 520, y1: 464, x2: 760, y2: 464, w: 9, c: FAINT },
  { x1: 500, y1: 528, x2: 760, y2: 528, w: 54, c: MARKER },
  { x1: 350, y1: 624, x2: 760, y2: 624, w: 18, c: PEN },
  { x1: 200, y1: 720, x2: 470, y2: 566, w: 18, c: RED, b: 0.14 },
  { x1: 300, y1: 752, x2: 760, y2: 752, w: 9, c: FAINT },
];

/** Every Connection, as a chord across the ring. Bowed, so eight straight
 *  lines become eight arcs without anything being drawn or removed. */
const RING = 300, CX = 500, CY = 500;
const onRing = (deg: number) => ({
  x: CX + Math.cos((deg * Math.PI) / 180) * RING,
  y: CY + Math.sin((deg * Math.PI) / 180) * RING,
});
const chord = (a: number, b: number, w: number, c: string): Stroke => {
  const p = onRing(a), q = onRing(b);
  return { x1: p.x, y1: p.y, x2: q.x, y2: q.y, w, c, b: 0.42 };
};
const ring: Shape = [
  chord(-95, 130, 20, ACCENT),
  chord(-40, 190, 20, ACCENT),
  chord(15,  240, 11, ACCENT),
  chord(70,  285, 11, ACCENT),
  chord(120, 330, 20, ACCENT),
  chord(165,  20, 11, ACCENT),
  chord(210,  75, 11, ACCENT),
  chord(255, 110, 20, ACCENT),
];

/** The shelf: the chords stand up as spines. */
const shelf: Shape = [
  { x1: 300, y1: 700, x2: 300, y2: 330, w: 44, c: "#6b7f9e" },
  { x1: 358, y1: 700, x2: 358, y2: 300, w: 44, c: "#6b7f9e" },
  { x1: 416, y1: 700, x2: 416, y2: 345, w: 44, c: "#8a7a5e" },
  { x1: 474, y1: 700, x2: 474, y2: 310, w: 44, c: "#8a7a5e" },
  { x1: 532, y1: 700, x2: 532, y2: 355, w: 44, c: "#7d6b86" },
  { x1: 590, y1: 700, x2: 590, y2: 320, w: 44, c: "#7d6b86" },
  { x1: 648, y1: 700, x2: 648, y2: 340, w: 44, c: "#9e6b6b" },
  { x1: 706, y1: 700, x2: 706, y2: 300, w: 44, c: "#9e6b6b" },
];

/** Everything converges on one rule — the line under the name. */
const rule: Shape = Array.from({ length: N }, () => (
  { x1: 470, y1: 596, x2: 530, y2: 596, w: 7, c: ACCENT }
));
/** …which then draws outward as the name lands, so the closing move moves. */
const ruleWide: Shape = Array.from({ length: N }, () => (
  { x1: 360, y1: 596, x2: 640, y2: 596, w: 7, c: ACCENT }
));

/* ── The order, and how long each is held ─────────────────────────────────
   Roughly 1.3s a scene, which is the reference's own rate. Nothing is ever
   still: the hold is where the overlay lands and the strokes drift.        */

export interface Beat {
  at: number;
  shape: Shape;
  field: Field;
  key: string;
  /** Turn applied across the move into this scene, in degrees. */
  spin?: number;
}

const F = (w: number, h: number, r: number, c: string): Field => ({ w, h, r, c });

export const BEATS: Beat[] = [
  { at: 0,    key: "mark",      shape: mark,      field: F(540, 540, 132, "#1e1a14") },
  { at: 84,   key: "page",      shape: page,      field: F(620, 780,  28, "#fefdfc"), spin: -7 },
  { at: 172,  key: "slash",     shape: slash,     field: F(560, 560, 280, "#448061"), spin: 16 },
  { at: 270,  key: "menu",      shape: menu,      field: F(660, 740,  24, "#fefdfc"), spin: -6 },
  { at: 420,  key: "mushaf",    shape: mushaf,    field: F(680, 800,  24, "#fefdfc"), spin: 9 },
  { at: 570,  key: "annotated", shape: annotated, field: F(680, 800,  24, "#fefdfc") },
  /* A ring, not a disc: the chords have to cross something. */
  { at: 720,  key: "ring",      shape: ring,
    field: { w: 640, h: 640, r: 320, c: "rgba(0,0,0,0)", sc: "#cfc9bd", sw: 26 }, spin: -24 },
  { at: 850,  key: "shelf",     shape: shelf,     field: F(680, 560,  22, "#fefdfc"), spin: 18 },
  { at: 986,  key: "rule",      shape: rule,      field: F(600, 280,  26, "#fefdfc"), spin: -9 },
  { at: 1046, key: "wordmark",  shape: ruleWide,  field: F(660, 320,  26, "#fefdfc") },
];

export const STROKE_FRAMES = 1150;   // 19.2s @ 60fps

/** Frames a scene change takes. Short: the reference never lingers. */
export const MOVE = 52;
/** Each stroke starts a little after the one before it, so the set arrives as
 *  a wave rather than as one rigid object. */
export const STAGGER = 4;
