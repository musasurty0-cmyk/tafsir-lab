import React from "react";
import {
  AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import { buildArc, track, clamp, smoothstep, ARC_FRAMES } from "./searchCurves";

/* ── "No effect" ───────────────────────────────────────────────────────────
   Rebuild of the flagship. The first attempt was a slideshow with good
   transitions: seven states that HELD while their contents faded in. Nothing
   was ever thrown, so nothing was ever alive.

   What the references actually do, and what this uses:

   THE OPENING. ClickUp opens on its own mark — small, centred, alone — and by
   0.8s the mark is already blurring into the first UI object. There is no
   title card. The logo IS the first container. Here the mark's underline
   detaches, gathers, and is thrown; the piece starts from the brand and never
   cuts.

   THE THROW. Every flying object on screen runs the TRACKED arc from
   searchCurves — the slingshot to -43.5px/frame, the nine-frame hang within
   3px of apex, and a fall covering 110px in 17 frames against the rise's 160
   in 34. Rise and fall are DIFFERENT curves and the hang between them is what
   makes an object read as thrown rather than tweened. Reusing one measured
   signature across every object is what makes them feel like they share a
   world.

   Subject: the ustadh's own line from the clip — a Qur'an you only recite is
   "mere letters that have no effect". So the reel has to be about something
   inert becoming alive, which is a subject that cannot be told in stills.

   ONE still beat, at 5.5-7s, and it is there to be broken.                 */

const FPS = 60;
export const NOEFFECT_FRAMES = 21 * FPS;      // 1260

const W = 1080, H = 1920;
const CX = W / 2;

/* The arc, in this frame's own space. sy scales the source's 714px height. */
const ARC = buildArc(W / 1280, H / 1714);

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;

/**
 * One throw. `p` is 0..1 across the arc; the returned dy is the measured
 * vertical displacement, so the object slingshots, hangs, and drops on the
 * reference's own timing rather than a sine.
 */
const throwY = (p: number) => track(Math.max(0, Math.min(1, p)), ARC.S, ARC.Y);

/** Speed along the arc, for motion blur. The reference smears with velocity. */
const throwV = (p: number) => Math.abs(throwY(p + 0.008) - throwY(p - 0.008)) / 0.016;

// ── Beats ──────────────────────────────────────────────────────────────────

const B = {
  mark:    0,
  rule:    70,
  throw1:  150,          // mark's rule → first word
  paint:   270,          // rest of the line paints in
  still:   360,          // the one held beat
  touch:   460,
  burst:   500,          // word lifts and breaks at apex
  roots:   620,          // three roots fall out
  meanings:740,          // meanings thrown outward, staggered
  gather:  920,          // everything snaps home
  wide:   1030,
  close:  1120,
};

const WORD   = "يَتَدَبَّرُونَ";
const LINE   = ["أَفَلَا", "يَتَدَبَّرُونَ", "الْقُرْآنَ"];
const ROOTS  = ["د", "ب", "ر"];
const MEANS  = ["to turn a thing over", "to look at what follows", "the back of the matter"];

// ── The mark ───────────────────────────────────────────────────────────────

/** The brand square. Its underline is the object that gets thrown, so the
 *  piece grows out of the logo instead of cutting away from it. */
const Mark: React.FC<{ f: number }> = ({ f }) => {
  const inn = ease(interpolate(f, [0, 28], [0, 1], clamp));
  // it dissolves as the line it threw becomes the subject
  const out = interpolate(f, [B.throw1 + 40, B.throw1 + 90], [1, 0], clamp);
  if (out <= 0) return null;
  const s = 0.9 + inn * 0.1;
  return (
    <div style={{
      position: "absolute", left: CX - 46, top: 830,
      width: 92, height: 92, borderRadius: 26,
      border: `3px solid ${R.ink}`, color: R.ink,
      display: "grid", placeItems: "center",
      fontFamily: R.fontSans, fontSize: 46, fontWeight: 700,
      opacity: inn * out, transform: `scale(${s})`,
    }}>T</div>
  );
};

// ── Objects in flight ──────────────────────────────────────────────────────

interface FlyProps {
  f: number; from: number; dur?: number;
  x0: number; y0: number; x1: number; y1: number;
  children: React.ReactNode;
  /** Fraction of the arc's height this object uses. 1 = the measured throw. */
  lift?: number;
  style?: React.CSSProperties;
}

/**
 * An object thrown from (x0,y0) to (x1,y1). X travels linearly-ish with a soft
 * settle; Y is the MEASURED arc, so the apex hang and the fast fall come from
 * the reference rather than from an easing name.
 */
const Fly: React.FC<FlyProps> = ({
  f, from, dur = ARC_FRAMES, x0, y0, x1, y1, children, lift = 1, style,
}) => {
  const p = (f - from) / dur;
  if (p < 0) return null;
  const q = Math.min(1, p);
  const xs = smoothstep(q);
  const x = x0 + (x1 - x0) * xs;
  const yBase = y0 + (y1 - y0) * xs;
  const y = yBase + throwY(q) * lift;
  const v = throwV(q) * lift;
  /* Smear along the velocity vector, exactly as the reference does — the blur
     is a function of speed, not a constant applied for the whole flight. */
  const blur = Math.min(9, Math.max(0, (v - 260) / 190));
  return (
    <div style={{
      position: "absolute", left: x, top: y,
      transform: "translate(-50%, -50%)",
      filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
      ...style,
    }}>{children}</div>
  );
};

// ── The piece ──────────────────────────────────────────────────────────────

const Body: React.FC = () => {
  const f = useCurrentFrame();

  /* Camera: pushes in on the line, holds dead still through the burst, then
     pulls back hard and STOPS — the reference pans hard and stops dead rather
     than easing to rest (§9.2). */
  const z = f < B.throw1 ? 1
    : f < B.still ? interpolate(f, [B.throw1, B.still], [1, 1.12], clamp)
    : f < B.wide  ? 1.12
    : interpolate(f, [B.wide, B.wide + 46], [1.12, 0.86], clamp);
  const camY = f < B.wide ? 0 : interpolate(f, [B.wide, B.wide + 46], [0, 40], clamp);

  const lineY = 900;

  /* The rule the mark throws. Draws, then gathers to a point. */
  const ruleT = ease(interpolate(f, [B.rule, B.rule + 44], [0, 1], clamp));
  const gather = interpolate(f, [B.throw1 - 26, B.throw1], [1, 0], clamp);
  const ruleW = 150 * ruleT * gather;
  const ruleGone = f > B.throw1;

  /* The line paints rather than types — the reference lands 26 characters in
     18 frames, far too fast to read as typing, which is what makes it look
     painted. */
  const paintT = smoothstep(interpolate(f, [B.paint, B.paint + 34], [0, 1], clamp));

  /* The touched word lifts out of the line, breaks at apex into its roots. */
  const burstP = (f - B.burst) / ARC_FRAMES;
  const broken = f > B.burst + ARC_FRAMES * 0.34;   // breaks at the hang

  const alive = interpolate(f, [B.gather, B.gather + 60], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      background: R.bg,
      transform: `scale(${z}) translateY(${camY}px)`,
      transformOrigin: "50% 47%",
    }}>
      <Mark f={f} />

      {/* the mark's underline — the thrown object */}
      {!ruleGone && ruleW > 1 && (
        <div style={{
          position: "absolute", left: CX - ruleW / 2, top: 952,
          width: ruleW, height: 5 + (1 - gather) * 9,
          borderRadius: 6, background: R.ink,
        }} />
      )}

      {/* THROW 1 — the rule flies and lands as the first word of the line */}
      {f >= B.throw1 && f < B.paint + 20 && (
        <Fly f={f} from={B.throw1} x0={CX} y0={952} x1={CX} y1={lineY}>
          <span style={{
            fontFamily: R.fontArabic, fontSize: 66, color: R.ink,
            opacity: interpolate(f, [B.throw1 + 60, B.throw1 + 92], [0, 1], clamp),
          }}>{LINE[1]}</span>
        </Fly>
      )}

      {/* the settled line */}
      {f >= B.paint && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: lineY,
          transform: "translateY(-50%)",
          textAlign: "center", direction: "rtl",
          fontFamily: R.fontArabic, fontSize: 66,
          /* inert: grey and flat until it is touched */
          color: alive > 0 ? R.ink : R.ink3,
          opacity: burstP > 0 && burstP < 1 ? 1 : 1,
        }}>
          {LINE.map((w, i) => {
            const lit = i === 1;
            const hidden = lit && f > B.burst && f < B.gather;
            const t = i === 1 ? 1 : Math.max(0, Math.min(1, (paintT - i * 0.18) / 0.5));
            return (
              <span key={w} style={{
                display: "inline-block", marginInlineEnd: "0.3em",
                opacity: hidden ? 0 : t,
                color: lit && alive > 0 ? R.accent : undefined,
                transform: `translateY(${(1 - t) * 10}px)`,
              }}>{w}</span>
            );
          })}
        </div>
      )}

      {/* THROW 2 — the word lifts, and breaks at the apex */}
      {f >= B.burst && f < B.gather && !broken && (
        <Fly f={f} from={B.burst} x0={CX} y0={lineY} x1={CX} y1={lineY - 30} lift={0.9}>
          <span style={{ fontFamily: R.fontArabic, fontSize: 66, color: R.accent }}>
            {WORD}
          </span>
        </Fly>
      )}

      {/* the roots fall out of it — the fall is the fast half of the arc */}
      {broken && f < B.gather && ROOTS.map((r, i) => {
        const from = B.roots + i * 14;
        return (
          <Fly key={r} f={f} from={from} dur={ARC_FRAMES * 0.7}
               x0={CX} y0={lineY - 210}
               x1={CX + (i - 1) * 230} y1={lineY - 90} lift={0.42}>
            <div style={{
              width: 108, height: 108, borderRadius: 30,
              border: `2px solid ${R.accent}`, background: R.accentSoft,
              display: "grid", placeItems: "center",
              fontFamily: R.fontArabic, fontSize: 54, color: R.accentInk,
            }}>{r}</div>
          </Fly>
        );
      })}

      {/* meanings thrown outward from each root, staggered so the frame is
          never without something in flight */}
      {f >= B.meanings && f < B.gather && MEANS.map((m, i) => {
        const from = B.meanings + i * 34;
        return (
          <Fly key={m} f={f} from={from} dur={ARC_FRAMES * 0.8}
               x0={CX + (i - 1) * 230} y0={lineY - 90}
               x1={CX + (i - 1) * 300} y1={lineY + 330} lift={0.55}>
            <div style={{
              width: 330, padding: "20px 22px", borderRadius: 18,
              background: R.bgElev, border: `1px solid ${R.lineStrong}`,
              boxShadow: R.shadowMd,
              fontFamily: R.fontSerif, fontSize: 26, lineHeight: 1.4, color: R.ink2,
              textAlign: "center",
            }}>{m}</div>
          </Fly>
        );
      })}

      {/* everything snaps home — magnetic, fast, one move */}
      {f >= B.gather && (
        <>
          {ROOTS.map((r, i) => {
            const t = ease(interpolate(f, [B.gather + i * 6, B.gather + 40 + i * 6], [0, 1], clamp));
            const x = CX + (i - 1) * 230 * (1 - t);
            const y = (lineY - 90) + (lineY + 96 - (lineY - 90)) * t;
            const s = 1 - t * 0.62;
            return (
              <div key={r} style={{
                position: "absolute", left: x, top: y,
                transform: `translate(-50%,-50%) scale(${s})`,
                width: 108, height: 108, borderRadius: 30,
                border: `2px solid ${R.accent}`, background: R.accentSoft,
                display: "grid", placeItems: "center",
                fontFamily: R.fontArabic, fontSize: 54, color: R.accentInk,
                opacity: 1 - t * 0.15,
              }}>{r}</div>
            );
          })}
          {/* the line is now anchored — the mark of a page that has been worked */}
          <div style={{
            position: "absolute", left: 0, right: 0, top: lineY + 190,
            textAlign: "center", opacity: alive,
            fontFamily: R.fontSerif, fontSize: 30, color: R.ink2,
          }}>
            root · د ب ر · to turn a thing over
          </div>
        </>
      )}

      {/* the two lines of the argument, on the stage, never over the subject */}
      {f >= B.still && f < B.touch + 40 && (
        <div style={{
          position: "absolute", left: 90, right: 90, top: 1180, textAlign: "center",
          fontFamily: R.fontSerif, fontSize: 44, color: R.ink3,
          opacity: interpolate(f, [B.still, B.still + 26, B.touch + 20, B.touch + 40],
                               [0, 1, 1, 0], clamp),
        }}>
          Letters you can read.
        </div>
      )}
      {f >= B.wide && (
        <div style={{
          position: "absolute", left: 90, right: 90, top: 1300, textAlign: "center",
          fontFamily: R.fontSerif, fontSize: 50, color: R.ink,
          letterSpacing: "-0.02em",
          opacity: ease(interpolate(f, [B.wide + 20, B.wide + 54], [0, 1], clamp)),
        }}>
          Or a word you can open.
        </div>
      )}
    </AbsoluteFill>
  );
};

const Close: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(interpolate(f, [B.close, B.close + 34], [0, 1], clamp));
  if (f < B.close) return null;
  return (
    <AbsoluteFill style={{ display: "grid", placeItems: "center", pointerEvents: "none" }}>
      <div style={{
        position: "absolute", bottom: 250, left: 0, right: 0, textAlign: "center",
        opacity: a, transform: `translateY(${(1 - a) * 12}px)`,
        fontFamily: R.fontSans, fontSize: 27, color: R.accent,
        letterSpacing: "0.2em", textTransform: "uppercase",
      }}>TafsirLab</div>
    </AbsoluteFill>
  );
};

export const NoEffect: React.FC = () => (
  <AbsoluteFill style={{ background: R.bg, overflow: "hidden" }}>
    <Body />
    <Close />

    {/* every cue is an impact or a launch — nothing decorative */}
    <Sequence from={B.throw1 - 8} durationInFrames={30}>
      <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.24} />
    </Sequence>
    <Sequence from={B.throw1 + 86} durationInFrames={26}>
      <Audio src={staticFile("sfx/land.mp3")} volume={0.28} />
    </Sequence>
    <Sequence from={B.touch} durationInFrames={22}>
      <Audio src={staticFile("sfx/click.mp3")} volume={0.34} />
    </Sequence>
    <Sequence from={B.burst - 6} durationInFrames={34}>
      <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.22} />
    </Sequence>
    {[0, 1, 2].map((i) => (
      <Sequence key={i} from={B.roots + i * 14 + 40} durationInFrames={20}>
        <Audio src={staticFile("sfx/click.mp3")} volume={0.2} />
      </Sequence>
    ))}
    <Sequence from={B.gather - 6} durationInFrames={44}>
      <Audio src={staticFile("sfx/magnetic.mp3")} volume={0.3} />
    </Sequence>
    <Sequence from={B.wide} durationInFrames={50}>
      <Audio src={staticFile("sfx/land.mp3")} volume={0.26} />
    </Sequence>
  </AbsoluteFill>
);
