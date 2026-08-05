import React from "react";
import {
  AbsoluteFill, Sequence, Audio, staticFile,
  useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";

/* ── Search, then the panels ───────────────────────────────────────────────
   Landscape, like the source.

   There is only ever ONE small black object on screen. It draws as a rule
   under the field, gathers into a dot, falls in, and stands up as the caret —
   every property runs on a single continuous curve so there is never a frame
   with a rule and a dot at once, and never a jump between states. There is no
   loading bar; a second line would break the same rule.

   When the address is finished the bar does not fade. The two side buttons are
   drawn into the field and the field itself grows into the first panel, in
   half a second.

   Panels land ON TOP of each other, overlapping. The ones behind stay fully
   visible — the blur is there to move attention forward, not to hide them.
   At the end all three converge on one rect and become the mark.            */

export const SEARCH_FRAMES = 900;   // 15.0s @ 60fps
const W = 1920, H = 1080;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const easeIO = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** Overshoots and settles — the elastic accel/decel a layout change needs so
 *  it reads as physics rather than as a value being set. */
const springy = (t: number, k = 1.25) => {
  const x = Math.max(0, Math.min(1, t));
  return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2);
};
/**
 * How the address arrives, measured off the source's text width per frame.
 *
 * I had this as a linear ramp with sine wobble on it, on the theory that a
 * hand types unevenly. The source does not type. Tracking the ink width
 * across its reveal gives a clean S — 7, 8, 12, 15, 20, 27, 40, 46, 41, 36,
 * 24, 9px a frame — accelerating into a peak and tapering out, with over half
 * the string landing in a third of the time. The whole 26 characters go down
 * in 18 frames, 0.6s, which is far too fast to read as typing.
 *
 * That is what makes it look painted rather than typed, which is the note I
 * was given and could not previously act on: it is not a texture applied to
 * typing, it is a different curve.
 */
const PS = [0, 0.11, 0.21, 0.32, 0.42, 0.53, 0.63, 0.74, 0.84, 1];
const PV = [0, 0.042, 0.102, 0.208, 0.410, 0.672, 0.852, 0.931, 0.952, 1];

/**
 * Keyframes with continuous velocity — monotone cubic Hermite, Fritsch–Carlson.
 *
 * Interpolating straight through a set of stops is piecewise LINEAR, so speed
 * is constant inside each segment and STEPS at every stop. Measured on the old
 * mark that step reached 11.7px/frame — it reversed direction between two
 * frames with no deceleration at all. The eye reads a velocity step as a
 * dropped frame, which is the whole of why this looked like stop motion.
 *
 * This is C1: velocity carries through every stop, and at a direction reversal
 * the tangent goes to zero, so an apex decelerates into itself and accelerates
 * out like a thrown object. The limiter also stops the spline bulging past a
 * flat run, which means an overshoot has to be an explicit keyframe rather
 * than an accident of the curve.
 */
const track = (p: number, S: number[], V: number[]) => {
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

const URL = "tafsir-lab.com";

const T = {
  sharp: 26,
  /** The arc, measured: 51 source frames at 29.97 is 102 of ours. */
  markFrom: 54, markFor: 102,
  /** The landing. Four source frames, and violent — the whole focus change
   *  happens at once, which is why the source's last fall frame is its busiest
   *  of the entire arc. Spreading it out was making the landing limp. */
  markFor2: 8,
  /** The source holds for 19 frames after the landing — the caret just
   *  sits — then lays the whole string down in 18. Both doubled. */
  paint: 194, paintFor: 36,
  /** Icons in, field to panel — half a second. */
  collapse: 266, collapseFor: 30,

  card1: 296,
  card2: 456,
  card3: 616,
  converge: 784, convergeFor: 46,
} as const;

const CARD = 560;
const STEP = CARD * 0.62;
const CARD_CY = 552;
/** Where the field is, and therefore where the first panel opens. */
const BAR_CY = H / 2;
const PILL_H = 96;

/**
 * The bar's last stretch of collapse, which is also the first panel's rise.
 *
 * One value drives both, so their opacities always sum to one. Easing the two
 * sides independently — which is what I had — leaves both near zero in the
 * middle, and since these are white cards on an off-white page the card
 * momentarily thins out to nothing. Measured on the render it disappeared
 * entirely for six frames, which is a worse artefact than the cut it was
 * meant to remove.
 */
const handover = (f: number) => {
  const c = easeIO((f - T.collapse) / T.collapseFor);
  return Math.max(0, Math.min(1, (c - 0.62) / 0.38));
};

/** Text inset from the field's left edge. */
const PAD = 40;
/** The frame the mark finishes and the field's own caret takes over. Both
 *  sides read this one constant, so they can never both be on screen. */
const CARET_AT = T.markFrom + T.markFor + T.markFor2;
/** The frame the mark lands on the bar line. Everything about the field's
 *  focus hangs off this: in the source the field does not light up early, it
 *  lights up BECAUSE the mark drops into it. */
const LANDED = T.markFrom + T.markFor;

/**
 * One source of truth for the field.
 *
 * The mark has to land exactly on the text line, and the text line moves,
 * because the field grows as it fills. Deriving both from here means they
 * cannot drift apart — the mark's left edge IS the field's text origin.
 */
const geom = (f: number) => {
  /* The field only opens out once the mark is in it. */
  const grow = springy((f - LANDED) / 30);
  const paint = track(interpolate(f, [T.paint, T.paint + T.paintFor], [0, 1], clamp), PS, PV);
  /* Bounded properly this time. The source's placeholder centres at 623, and
     the field has to sit between the menu glyph ending at 514 and the refresh
     starting at 738 — so symmetric about 623 it can be at most 218 source-px
     wide, not the 268 I had inferred from button centres. Its focus and text
     steps add 56 and 83. Scaled: 330 / 411 / 536, which puts the whole bar at
     35.6% of frame width against the source's 35.9%. */
  const w = interpolate(grow, [0, 1], [330, 411], clamp) + paint * 125;
  return { w, chars: paint * URL.length, textLeft: W / 2 - w / 2 + PAD };
};

/* ── The one moving object ────────────────────────────────────────────────
   Rule → dot → caret, all of it on the text line inside the field. The old
   version sent it on a loop up over the bar and back down, which crossed the
   placeholder twice and left a dot hanging in empty space for the best part
   of a second. The move is now 22px of travel and nothing but the shape
   changes: an underline retracts into a dot, the dot stands up into a caret.

   Only the width, height, radius and baseline are keyed. x is not — the left
   edge is pinned to the field's text origin, so the mark rides the field's
   growth for free and ends precisely where the caret belongs. */

/**
 * The mark's arc, measured off the reference frame by frame.
 *
 * Not approximated — tracked. Each row is [ref frame, centre-y, width, height]
 * of the black blob in the source's own 1280x714 / 29.97fps space, found by
 * thresholding and taking the largest connected component.
 *
 * What the numbers say, and what no amount of eyeballing gave me: the arc is
 * badly ASYMMETRIC. The rule sits still, then the gather and the launch are
 * one move — it slingshots, hitting 43.5px/frame upward at f22. It then decays
 * to the apex roughly halving each frame, which is damping, not gravity. It
 * HANGS: nine frames, 300ms, within 3px of the top. Then it falls on an
 * ease-in that builds to 28px/frame. Rise and fall are different curves, and
 * the hang between them is the whole character of the thing.
 */
const REF: [number, number, number, number][] = [
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

/* The source's bar line, and the scale onto ours. 1280 -> 1920 is exactly 1.5;
   714 -> 1080 is 1.512. Time is 29.97 -> 60, so almost exactly double. */
const REF_BAR_Y = 372, SX = 1.5, SY = 1.512;

const build = () => {
  const n = REF.length, span = REF[n - 1][0] - REF[0][0];
  const S: number[] = [], Y: number[] = [], Wd: number[] = [], Hd: number[] = [];
  for (let i = 0; i < n; i++) {
    S.push((REF[i][0] - REF[0][0]) / span);
    Y.push((REF[i][1] - REF_BAR_Y) * SY);
    /* w and h get a 3-tap smooth: at 43px/frame the blob smears, so single
       frames around the launch measure a shape the mark never actually is. */
    const a = REF[Math.max(0, i - 1)], b = REF[i], c = REF[Math.min(n - 1, i + 1)];
    Wd.push(((a[2] + 2 * b[2] + c[2]) / 4) * SX);
    Hd.push(((a[3] + 2 * b[3] + c[3]) / 4) * SY);
  }
  return { S, Y, Wd, Hd };
};
const M = build();

/**
 * The rule does not simply grow in place — it sweeps in from the right, and
 * it comes to rest CENTRED under the field.
 *
 * I first derived this by subtracting the back-arrow glyph's movement from
 * the rule's, treating the arrow as a fixed point on the UI. It is not: it
 * carries both the camera and the field's own layout shifts, so the residual
 * left the rule sitting 20-odd pixels right of centre for the whole of its
 * visible life. Measured instead against the field's true centre — the
 * midpoint of the placeholder, which is what the eye actually reads the rule
 * as being under — the source converges by source frame 8 and is centred from
 * frame 16 on. Stops are the arc's normalised time, values our pixels right
 * of the field's centre.
 *
 * The source still carries about 13px of residual right of centre at the
 * rule's widest, decaying to zero over the next twenty frames. I am not
 * keeping that. The rule reaches full width around p=0.13 and holds there
 * through its most visible moment, so it settles dead-centre just before, and
 * the sweep is done by then rather than still finishing under it.
 */
const XS = [0, 0.035, 0.07, 0.115, 1];
const XV = [190, 92, 28, 0, 0];

const Mark: React.FC<{ f: number }> = ({ f }) => {
  if (f < T.markFrom || f >= CARET_AT) return null;
  const p = (f - T.markFrom) / T.markFor;

  /* Through the arc the mark is shape only — it sits over the field's centre,
     directly above the placeholder, exactly as the source does. The move to
     the text inset is the FOCUS, and belongs to the landing, not the flight. */
  const arc = Math.min(1, p);
  let w = track(arc, M.S, M.Wd);
  let h = track(arc, M.S, M.Hd);
  let x = W / 2 + track(arc, XS, XV);
  let y = BAR_CY + track(arc, M.S, M.Y);

  /* Smear. The launch peaks at 33px/frame — three times the mark's own height
     — and the source carries motion blur from its render, so it reads as a
     streak. Drawn sharp at that speed it would strobe instead, landing in
     discrete places. Stretching along travel and thinning as it goes is how
     this is done by hand, and it costs nothing. */
  const v = arc >= 1 ? 0
    : (track(Math.min(1, (f + 1 - T.markFrom) / T.markFor), M.S, M.Y)
     - track(Math.min(1, (f - 1 - T.markFrom) / T.markFor), M.S, M.Y)) / 2;
  const smear = Math.min(Math.abs(v) * 1.15, 78);

  if (p > 1) {
    /* Landed. The field focuses: the placeholder goes, the text origin moves
       left, and the mark rides across with it, thinning into the caret. */
    const s = easeIO((f - (T.markFrom + T.markFor)) / (T.markFor2));
    x = interpolate(s, [0, 1], [W / 2, geom(f).textLeft + 2]);
    w = interpolate(s, [0, 1], [w, 3]);
    h = interpolate(s, [0, 1], [h, 57]);
    y = BAR_CY;
  }

  const hs = h + smear;
  return (
    <div style={{
      position: "absolute", left: x - w / 2, top: y - hs / 2,
      width: w, height: hs, borderRadius: Math.min(w, hs) / 2,
      background: "#111114", zIndex: 40,
      opacity: 1 - Math.min(smear / 78, 1) * 0.22,
      filter: smear > 2 ? `blur(${smear * 0.12}px)` : undefined,
    }} />
  );
};

/* ── Glass ────────────────────────────────────────────────────────────────*/

const glass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(246,247,251,0.86))",
  backdropFilter: "blur(26px)",
  WebkitBackdropFilter: "blur(26px)",
  border: "1px solid rgba(255,255,255,0.92)",
  boxShadow:
    "0 14px 40px rgba(28,36,64,0.13), 0 3px 10px rgba(28,36,64,0.07), " +
    "0 0 0 1px rgba(28,36,64,0.045), " +
    "inset 0 1.5px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(255,255,255,0.6)",
};

/* Measured against the source's back arrow: its glyph ink averages 83,
   mine averaged 124 — half again as pale, which is most of why the bar
   read as washed out beside it. */
const ic = { fill: "none", stroke: "#26262b", strokeWidth: 2.95,
             strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const Round: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> =
({ children, style }) => (
  <div style={{
    width: 78, height: 78, borderRadius: 39, ...glass,
    display: "grid", placeItems: "center", flexShrink: 0, ...style,
  }}>{children}</div>
);

const Bar: React.FC<{ f: number }> = ({ f }) => {
  const push = interpolate(f, [0, T.sharp + 12], [0.88, 1], clamp);
  const soft = interpolate(f, [0, T.sharp], [13, 0], clamp);

  /* The collapse: side buttons drawn in, field grown into the panel. */
  const c = easeIO((f - T.collapse) / T.collapseFor);
  if (c >= 1) return null;
  /* The field ends the collapse at exactly the first panel's size, radius,
     centre and y, so the two are the same rectangle. The panel rises on the
     complement of this, so the shape is continuous and only its contents
     change — the panel IS the field, continued. */
  const hand = handover(f);

  /* Continuous, not a boolean. The old `focused` flag flipped the background,
     the alignment, the text colour and the whole placeholder-to-URL swap on a
     single frame — six properties changing at once, which is a cut. */
  const foc = interpolate(f, [LANDED - 2, LANDED + 6], [0, 1], clamp);
  const g = geom(f);
  /* Revealed by character, so the caret sitting after the text in flow is
     always exactly at the end of what has been painted — no measuring, and
     no way for the two to disagree. */
  const full = Math.floor(g.chars);
  const frac = g.chars - full;
  const gone = 1 - c * 2.2;

  const pw = interpolate(c, [0, 1], [g.w, CARD]);
  const ph = interpolate(c, [0, 1], [PILL_H, CARD]);
  const pr = interpolate(c, [0, 1], [PILL_H / 2, 24]);
  const cy = interpolate(c, [0, 1], [BAR_CY, CARD_CY]);
  /* The first panel opens where the field was, so the side buttons travel
     inward into it rather than simply switching off. */
  const side = interpolate(c, [0, 1], [0, 150]);

  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: cy,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 22,
      transform: `translateY(-50%) scale(${push})`,
      filter: soft > 0.1 ? `blur(${soft}px)` : undefined,
      zIndex: 30, opacity: 1 - hand,
    }}>
      {/* Two buttons each side, which is how the source is laid out and, more
          to the point, the only way the field's centre and the row's centre
          are the same point. With one button left and two right the field sat
          50px left of the row — so the mark, the caret and the panel the field
          collapses into were all measuring from a centre the field was not on.
          That is why the rule looked off, and why the collapse cut. */}
      <Round style={{
        transform: `translateX(${side}px) scale(${1 - c})`, opacity: 1 - c * 1.4,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" {...ic}><path d="M15 5l-7 7 7 7" /></svg>
      </Round>

      <Round style={{
        transform: `translateX(${side * 0.72}px) scale(${1 - c})`, opacity: 1 - c * 1.4,
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" {...ic}>
          <path d="M4 7h16M4 12h10M4 17h13" />
        </svg>
      </Round>

      <div style={{
        width: pw, height: ph, borderRadius: pr, ...glass,
        background: `rgba(255,255,255,${0.66 + 0.3 * foc})`,
        boxSizing: "border-box", overflow: "hidden", position: "relative",
        /* The source sets its address at 0.600 of the field's height; at 37 I
   was at 0.479, which made the field look empty around it. */
        fontFamily: R.fontSans, fontSize: 46,
      }}>
        {/* Placeholder and magnifier are absolute, so when they go nothing
            reflows around them — the field just clears. */}
        <span style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          color: "#8e8e95", opacity: (1 - foc) * gone, whiteSpace: "nowrap",
        }}>search...</span>
        <svg width="32" height="32" viewBox="0 0 24 24" {...ic}
          style={{ position: "absolute", right: 34, top: "50%", marginTop: -16,
                   opacity: (1 - foc) * gone }}>
          <path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 5v6h-6" />
        </svg>

        <span style={{
          position: "absolute", left: PAD, top: "50%",
          transform: "translateY(-50%)", display: "flex", alignItems: "center",
          whiteSpace: "nowrap", color: "#111114", opacity: gone,
        }}>
          {URL.slice(0, full)}
          {full < URL.length && (
            <span style={{ opacity: Math.min(1, frac * 1.9),
                           filter: `blur(${(1 - frac) * 5}px)` }}>
              {URL[full]}
            </span>
          )}
          {/* The mark, continued. It ends at 3 x 46 on this exact line, so the
              swap on CARET_AT moves nothing. No blink — at this length a blink
              only ever reads as a glitch. */}
          {f >= CARET_AT && (
            <span style={{ display: "inline-block", width: 4, height: 57,
                           background: "#111114", flexShrink: 0 }} />
          )}
        </span>
      </div>

      {/* Refresh, then copy — the source has both, and they travel inward at
          slightly different rates so the collapse gathers rather than slides. */}
      <Round style={{
        transform: `translateX(${-side * 0.72}px) scale(${1 - c})`, opacity: 1 - c * 1.4,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" {...ic}>
          <path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 5v6h-6" />
        </svg>
      </Round>

      <Round style={{
        transform: `translateX(${-side}px) scale(${1 - c})`, opacity: 1 - c * 1.4,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" {...ic} strokeLinecap="butt">
          <rect x="8" y="4" width="12" height="12" rx="2.5" />
          <path d="M16 20H6a2 2 0 01-2-2V8" strokeLinecap="round" />
        </svg>
      </Round>
    </div>
  );
};

/* ── Panels ───────────────────────────────────────────────────────────────*/

const NOTE = "Seven verses, and the naming of them is given elsewhere.";

const EditorPane: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const s = at + 2;
  const body = NOTE.slice(0, Math.max(0, Math.floor((f - s - 18) * 0.5)));
  return (
    <div style={{ padding: 34, height: "100%", boxSizing: "border-box", background: "#fff" }}>
      <div style={{
        fontFamily: R.fontSerif, fontSize: 34, fontWeight: 700, color: "#1e1a14",
        opacity: ease((f - s) / 18), letterSpacing: "-0.01em",
      }}>As-Sabʿ al-Mathānī</div>
      <div style={{
        fontFamily: R.fontSans, fontSize: 16, color: "#908d88", marginTop: 8,
        opacity: ease((f - s - 6) / 18),
      }}>Study note · Al-Fātiḥah</div>
      <div style={{
        fontFamily: R.fontSans, fontSize: 21, lineHeight: 1.65, color: "#46423b",
        marginTop: 26, minHeight: 190,
      }}>
        {body}
        <span style={{
          display: "inline-block", width: 2, height: 22, background: "#1e1a14",
          marginLeft: 3, verticalAlign: "text-bottom",
          opacity: Math.floor(f / 16) % 2 === 0 ? 1 : 0,
        }} />
      </div>
      <div style={{
        padding: "16px 18px", borderRadius: 10,
        border: "1px solid rgba(30,26,20,0.10)",
        opacity: ease((f - s - 106) / 24),
      }}>
        <div style={{
          fontFamily: R.fontMono, fontSize: 13, color: "#908d88",
          letterSpacing: "0.06em", marginBottom: 10,
        }}>AL-ḤIJR 15:87</div>
        <div dir="rtl" style={{
          fontFamily: R.fontArabic, fontSize: 29, lineHeight: 1.95, color: "#1e1a14",
        }}>وَلَقَدْ آتَيْنَاكَ سَبْعًا مِّنَ الْمَثَانِي</div>
      </div>
    </div>
  );
};

/* Sūrat al-Fātiḥah as the page sets it: verses run on, each closed by a
   numbered marker, rather than one verse to a line. */
type Seg = string | number;
const FATIHA: Seg[][] = [
  ["بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", 1],
  ["ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ", 2],
  ["ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", 3, "مَٰلِكِ يَوْمِ ٱلدِّينِ", 4],
  ["إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", 5, "ٱهْدِنَا"],
  ["ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ", 6, "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ"],
  ["عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ"],
  ["وَلَا ٱلضَّآلِّينَ", 7],
];
const AR = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧"];

/** The page's āyah marker: a fine double ring, the last one warmed. */
const AyahMark: React.FC<{ n: number }> = ({ n }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 23, height: 23, borderRadius: "50%",
    border: `1px solid ${n === 7 ? "rgba(196,110,64,0.75)" : "rgba(30,26,20,0.42)"}`,
    boxShadow: `inset 0 0 0 2px #fff, inset 0 0 0 3px ${
      n === 7 ? "rgba(196,110,64,0.30)" : "rgba(30,26,20,0.16)"}`,
    fontFamily: R.fontArabic, fontSize: 11,
    color: n === 7 ? "#b1613a" : "#1e1a14",
    margin: "0 5px", verticalAlign: "middle", flexShrink: 0,
  }}>{AR[n]}</span>
);

const CanvasPane: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const s = at + 14;
  return (
    <div style={{
      height: "100%", boxSizing: "border-box", background: "#fff",
      padding: "30px 18px 0", display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 13,
        padding: "11px 26px", borderRadius: 14,
        border: "1px solid rgba(30,26,20,0.12)", background: "#fff",
        opacity: ease((f - s) / 18),
      }}>
        <span style={{ fontSize: 11, color: "#a8a29a" }}>▾</span>
        <span style={{ fontFamily: R.fontSans, fontSize: 19, color: "#2b2823" }}>Al-Fatihah</span>
        <span style={{ fontFamily: R.fontArabic, fontSize: 25, fontWeight: 700, color: "#1e1a14" }}>
          الفاتحة
        </span>
      </div>
      <div style={{
        fontFamily: R.fontSans, fontSize: 14, color: "#a2938a", marginTop: 16,
        opacity: ease((f - s - 8) / 18),
      }}>Press the Surah name to start studying</div>

      <div style={{ marginTop: 20, width: "100%" }}>
        {FATIHA.map((line, i) => {
          const p = ease((f - (s + 24 + i * 14)) / 26);
          if (p <= 0) return null;
          return (
            <div key={i} dir="rtl" style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: R.fontArabic, fontSize: 25, lineHeight: 2.05,
              color: "#1e1a14", whiteSpace: "nowrap",
              clipPath: `inset(0 0 0 ${(1 - p) * 100}%)`,
            }}>
              {line.map((seg, k) =>
                typeof seg === "number"
                  ? <AyahMark key={k} n={seg} />
                  : <span key={k}>{seg}&nbsp;</span>)}
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: "auto", width: "100%", height: 1,
        background: "rgba(30,26,20,0.09)", opacity: ease((f - s - 140) / 20),
      }} />
    </div>
  );
};

const BOOKS = [
  { ar: "الأصول الثلاثة",     en: "Three Principles",  c: "#6b7f9e" },
  { ar: "القواعد الأربع",     en: "Four Foundations",  c: "#6b7f9e" },
  { ar: "العقيدة الواسطية",   en: "Al-Wāsiṭiyyah",     c: "#6b7f9e" },
  { ar: "الأربعون النووية",   en: "Forty Ḥadīth",      c: "#8a7a5e" },
  { ar: "عمدة الأحكام",       en: "ʿUmdat al-Aḥkām",   c: "#8a7a5e" },
  { ar: "المنظومة البيقونية", en: "Al-Bayqūniyyah",    c: "#7d6b86" },
  { ar: "الورقات",            en: "Al-Waraqāt",        c: "#7d6b86" },
  { ar: "الآجرومية",          en: "Al-Ājurrūmiyyah",   c: "#9e6b6b" },
];

const LibraryPane: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const s = at + 16;
  const BW = 132, BG = 16;
  const total = BOOKS.length * (BW + BG);
  const scroll = interpolate(f, [s + 26, s + 190], [0, total - (CARD - 56)], clamp);
  return (
    <div style={{
      height: "100%", boxSizing: "border-box", background: "#fff",
      padding: "26px 0 0", overflow: "hidden",
    }}>
      <div style={{
        fontFamily: R.fontSans, fontSize: 14, color: "#908d88", padding: "0 28px",
        letterSpacing: "0.11em", textTransform: "uppercase",
        opacity: ease((f - s) / 18),
      }}>Mutūn · {BOOKS.length} texts</div>
      <div style={{
        display: "flex", gap: BG, marginTop: 22, paddingLeft: 28,
        transform: `translateX(${-scroll}px)`,
      }}>
        {BOOKS.map((b, i) => {
          const e = ease((f - (s + 12 + i * 7)) / 24);
          return (
            <div key={b.en} style={{
              width: BW, flexShrink: 0, height: 386, borderRadius: 8,
              background: "#fff", border: "1px solid rgba(30,26,20,0.10)",
              boxShadow: "0 3px 14px rgba(30,26,20,0.08)",
              overflow: "hidden", display: "flex", flexDirection: "column",
              opacity: e, transform: `translateY(${(1 - e) * 26}px)`,
            }}>
              <div style={{ height: 8, background: b.c }} />
              <div style={{
                flex: 1, padding: "20px 12px", display: "flex",
                flexDirection: "column", alignItems: "center", gap: 11,
              }}>
                <div dir="rtl" style={{
                  fontFamily: R.fontArabic, fontSize: 21, lineHeight: 1.55,
                  color: "#1e1a14", textAlign: "center",
                }}>{b.ar}</div>
                <div style={{ width: 28, height: 1, background: "rgba(30,26,20,0.13)" }} />
                <div style={{
                  fontFamily: R.fontSans, fontSize: 12, lineHeight: 1.35,
                  color: "#73706a", textAlign: "center",
                }}>{b.en}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── The stack, and the mark it becomes ───────────────────────────────────*/

const PANELS = [
  { at: T.card1, label: "editor", Pane: EditorPane },
  { at: T.card2, label: "canvas", Pane: CanvasPane },
  { at: T.card3, label: "mutoon", Pane: LibraryPane },
] as const;

const LOGO = 300;

const Stack: React.FC<{ f: number }> = ({ f }) => {
  /* Only arrivals AFTER the first move the group. Counting the first one meant
     the whole stack sat 180px right of centre until it had "landed", so the
     field collapsed into a panel that was not where the field had been — which
     is what put a second edge alongside it during the handover. */
  let after = 0;
  for (const p of PANELS.slice(1)) after += easeIO((f - p.at) / 40);
  const groupX = -after * (STEP * 0.52);

  let speed = 0;
  for (const p of PANELS.slice(1)) {
    const d = f - p.at;
    if (d > -6 && d < 46) speed = Math.max(speed, Math.sin(Math.max(0, Math.min(1, (d + 6) / 52)) * Math.PI));
  }

  const cv = easeIO((f - T.converge) / T.convergeFor);

  return (
    <div style={{
      position: "absolute", inset: 0,
      transform: `translateX(${groupX * (1 - cv)}px)`,
      filter: speed > 0.02 ? `blur(${speed * 1.9}px)` : undefined,
    }}>
      {PANELS.map((p, i) => {
        if (f < (i === 0 ? T.collapse : p.at - 10)) return null;
        const e = easeIO((f - p.at) / 40);
        let depth = 0;
        for (let k = i + 1; k < PANELS.length; k++) depth += easeIO((f - PANELS[k].at) / 40);
        depth *= 1 - cv;

        /* The FIRST panel is what the search field became. It does not fly in
           from anywhere — it is already there, at exactly the size and place
           the field collapsed to, or the collapse was for nothing. */
        const first = i === 0;
        const home = W / 2 - CARD / 2 + i * STEP;
        const x0 = first ? home : home + (1 - e) * 320;
        const x = interpolate(cv, [0, 1], [x0, W / 2 - LOGO / 2], clamp);
        const size = interpolate(cv, [0, 1], [CARD, LOGO]);
        const y = interpolate(cv, [0, 1], [CARD_CY - CARD / 2, CARD_CY - LOGO / 2], clamp);

        return (
          <div key={p.label} style={{
            position: "absolute", left: x, top: y,
            width: size, zIndex: 10 + i,
            opacity: first ? handover(f) : Math.min(1, e * 1.7),
            /* Enough to move attention forward, not enough to hide anything. */
            filter: depth > 0.02 ? `blur(${Math.min(depth, 1) * 1.35}px)` : undefined,
          }}>
            {/* Sits ABOVE the card rather than in the flow, so the card's top
                edge is the container's top edge — otherwise the panel ends up
                40px below the mark it converges into and leaves a white lip
                under it. */}
            <div style={{
              position: "absolute", left: 4, bottom: "100%", marginBottom: 11,
              display: "flex", alignItems: "center", gap: 9,
              opacity: (1 - cv * 2) * (first ? ease((f - p.at) / 20) : 1),
            }}>
              <svg width="22" height="18" viewBox="0 0 22 18">
                <path d="M1 3.5A2.5 2.5 0 013.5 1h4.2l2 2.2h8.8A2.5 2.5 0 0121 5.7v9.8A2.5 2.5 0 0118.5 18h-15A2.5 2.5 0 011 15.5z"
                  fill="#63b3f5" />
              </svg>
              <span style={{ fontFamily: R.fontSans, fontSize: 20, color: "#4a4a51",
                whiteSpace: "nowrap" }}>{p.label}</span>
            </div>

            <div style={{
              width: size, height: size,
              borderRadius: interpolate(cv, [0, 1], [24, 72]),
              overflow: "hidden",
              boxShadow: "0 22px 54px rgba(20,22,34,0.13), 0 4px 12px rgba(20,22,34,0.07), " +
                         "0 0 0 1px rgba(20,22,34,0.065)",
              background: "#fff",
            }}>
              <div style={{
                width: CARD, height: CARD,
                transform: `scale(${size / CARD})`, transformOrigin: "0 0",
                opacity: 1 - cv * 1.6,
              }}>
                <p.Pane f={f} at={p.at} />
              </div>
            </div>
          </div>
        );
      })}

      {cv > 0.02 && (
        <div style={{
          position: "absolute", left: W / 2 - LOGO / 2, top: CARD_CY - LOGO / 2,
          width: LOGO, height: LOGO, borderRadius: 72, background: "#1e1a14",
          display: "grid", placeItems: "center", zIndex: 60,
          opacity: interpolate(cv, [0.45, 1], [0, 1], clamp),
          transform: `scale(${interpolate(cv, [0.45, 1], [1.06, 1], clamp)})`,
          boxShadow: "0 26px 60px rgba(20,22,34,0.20)",
        }}>
          <span style={{
            fontFamily: R.fontSans, fontSize: 168, fontWeight: 700, color: "#fff",
          }}>T</span>
        </div>
      )}

      {cv >= 1 && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: CARD_CY + LOGO / 2 + 54,
          textAlign: "center", zIndex: 60,
          opacity: ease((f - (T.converge + T.convergeFor + 6)) / 22),
        }}>
          <div style={{
            fontFamily: R.fontSerif, fontSize: 62, color: "#1e1a14", letterSpacing: "-0.025em",
          }}>Tafsir Lab</div>
          <div style={{
            fontFamily: R.fontSans, fontSize: 21, color: "#8b8880", marginTop: 14,
            letterSpacing: "0.2em", textTransform: "uppercase",
          }}>tafsir-lab.com</div>
        </div>
      )}
    </div>
  );
};

/* ── Composition ──────────────────────────────────────────────────────────*/

const Sfx: React.FC<{ at: number; file: string; v: number; len?: number }> =
({ at, file, v, len = 20 }) => (
  <Sequence from={at} durationInFrames={len}>
    <Audio src={staticFile(file)} volume={v} />
  </Sequence>
);

/**
 * The camera, which in the source never stops.
 *
 * Tracked off the back-arrow glyph, with the two outer buttons' separation
 * giving the scale. It is NOT a constant drift, which is what I assumed and
 * built first. Measuring the two side by side, per phase, showed the opposite:
 *
 *   phase    ref    my first attempt
 *   rule     0.569  0.219   far too still
 *   launch   0.605  0.541   about right
 *   hang     0.054  0.196   THREE AND A HALF TIMES TOO BUSY
 *
 * The source pans hard and early — about 10 source-px a frame while the rule
 * draws — and then stops dead. Through the hang it is almost perfectly still,
 * which is what makes the hang land: everything else quits so the one floating
 * object has the frame. An even drift fills that silence in and throws the
 * whole shape of the sequence away. Resolves to identity before the collapse.
 */
const CS = [0, 60, 68, 76, 84, 92, 100, 108, 116, 124, 132, 140, 148, 156, 200, T.collapse];
const CX = [116, 116, 58, 26, 7.5, -1.5, -3, 0, 0.8, 2.3, 3.8, 6.8, 15.8, 41, 14, 0];
const CZ = [1.061, 1.061, 1.056, 1.056, 1.054, 1.048, 1.030, 1.009,
            1.000, 0.996, 1.000, 1.011, 1.005, 0.995, 1, 1];

const Drift: React.FC<{ f: number; children: React.ReactNode }> = ({ f, children }) => {
  const p = Math.min(f, T.collapse);
  return (
    <AbsoluteFill style={{
      transform: `translateX(${track(p, CS, CX)}px) scale(${track(p, CS, CZ)})`,
      transformOrigin: "50% 50%",
    }}>{children}</AbsoluteFill>
  );
};

export const SearchReel: React.FC = () => {
  const f = useCurrentFrame();
  /* The source's page, sampled: 252,249,253. Reads as white, but it lets the
     white chrome and the white cards sit ON it rather than dissolve into it. */
  return (
    <AbsoluteFill style={{ background: "#fcf9fd" }}>
     <Drift f={f}>
      {/* There is no bloom. I had put a blue one above the field believing the
          source carried one; sampling the band directly above its bar gives
          blue-minus-red of +0.90, which is neutral, against +4.58 for mine.
          The source's page is flat — every soft edge on it comes from the
          drop shadows under the chrome, and nothing else. */}
      <Stack f={f} />
      <Bar f={f} />
      <Mark f={f} />
     </Drift>

      <Audio
        src={staticFile("bg2.mp3")}
        startFrom={33 * 60}
        volume={(fr) =>
          0.18 * interpolate(fr, [0, 50, SEARCH_FRAMES - 60, SEARCH_FRAMES], [0, 1, 1, 0], clamp)}
      />

      {/* The mark snapping into the field. */}
      <Sfx at={T.markFrom + Math.round(T.markFor * 0.90)} file="sfx/uiclick.mp3" v={0.72} len={26} />
      {/* The address resolving. */}
      <Sfx at={T.paint} file="sfx/uitype.mp3" v={0.5} len={70} />
      {/* The field growing into the first panel. */}
      <Sfx at={T.collapse} file="sfx/uiwhoosh.mp3" v={0.9} len={80} />
      <Sfx at={T.collapse + 22} file="sfx/uipop.mp3" v={0.5} len={40} />
      {/* Each later panel: the travel, then the landing. */}
      {PANELS.slice(1).map((p) => (
        <React.Fragment key={p.label}>
          <Sfx at={p.at - 8} file="sfx/uiswish.mp3" v={0.66} len={32} />
          <Sfx at={p.at + 16} file="sfx/uipop.mp3" v={0.44} len={40} />
        </React.Fragment>
      ))}
      {/* Three becoming one. */}
      <Sfx at={T.converge} file="sfx/uiwhoosh.mp3" v={1.0} len={80} />
      <Sfx at={T.converge + T.convergeFor - 6} file="sfx/uiclick.mp3" v={0.6} len={26} />
    </AbsoluteFill>
  );
};
