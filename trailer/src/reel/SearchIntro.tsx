import React from "react";
import { interpolate } from "remotion";
import { R } from "../reelTokens";
import {
  clamp, easeIO, springy, track, PS, PV, buildArc, XS, XV_SRC, ARC_FRAMES,
  buildCamera,
} from "./searchCurves";

/**
 * SearchIntro — the trailer's opening question.
 *
 * The same search animation as SearchReel, in portrait, and asking the thing
 * the trailer then answers. A trailer that opens on its own title card asks the
 * viewer to care before it has given them a reason to; opening on somebody
 * typing the problem gives the next forty seconds something to be an answer TO.
 *
 * Every curve here is the measured one from searchCurves — the asymmetric arc
 * (slingshot, damped decay, a 300ms hang, then an accelerating fall), and the
 * S-curve the address is painted on rather than typed. What changes for
 * portrait is only the SCALE those measurements are mapped onto.
 *
 * The bar does not fade out at the end. It collapses to exactly the geometry of
 * the trailer's opening card — same width, height, radius and centre — so the
 * first thing the trailer proper shows is the same object, continued. That is
 * the trailer's own one-container rule, applied to its front door.
 */

const W = 1080, H = 1920;

/* The source was measured in 1280x714. Portrait is narrower than that source,
   so the arc is mapped at a scale that keeps the mark's proportions rather than
   stretching them: one scale for both axes, taken from the width. */
const S = 1080 / 1280;                 // 0.84
const M = buildArc(S, S);
const XV = XV_SRC.map((v) => v * S);

/** Where the bar sits, and the caret line inside it. */
const BAR_CY = 900;
const PILL_H = 116;
const PAD    = 40;

/** The question the trailer answers. */
export const QUERY = "How do I connect verses in the Qurʾān?";

export interface IntroTiming {
  /** Frame the rule first appears. */
  markFrom: number;
  /** Frame the caret lands (arc complete). */
  landed:   number;
  /** Frame the address starts painting in. */
  paint:    number;
  paintFor: number;
  /** Frame the collapse into the trailer's first card begins, and its length. */
  collapse: number;
  collapseFor: number;
  /** The card the bar becomes — the trailer's opening state. */
  card: { w: number; h: number; r: number; cy: number };
}

export const INTRO: IntroTiming = {
  markFrom: 30,
  landed:   30 + ARC_FRAMES,          // 132
  paint:    170,                      // the source holds ~19 source-frames first
  paintFor: 54,                       // a longer query than the source's
  collapse: 268,
  collapseFor: 32,
  /* Matches STATES[0] in trailerSpec: 640 x 360, r26, centred. */
  card: { w: 640, h: 360, r: 26, cy: H / 2 },
};

/** Total length of the intro — the frame the trailer's own timeline starts. */
export const INTRO_FRAMES = INTRO.collapse + INTRO.collapseFor;

/**
 * The camera, on this composition's clock and scale.
 *
 * The same tracked move SearchReel runs, not an approximation of it: pans hard
 * and early while the rule draws, STOPS dead through the hang so the floating
 * mark has the frame to itself, then accelerates as the mark falls. Leaving
 * this off is what made the intro read as static beside the reel.
 */
const CAM = buildCamera(INTRO.markFrom, INTRO.paint + 30, INTRO.collapse, S);

/** Where the camera sits at frame 0 — the state the outro has to hand back
 *  for the loop to be seamless. */
export const CAM_AT_0 = {
  x: track(0, CAM.F, CAM.X),
  z: track(0, CAM.F, CAM.Z),
};

/** Everything in the scene rides the camera together. */
const Drift: React.FC<{ x: number; z: number; children: React.ReactNode }> =
({ x, z, children }) => (
  <div style={{
    position: "absolute", inset: 0,
    transform: `translateX(${x}px) scale(${z})`,
    transformOrigin: "50% 50%",
  }}>{children}</div>
);

/* ── Geometry ─────────────────────────────────────────────────────────────*/

/** One source of truth for the field, so the mark and the text cannot drift. */
function geom(f: number) {
  const grow  = springy((f - INTRO.landed) / 30);
  const paint = track(
    interpolate(f, [INTRO.paint, INTRO.paint + INTRO.paintFor], [0, 1], clamp), PS, PV);
  /* Bounded by the FRAME, not by the text. Portrait is 1080 wide and the
     assembly is field + two 88px buttons + two 24px gutters, so a field over
     ~760 pushes the buttons off the edge — at 920 it overflowed by 32px a side.
     The field grows as it fills, the way the source's does, but it stops where
     the frame does. The type size is what was adjusted to fit the question, not
     the layout. */
  const w = interpolate(grow, [0, 1], [420, 520], clamp) + paint * 236;
  return { w, chars: paint * QUERY.length, textLeft: W / 2 - w / 2 + PAD };
}

/* ── The mark ─────────────────────────────────────────────────────────────*/

const Mark: React.FC<{ f: number }> = ({ f }) => {
  if (f < INTRO.markFrom || f >= INTRO.landed) return null;
  const p   = (f - INTRO.markFrom) / ARC_FRAMES;
  const arc = Math.min(1, p);

  const w = track(arc, M.S, M.Wd);
  const h = track(arc, M.S, M.Hd);
  const x = W / 2 + track(arc, XS, XV);
  const y = BAR_CY + track(arc, M.S, M.Y);

  /* Smear. The launch peaks around 28px/frame here and the source carries
     motion blur from its own render; drawn sharp it would strobe into discrete
     places instead of reading as a streak. */
  const v = (track(Math.min(1, (f + 1 - INTRO.markFrom) / ARC_FRAMES), M.S, M.Y)
           - track(Math.min(1, (f - 1 - INTRO.markFrom) / ARC_FRAMES), M.S, M.Y)) / 2;
  const smear = Math.min(Math.abs(v) * 1.15, 66);
  const hs = h + smear;

  return (
    <div style={{
      position: "absolute", left: x - w / 2, top: y - hs / 2,
      width: w, height: hs, borderRadius: Math.min(w, hs) / 2,
      background: R.ink, zIndex: 40,
      opacity: 1 - Math.min(smear / 66, 1) * 0.22,
      filter: smear > 2 ? `blur(${smear * 0.12}px)` : undefined,
    }} />
  );
};

/* ── The bar, and its collapse into the trailer's first card ──────────────*/

const ic = {
  fill: "none", stroke: R.ink3, strokeWidth: 2.6,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};

const Round: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> =
({ children, style }) => (
  <div style={{
    width: 88, height: 88, borderRadius: 44,
    background: R.bgElev, border: `1px solid ${R.line}`,
    display: "grid", placeItems: "center", flexShrink: 0, ...style,
  }}>{children}</div>
);

/**
 * The bar, at any point along its morph into the card.
 *
 * `c` is the collapse: 0 is the search bar, 1 is the trailer's opening card.
 * ONE morph, driven both ways — the intro runs it 0 to 1 and the outro runs it
 * 1 back to 0, which is what closes the loop. Writing the outro as its own
 * reverse animation would be a second copy of a morph, and the two would drift
 * the first time either was touched.
 *
 * `typed` is how much of the question is on screen (0 during the outro: the
 * loop returns to an empty field, ready to be asked again).
 */
const Bar: React.FC<{
  c: number; fieldW: number; typed: number; focus: number; caret: boolean;
}> = ({ c, fieldW, typed, focus, caret }) => {
  const full = Math.floor(typed);
  const frac = typed - full;
  /* Content clears well before the shape finishes, so the card is empty by the
     time it is a card — and on the way back, the field is empty until it is a
     field again. */
  const gone = Math.max(0, 1 - c * 2.2);

  const pw   = interpolate(c, [0, 1], [fieldW, INTRO.card.w]);
  const ph   = interpolate(c, [0, 1], [PILL_H, INTRO.card.h]);
  const pr   = interpolate(c, [0, 1], [PILL_H / 2, INTRO.card.r]);
  const cy   = interpolate(c, [0, 1], [BAR_CY, INTRO.card.cy]);
  const side = interpolate(c, [0, 1], [0, 170]);

  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: cy,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 24,
      transform: "translateY(-50%)",
      zIndex: 30,
    }}>
      <Round style={{ transform: `translateX(${side}px) scale(${1 - c})`, opacity: 1 - c * 1.4 }}>
        <svg width="34" height="34" viewBox="0 0 24 24" {...ic}><path d="M15 5l-7 7 7 7" /></svg>
      </Round>

      <div style={{
        width: pw, height: ph, borderRadius: pr,
        background: `rgba(255,255,255,${0.7 + 0.3 * focus})`,
        border: `1px solid ${R.line}`,
        boxShadow: "0 18px 44px rgba(28,36,64,0.10), 0 3px 10px rgba(28,36,64,0.06)",
        boxSizing: "border-box", overflow: "hidden", position: "relative",
        fontFamily: R.fontSans, fontSize: 32,
      }}>
        {/* Placeholder and magnifier are absolute, so nothing reflows when they
            go — the field just clears. */}
        <span style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          color: R.ink4, opacity: (1 - focus) * gone, whiteSpace: "nowrap",
        }}>search…</span>
        <svg width="30" height="30" viewBox="0 0 24 24" {...ic}
          style={{ position: "absolute", right: 34, top: "50%", marginTop: -15,
                   opacity: (1 - focus) * gone }}>
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-4.3-4.3" />
        </svg>

        <span style={{
          position: "absolute", left: PAD, top: "50%",
          transform: "translateY(-50%)", display: "flex", alignItems: "center",
          whiteSpace: "nowrap", color: R.ink, opacity: gone,
        }}>
          {QUERY.slice(0, full)}
          {full < QUERY.length && frac > 0 && (
            <span style={{ opacity: Math.min(1, frac * 1.9),
                           filter: `blur(${(1 - frac) * 5}px)` }}>
              {QUERY[full]}
            </span>
          )}
          {/* The mark, continued: it ends at 3 x 42 on this exact line, so the
              swap at `landed` moves nothing. No blink — at this length a blink
              only ever reads as a glitch. */}
          {caret && (
            <span style={{ display: "inline-block", width: 3, height: 42,
                           background: R.ink, flexShrink: 0 }} />
          )}
        </span>
      </div>

      <Round style={{ transform: `translateX(${-side}px) scale(${1 - c})`, opacity: 1 - c * 1.4 }}>
        <svg width="34" height="34" viewBox="0 0 24 24" {...ic}>
          <path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 5v6h-6" />
        </svg>
      </Round>
    </div>
  );
};

/* ── The scene ────────────────────────────────────────────────────────────*/

/** The opening question. Frame 0 already has the bar fully formed — there is
 *  no fade-in, because the piece LOOPS: what precedes frame 0 is the outro
 *  handing this exact bar over. */
export const SearchIntro: React.FC<{ f: number }> = ({ f }) => {
  if (f >= INTRO_FRAMES) return null;
  const g = geom(f);
  return (
    <Drift x={track(f, CAM.F, CAM.X)} z={track(f, CAM.F, CAM.Z)}>
      <Bar
        c={easeIO((f - INTRO.collapse) / INTRO.collapseFor)}
        fieldW={g.w}
        typed={g.chars}
        focus={interpolate(f, [INTRO.landed - 2, INTRO.landed + 6], [0, 1], clamp)}
        caret={f >= INTRO.landed}
      />
      <Mark f={f} />
    </Drift>
  );
};

/**
 * The close: the trailer's last card becoming the search bar again.
 *
 * Runs the SAME morph backwards, so the final frame is the bar exactly as
 * frame 0 has it — empty field, placeholder showing, no caret. The piece is a
 * real loop rather than one that merely ends near where it began: the question
 * gets asked, answered, and is there to be asked again.
 */
export const OUTRO_FRAMES = 46;

export const Outro: React.FC<{ f: number }> = ({ f }) => {
  if (f < 0 || f > OUTRO_FRAMES) return null;
  /* 1 -> 0. The card holds for a beat before it gives, so the closing title is
     read before it goes. */
  const p = easeIO(interpolate(f, [10, OUTRO_FRAMES], [0, 1], clamp));
  /* The camera has to arrive exactly where frame 0 has it, or the loop shows a
     jump in the one thing the eye tracks across the whole piece. The trailer
     body runs with the camera at rest, so this eases from rest to that state. */
  return (
    <Drift x={CAM_AT_0.x * p} z={interpolate(p, [0, 1], [1, CAM_AT_0.z])}>
      <Bar c={1 - p} fieldW={420} typed={0} focus={0} caret={false} />
    </Drift>
  );
};
