/**
 * The search animation's measured curves — the single source for every
 * composition that plays it.
 *
 * These numbers were TRACKED off the reference reel, not designed: each frame
 * thresholded, the largest connected blob taken, its box logged. They live here
 * rather than inside SearchReel because the trailer opens with the same
 * animation, and a second composition holding its own copy of a measured table
 * is a copy that quietly stops matching. Same rule the trailer's spec follows:
 * the numbers that render are the numbers that were measured.
 *
 * Everything here is resolution-independent. SX/SY scale the source's own
 * 1280x714 space onto a target; a portrait frame passes its own.
 *
 * Full method and findings: trailer/MOTION-STUDY.md §9 and §11.
 */

/* ── Easings ──────────────────────────────────────────────────────────────*/

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const easeIO = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Overshoots and settles — the elastic accel/decel a layout change needs so
 *  it reads as physics rather than as a value being set. */
export const springy = (t: number, k = 1.25) => {
  const x = Math.max(0, Math.min(1, t));
  return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2);
};

/**
 * Keyframes with continuous velocity — monotone cubic Hermite, Fritsch–Carlson.
 *
 * Interpolating straight through a set of stops is piecewise LINEAR, so speed
 * is constant inside each segment and STEPS at every stop. Measured on the old
 * mark that step reached 11.7px/frame — it reversed direction between two
 * frames with no deceleration at all. The eye reads a velocity step as a
 * dropped frame, which is the whole of why that looked like stop motion.
 *
 * This is C1: velocity carries through every stop, and at a direction reversal
 * the tangent goes to zero, so an apex decelerates into itself and accelerates
 * out like a thrown object. The limiter also stops the spline bulging past a
 * flat run, which means an overshoot has to be an explicit keyframe rather
 * than an accident of the curve.
 */
export const track = (p: number, S: number[], V: number[]) => {
  const n = S.length;
  if (p <= S[0]) return V[0];
  if (p >= S[n - 1]) return V[n - 1];

  const h: number[] = [], d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = S[i + 1] - S[i];
    d[i] = (V[i + 1] - V[i]) / h[i];
  }
  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) {
    /* A reversal is an apex: stop there, then accelerate the other way. */
    m[i] = d[i - 1] * d[i] <= 0 ? 0
      : (d[i - 1] * h[i] + d[i] * h[i - 1]) / (h[i - 1] + h[i]);
  }
  m[n - 1] = d[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i]; m[i + 1] = k * b * d[i];
    }
  }
  let i = 0;
  while (i < n - 2 && p > S[i + 1]) i++;
  const t = (p - S[i]) / h[i], t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * V[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
       + (-2 * t3 + 3 * t2) * V[i + 1] + (t3 - t2) * h[i] * m[i + 1];
};

/* ── How the text arrives ─────────────────────────────────────────────────*/

/**
 * Measured off the source's text ink width per frame.
 *
 * The source does not type. Its reveal is a clean S — 7, 8, 12, 15, 20, 27,
 * 40, 46, 41, 36, 24, 9px a frame — accelerating into a peak and tapering out,
 * with over half the string landing in a third of the time, and all 26
 * characters down in 18 frames. Far too fast to read as typing, and that is
 * precisely what makes it look PAINTED. It is a different curve, not a texture
 * applied to typing.
 */
export const PS = [0, 0.11, 0.21, 0.32, 0.42, 0.53, 0.63, 0.74, 0.84, 1];
export const PV = [0, 0.042, 0.102, 0.208, 0.410, 0.672, 0.852, 0.931, 0.952, 1];

/* ── The mark's arc ───────────────────────────────────────────────────────*/

/**
 * [ref frame, centre-y, width, height] in the source's 1280x714 / 29.97fps
 * space. The arc is badly ASYMMETRIC: the rule sits still, then the gather and
 * the launch are ONE move — it slingshots, hitting 43.5px/frame upward at f22.
 * It decays to the apex roughly halving each frame, which is damping and not
 * gravity. It HANGS: nine frames, 300ms, within 3px of the top. Then it falls
 * on an ease-in building to 28px/frame. Rise and fall are different curves and
 * the hang between them is the whole character of the thing.
 */
export const REF: [number, number, number, number][] = [
  [1, 421.5, 94, 4], [2, 421.5, 126, 6], [3, 422, 150, 7], [4, 422, 168, 7],
  [5, 422, 183, 7], [6, 422, 193, 7], [7, 421.5, 201, 8], [8, 421, 201, 7],
  [9, 420.5, 200, 8], [10, 419.5, 199, 8], [11, 418.5, 195, 8], [12, 417, 191, 9],
  [13, 415.5, 184, 10], [14, 414, 174, 11], [15, 411, 159, 13], [16, 407.5, 133, 14],
  [17, 403.5, 103, 18], [18, 398.5, 80, 20], [19, 391, 64, 21], [20, 378.5, 54, 24],
  [21, 358, 45, 23], [22, 314.5, 39, 20], [23, 294.5, 36, 22], [24, 284.5, 32, 24],
  [25, 278.5, 30, 24], [26, 274, 28, 25], [27, 270.5, 27, 24], [28, 268.5, 26, 24],
  [29, 266.5, 25, 24], [30, 265, 24, 25], [31, 264, 24, 25], [32, 263, 25, 25],
  [33, 262.5, 24, 24], [34, 262, 24, 25], [35, 261.5, 24, 24], [36, 261.5, 25, 24],
  [37, 262, 24, 25], [38, 262.5, 24, 24], [39, 263.5, 24, 24], [40, 265, 25, 25],
  [41, 267, 24, 25], [42, 269, 24, 25], [43, 272, 24, 25], [44, 275, 24, 25],
  [45, 279, 24, 25], [46, 284, 24, 25], [47, 291, 24, 25], [48, 299, 24, 25],
  [49, 309.5, 22, 26], [50, 324.5, 22, 26], [51, 344, 20, 27], [52, 372, 11, 25],
];

/** The source's bar line. 51 source frames at 29.97 is 102 of ours. */
export const REF_BAR_Y = 372;
export const ARC_FRAMES = 102;

export interface ArcTracks { S: number[]; Y: number[]; Wd: number[]; Hd: number[] }

/**
 * Build the arc's keyframe tracks for a target resolution.
 * @param sx horizontal scale from the source's 1280 (1920/1280 = 1.5)
 * @param sy vertical scale from the source's 714  (1080/714  = 1.512)
 */
export function buildArc(sx: number, sy: number): ArcTracks {
  const n = REF.length, span = REF[n - 1][0] - REF[0][0];
  const S: number[] = [], Y: number[] = [], Wd: number[] = [], Hd: number[] = [];
  for (let i = 0; i < n; i++) {
    S.push((REF[i][0] - REF[0][0]) / span);
    Y.push((REF[i][1] - REF_BAR_Y) * sy);
    /* w and h get a 3-tap smooth: at 43px/frame the blob smears, so single
       frames around the launch measure a shape the mark never actually is. */
    const a = REF[Math.max(0, i - 1)], b = REF[i], c = REF[Math.min(n - 1, i + 1)];
    Wd.push(((a[2] + 2 * b[2] + c[2]) / 4) * sx);
    Hd.push(((a[3] + 2 * b[3] + c[3]) / 4) * sy);
  }
  return { S, Y, Wd, Hd };
}

/**
 * The rule sweeps in from the right and comes to rest CENTRED under the field.
 * Stops are the arc's normalised time; values are source-pixels right of the
 * field's centre — multiply by the target's sx.
 *
 * Measured against the field's TRUE centre (the placeholder's midpoint), not
 * against the back-arrow glyph: the arrow carries the camera and the layout,
 * so subtracting it left the rule 20-odd pixels off for its whole visible life.
 */
export const XS = [0, 0.035, 0.07, 0.115, 1];
export const XV_SRC = [126.7, 61.3, 18.7, 0, 0];
