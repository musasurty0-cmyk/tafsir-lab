import React from "react";
import { interpolate } from "remotion";
import { R, D } from "../reelTokens";

/* ── Morph engine ──────────────────────────────────────────────────────────
   Built from the frame counts measured in trailer/MOTION-STUDY.md.

   There is ONE container on screen for the whole reel. It never cuts and never
   crossfades: it blurs, resizes, moves, and comes back with different content
   inside. The references get seven "screens" out of a single rounded rectangle
   this way, and it is the reason their UI reads as an object rather than a
   slideshow.

   All frame counts here are the measured 30fps values DOUBLED, because these
   compositions run at 60.                                                    */

export const FRAME_W = 1080;
export const FRAME_H = 1920;

/* ── Theme ────────────────────────────────────────────────────────────────
   Light and dark are both the app's own tokens. The reel drops from one to the
   other mid-way, which is the references' single biggest tonal device — and it
   costs nothing here because the product genuinely has both.                */

export interface Theme {
  stage: string; card: string; panel: string; panel2: string;
  ink: string; ink2: string; ink3: string; ink4: string;
  line: string; lineStrong: string;
  accent: string; accentSoft: string; accentInk: string;
  iconLink: string; shadowMd: string; shadowLg: string;
}

/** Stage is ~10% darker than the card in light — the reference reels both
 *  sample to #e5e4e9 behind #ffffff, a ratio of 1.25:1. This is the warm
 *  equivalent, so it belongs to TafsirLab's palette rather than borrowing
 *  theirs. Dark uses the app's own bg/bg-elev pair. */
export const STAGE = "#e9e5de";

export const LIGHT: Theme = {
  stage: STAGE, card: R.bgElev, panel: R.panel, panel2: R.panel2,
  ink: R.ink, ink2: R.ink2, ink3: R.ink3, ink4: R.ink4,
  line: R.line, lineStrong: R.lineStrong,
  accent: R.accent, accentSoft: R.accentSoft, accentInk: R.accentInk,
  iconLink: R.iconLink, shadowMd: R.shadowMd, shadowLg: R.shadowLg,
};

export const DARK: Theme = {
  stage: D.paper, card: D.bgElev, panel: D.panel, panel2: D.panel2,
  ink: D.ink, ink2: D.ink2, ink3: D.ink3, ink4: D.ink4,
  line: D.line, lineStrong: D.lineStrong,
  accent: D.accent, accentSoft: D.accentSoft, accentInk: D.accentInk,
  iconLink: D.iconLink, shadowMd: D.shadowMd, shadowLg: D.shadowLg,
};

const parse = (c: string): [number, number, number, number] => {
  if (c.startsWith("#")) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16),
            parseInt(c.slice(5, 7), 16), 1];
  }
  const n = c.replace(/[^\d.,]/g, "").split(",").map(Number);
  return [n[0], n[1], n[2], n[3] ?? 1];
};

export const mix = (a: string, b: string, t: number): string => {
  const [ar, ag, ab, aa] = parse(a);
  const [br, bg, bb, ba] = parse(b);
  const l = (x: number, y: number) => x + (y - x) * t;
  return `rgba(${Math.round(l(ar, br))}, ${Math.round(l(ag, bg))}, ${Math.round(l(ab, bb))}, ${l(aa, ba).toFixed(3)})`;
};

/** t = 0 light, 1 dark. Shadows swap at the halfway point rather than mixing;
 *  interpolating two box-shadow strings is not meaningful. */
export const mixTheme = (t: number): Theme => {
  if (t <= 0) return LIGHT;
  if (t >= 1) return DARK;
  const out = {} as Theme;
  for (const k of Object.keys(LIGHT) as (keyof Theme)[]) {
    out[k] = k === "shadowMd" || k === "shadowLg"
      ? (t < 0.5 ? LIGHT[k] : DARK[k])
      : mix(LIGHT[k], DARK[k], t);
  }
  return out;
};

export const themeAt = (f: number, keys: { at: number; t: number }[]): Theme => {
  let t = keys[0].t;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (f >= b.at) { t = b.t; continue; }
    if (f > a.at) {
      t = a.t + (b.t - a.t) * ((f - a.at) / Math.max(1, b.at - a.at));
      break;
    }
  }
  return mixTheme(Math.max(0, Math.min(1, t)));
};

const ThemeCtx = React.createContext<Theme>(LIGHT);
export const ThemeProvide = ThemeCtx.Provider;
export const useTheme = () => React.useContext(ThemeCtx);

/* ── States ───────────────────────────────────────────────────────────────*/

export interface MState {
  /** Frame this state is fully settled and begins its hold. */
  at: number;
  /** Frames the morph INTO this state takes: 24 for a small move, 32 medium,
   *  40 large. Distance, not feel — see `tierOf`. */
  morph: number;
  w: number; h: number; r: number;
  /** Where the container's centre sits. Defaults to the frame centre.
   *  Moving it horizontally AND vertically is what stops a run of states
   *  reading as one composition repeated over and over. */
  cx?: number; cy?: number;
  /** Curve for the morph INTO this state. */
  ease?: EaseName;
  /** How the OUTGOING content leaves. `fall` drops it out of the bottom of
   *  the container under gravity instead of smearing it sideways. */
  exit?: "smear" | "fall";
  key: string;
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ── Camera graphs ────────────────────────────────────────────────────────
   One curve for every move is what makes a sequence feel mechanical, however
   well the individual moves are timed. Four, chosen per transition:

     back    overshoots and settles   — pops, arrivals, things landing
     smooth  symmetric S-curve        — long travels across the frame
     snap    hard front-load          — swaps that should feel instant
     glide   fast out, long tail      — reveals that need a soft landing

   Only `back` overshoots its target, which is why the margin check matters
   most on transitions that use it. */
export type EaseName = "back" | "smooth" | "snap" | "glide";

export const EASES: Record<EaseName, (t: number) => number> = {
  back:   (t) => 1 + 2.15 * Math.pow(t - 1, 3) + 1.15 * Math.pow(t - 1, 2),
  smooth: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  snap:   (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  glide:  (t) => 1 - Math.pow(1 - t, 5),
};

/** How far the container travels, size and position together. */
export const distOf = (a: MState, b: MState) =>
  Math.abs(a.w - b.w) + Math.abs(a.h - b.h) +
  Math.abs((a.cx ?? FRAME_W / 2) - (b.cx ?? FRAME_W / 2)) +
  Math.abs((a.cy ?? FRAME_H / 2) - (b.cy ?? FRAME_H / 2));

export const tierOf = (d: number) => (d < 200 ? 24 : d < 600 ? 32 : 40);

export interface MorphFrame {
  w: number; h: number; r: number; cx: number; cy: number;
  /** Blur applied to the container. Peaks mid-morph. */
  blur: number;
  old?: { key: string; opacity: number; x: number; y: number; rot: number; blur: number };
  now: { key: string; opacity: number };
  /** Frame the current content began landing — feed to <Words start>. */
  contentStart: number;
}

/**
 * Anatomy of one morph, as counted off the reference:
 *
 *   p 0.00–0.13  old content blurs out and smears +X
 *   p 0.13–0.42  peak blur; old content GONE, container resizing
 *   p 0.42–0.55  container lands (overshoots, settles); blur clears
 *   p 0.50–1.00  new content lands, word by word
 *
 * The old content is fully gone before the new arrives. Never crossfade two
 * legible states — that is what makes a dissolve look like a dissolve.
 */
export function morphAt(f: number, S: MState[]): MorphFrame {
  let i = 0;
  for (let k = 0; k < S.length; k++) if (S[k].at <= f) i = k;

  const a = S[i];
  const b = S[i + 1];
  const cx = (s: MState) => s.cx ?? FRAME_W / 2;
  const cy = (s: MState) => s.cy ?? FRAME_H / 2;
  const inMorph = b !== undefined && f > b.at - b.morph;

  if (!inMorph) {
    return {
      w: a.w, h: a.h, r: a.r, cx: cx(a), cy: cy(a), blur: 0,
      now: { key: a.key, opacity: 1 },
      contentStart: a.at - a.morph * 0.5,
    };
  }

  const from = b.at - b.morph;
  const p = clamp01((f - from) / b.morph);
  const e = EASES[b.ease ?? "back"](clamp01((p - 0.15) / 0.4));

  /* A fall needs longer on screen than a sideways smear, so its windows are
     stretched and the blur peak is pushed back to match. The invariant is the
     same either way: the old content is completely gone before the blur peaks,
     and the new content has not started. */
  const fall = b.exit === "fall";
  const gone = fall ? 0.34 : 0.13;
  const k = clamp01(p / gone);

  return {
    w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e), r: lerp(a.r, b.r, e),
    cx: lerp(cx(a), cx(b), e), cy: lerp(cy(a), cy(b), e),
    blur: fall
      ? interpolate(p, [0.30, 0.40, 0.50, 0.60], [0, 20, 20, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(p, [0, 0.17, 0.42, 0.55], [0, 20, 20, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    old: {
      key: a.key,
      /* Gravity: distance goes with the square of the time, so it leaves
         slowly and is gone quickly — the opposite of a fade. */
      opacity: fall ? 1 - k * k : interpolate(p, [0, gone], [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      x: fall ? 0 : interpolate(p, [0, gone], [0, 44],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      y: fall ? k * k * 460 : 0,
      rot: fall ? k * 5 : 0,
      blur: interpolate(p, [0, gone], [0, fall ? 6 : 16],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    },
    now: {
      key: b.key,
      opacity: interpolate(p, [fall ? 0.62 : 0.46, fall ? 0.74 : 0.6], [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    },
    contentStart: from + b.morph * (fall ? 0.66 : 0.5),
  };
}

/* ── Stage and container ──────────────────────────────────────────────────*/

export const Stage: React.FC<{ theme: Theme; children: React.ReactNode }> =
({ theme, children }) => (
  <div style={{
    position: "absolute", inset: 0, overflow: "hidden",
    background: theme.stage, perspective: 2600, perspectiveOrigin: "50% 50%",
  }}>
    {children}
  </div>
);

export const Card: React.FC<{
  m: MorphFrame; tilt?: number; children: React.ReactNode;
}> = ({ m, tilt = 0, children }) => {
  const th = useTheme();
  return (
    <div style={{
      position: "absolute",
      left: m.cx - m.w / 2,
      top: m.cy - m.h / 2,
      width: m.w, height: m.h,
      background: th.card,
      border: `1px solid ${th.line}`,
      borderRadius: m.r,
      /* Inner highlight kept very light. Past 6% the surface goes muddy. */
      boxShadow: `${th.shadowMd}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      /* Only a fraction of the morph blur reaches the container itself. The
         reference keeps the object SOLID through the transition and empties
         its contents; blurring the whole card at 20px dissolves its
         silhouette into the stage and the object stops being an object. */
      filter: m.blur > 0.05 ? `blur(${m.blur * 0.3}px)` : undefined,
      transform: tilt === 0 ? undefined
        : `rotateX(${tilt * 3.5}deg) rotateY(${tilt * -6}deg)`,
      transformStyle: tilt === 0 ? undefined : "preserve-3d",
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
};

/* ── Per-word catch-up ────────────────────────────────────────────────────
   The move that does the most work and is easiest to miss. A label does NOT
   fade in as a unit: the first word lands, then each following word arrives
   from the right and slightly below the baseline and decelerates in.        */

export const Words: React.FC<{
  f: number; start: number; text: string;
  step?: number; travel?: number; style?: React.CSSProperties;
}> = ({ f, start, text, step = 8, travel = 22, style }) => (
  <span style={style}>
    {text.split(" ").map((word, i) => {
      const t = clamp01((f - (start + i * step)) / travel);
      const e = 1 - Math.pow(1 - t, 3);
      return (
        <span key={`${word}-${i}`} style={{
          display: "inline-block",
          opacity: e,
          transform: `translate(${(1 - e) * 38}px, ${(1 - e) * 9}px)`,
          marginRight: "0.28em",
        }}>{word}</span>
      );
    })}
  </span>
);

/** Same arrival for a block with no words to stagger. */
export const Rise: React.FC<{
  f: number; start: number; i?: number; children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ f, start, i = 0, children, style }) => {
  const t = clamp01((f - (start + i * 7)) / 22);
  const e = 1 - Math.pow(1 - t, 3);
  return (
    <div style={{ ...style, opacity: e, transform: `translate(${(1 - e) * 26}px, ${(1 - e) * 7}px)` }}>
      {children}
    </div>
  );
};

/* ── Stage text ───────────────────────────────────────────────────────────
   The explanation. Lives on the stage, never over the container, so the UI is
   never obscured by the words describing it. Enters word by word, leaves as a
   whole with a short downward drift. */

export const Say: React.FC<{
  f: number; from: number; to: number; text: string;
  /** Vertical band the text sits in. */
  top: number;
  size?: number;
}> = ({ f, from, to, text, top, size = 52 }) => {
  const th = useTheme();
  const out = interpolate(f, [to - 20, to], [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (f < from - 2 || out <= 0) return null;
  return (
    <div style={{
      position: "absolute", left: 90, right: 90, top,
      textAlign: "center", zIndex: 700, pointerEvents: "none",
      opacity: out, transform: `translateY(${(1 - out) * 14}px)`,
      fontFamily: R.fontSerif, fontSize: size, fontWeight: 600,
      color: th.ink, letterSpacing: "-0.02em", lineHeight: 1.22,
    }}>
      <Words f={f} start={from} text={text} step={7} travel={20} />
    </div>
  );
};

/* ── Rack focus ───────────────────────────────────────────────────────────
   Sustained depth of field, not transition blur. The reference holds a list
   with everything soft except the one item being looked at, for about a
   second, then racks to the next. Blur used to point, not to cover a cut.  */

export const Focus: React.FC<{
  on: number; children: React.ReactNode; style?: React.CSSProperties;
}> = ({ on, children, style }) => (
  <div style={{
    ...style,
    filter: on >= 0.999 ? undefined : `blur(${(1 - on) * 7}px)`,
    opacity: 0.45 + on * 0.55,
  }}>
    {children}
  </div>
);

export const rack = (f: number, at: number, over = 18) =>
  clamp01((f - at) / over);

/* ── Cursor ───────────────────────────────────────────────────────────────
   Two things the reference does that a naive cursor does not:
     · it never stops — it drifts even through a half-second hold
     · its blur scales with speed, as a ghost trail along the velocity vector
   Together these are the single biggest reason the frame reads as filmed.  */

export interface Leg { at: number; to: { x: number; y: number }; click?: boolean }

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const rawCursor = (f: number, legs: Leg[]) => {
  let pos = legs[0].to;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const prev = i === 0 ? legs[0] : legs[i - 1];
    if (f >= leg.at) pos = leg.to;
    else if (f > prev.at) {
      const t = easeInOut((f - prev.at) / Math.max(1, leg.at - prev.at));
      pos = { x: prev.to.x + (leg.to.x - prev.to.x) * t, y: prev.to.y + (leg.to.y - prev.to.y) * t };
      break;
    }
  }
  /* Idle drift. Small, slow, never zero. */
  return { x: pos.x + Math.sin(f / 47) * 7, y: pos.y + Math.cos(f / 61) * 5 };
};

export const cursorFrame = (f: number, legs: Leg[]) => {
  const now = rawCursor(f, legs);
  const was = rawCursor(f - 1, legs);
  const vx = now.x - was.x, vy = now.y - was.y;
  let click = 0;
  for (const leg of legs) {
    if (!leg.click) continue;
    const dt = f - leg.at;
    if (dt >= 0 && dt < 20) click = dt / 20;
  }
  return { ...now, vx, vy, speed: Math.hypot(vx, vy), click };
};

/** Sized for a 1080-wide frame — a 26px pointer disappears at phone scale. */
const Arrow: React.FC<{ o: number; dark: boolean }> = ({ o, dark }) => (
  <svg width="38" height="45" viewBox="0 0 22 26" style={{ opacity: o, display: "block" }}>
    <path d="M2 1 L2 19 L7 14.5 L10.5 22 L13.5 20.5 L10 13.5 L17 13 Z"
      fill={dark ? "#1e1a14" : "#fff"} stroke={dark ? "#eeeeee" : "#1e1a14"}
      strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const SmearCursor: React.FC<{ f: number; legs: Leg[]; dark?: boolean }> =
({ f, legs, dark = false }) => {
  const th = useTheme();
  const c = cursorFrame(f, legs);
  /* Ghosts trail backwards along the velocity vector. The reference's cursor
     is a multi-image smear, not a gaussian blur, so ghosting matches it. */
  const n = Math.min(6, Math.round(c.speed / 2.2));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, zIndex: 900, pointerEvents: "none" }}>
      {Array.from({ length: n }, (_, i) => i + 1).reverse().map((i) => (
        <div key={i} style={{
          position: "absolute",
          left: c.x - c.vx * i * 0.55,
          top: c.y - c.vy * i * 0.55,
        }}>
          <Arrow o={0.1 + 0.16 * (1 - i / (n + 1))} dark={dark} />
        </div>
      ))}
      <div style={{ position: "absolute", left: c.x, top: c.y }}>
        {c.click > 0 && (
          <div style={{
            position: "absolute", left: -20, top: -20,
            width: 40, height: 40, borderRadius: "50%",
            border: `3px solid ${th.accent}`,
            transform: `scale(${0.3 + c.click * 1.3})`,
            opacity: (1 - c.click) * 0.9,
          }} />
        )}
        <Arrow o={1} dark={dark} />
      </div>
    </div>
  );
};
