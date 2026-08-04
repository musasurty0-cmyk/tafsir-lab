import React from "react";
import { interpolate } from "remotion";
import { R } from "../reelTokens";

/* ── One world, one camera ─────────────────────────────────────────────────
   The reel is a single continuous space, not a series of scenes. The editor
   and the Connections page live in ONE tall canvas, stacked, and the camera
   travels through it — so the interface never resets, re-crops or re-scales
   between steps. Everything on screen is the same product, moved through.

   The canvas is deliberately NARROW (760 wide). A desktop-shaped canvas has to
   be shrunk to fit a vertical frame, which is what made the interface small
   and left wide empty margins; at 760 the app fills the frame at a modest zoom
   and every control stays legible.                                          */

export const FRAME_W = 1080;
export const FRAME_H = 1920;

export const APP_W = 760;
/** Editor occupies the top; the Connections page sits below it. */
export const APP_H = 3560;
export const MAP_TOP = 1800;

export interface Shot { x: number; y: number; s: number }

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const lerpShot = (a: Shot, b: Shot, t: number): Shot => {
  const e = easeInOut(Math.max(0, Math.min(1, t)));
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, s: a.s + (b.s - a.s) * e };
};

/** One continuous move, keyframed — never a cut between compositions. */
export const shotAt = (f: number, keys: { at: number; shot: Shot }[]): Shot => {
  if (f <= keys[0].at) return keys[0].shot;
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i].at) {
      const a = keys[i - 1], b = keys[i];
      return lerpShot(a.shot, b.shot, (f - a.at) / Math.max(1, b.at - a.at));
    }
  }
  return keys[keys.length - 1].shot;
};

/**
 * The world. Full-bleed: the app fills the frame instead of floating in the
 * middle of it. `tilt` gives it depth so it reads as an object rather than a
 * pasted screenshot.
 */
export const World: React.FC<{
  shot: Shot; tilt?: number; children: React.ReactNode;
}> = ({ shot, tilt = 0, children }) => (
  <div style={{
    position: "absolute", inset: 0, overflow: "hidden",
    background: R.bg, perspective: 3400, perspectiveOrigin: "50% 50%",
  }}>
    {/* Tilt lives on its OWN plane, pivoting about the frame centre.
        It used to share the camera's transform with transformOrigin set to the
        subject — which meant the scale no longer happened about (0,0), so the
        translate below (which assumes it does) put the subject off-centre.
        Separating them keeps the framing maths exact. */}
    <div style={{
      position: "absolute", inset: 0,
      transformStyle: "preserve-3d",
      transform: `rotateX(${tilt * 5}deg) rotateY(${tilt * -7}deg)`,
      transformOrigin: "50% 50%",
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, width: APP_W, height: APP_H,
        transform:
          `translate(${FRAME_W / 2 - shot.x * shot.s}px, ${FRAME_H / 2 - shot.y * shot.s}px)` +
          ` scale(${shot.s})`,
        transformOrigin: "0 0",
      }}>
        {children}
      </div>
    </div>
  </div>
);

/* ── Cursor ───────────────────────────────────────────────────────────────*/

export const Cursor: React.FC<{ x: number; y: number; click?: number }> = ({ x, y, click = 0 }) => (
  <div style={{ position: "absolute", left: x, top: y, zIndex: 900, pointerEvents: "none" }}>
    {click > 0 && (
      <div style={{
        position: "absolute", left: -13, top: -13,
        width: 26, height: 26, borderRadius: "50%",
        border: `2px solid ${R.accent}`,
        transform: `scale(${0.35 + click * 1.2})`,
        opacity: (1 - click) * 0.85,
      }} />
    )}
    <svg width="20" height="24" viewBox="0 0 22 26"
      style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,.32))" }}>
      <path d="M2 1 L2 19 L7 14.5 L10.5 22 L13.5 20.5 L10 13.5 L17 13 Z"
        fill="#fff" stroke="#1e1a14" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  </div>
);

export const cursorAt = (
  f: number,
  legs: { at: number; to: { x: number; y: number }; click?: boolean }[],
) => {
  let pos = legs[0].to;
  let click = 0;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const prev = i === 0 ? legs[0] : legs[i - 1];
    if (f >= leg.at) {
      pos = leg.to;
      if (leg.click) {
        const dt = f - leg.at;
        if (dt >= 0 && dt < 18) click = dt / 18;
      }
    } else if (f > prev.at) {
      const t = easeInOut((f - prev.at) / Math.max(1, leg.at - prev.at));
      pos = { x: prev.to.x + (leg.to.x - prev.to.x) * t, y: prev.to.y + (leg.to.y - prev.to.y) * t };
      break;
    }
  }
  return { ...pos, click };
};

/* ── Typing ───────────────────────────────────────────────────────────────*/

export const typed = (full: string, f: number, start: number, cps: number) =>
  full.slice(0, Math.max(0, Math.floor((f - start) * cps)));

export const typeEnd = (full: string, start: number, cps: number) =>
  start + Math.ceil(full.length / cps);

export const Caret: React.FC<{ f: number; h?: number }> = ({ f, h = 22 }) => (
  <span style={{
    display: "inline-block", width: 2, height: h, background: R.ink,
    marginLeft: 2, verticalAlign: "text-bottom",
    opacity: Math.floor(f / 18) % 2 === 0 ? 1 : 0,
  }} />
);

export const revealAt = (f: number, start: number, i: number, gap = 9) => {
  const t = Math.max(0, Math.min(1, (f - start - i * gap) / 20));
  const e = 1 - Math.pow(1 - t, 3);
  return { opacity: e, transform: `translateY(${(1 - e) * 16}px)` };
};

/* ── Overlay ──────────────────────────────────────────────────────────────
   Short, in the upper safe area, over a soft scrim. The product action
   carries the meaning — these are labels, not slide titles, and there is no
   reserved band pushing the interface into the middle of the frame. */

export const Overlay: React.FC<{
  f: number; in_: number; out: number; text: string;
}> = ({ f, in_, out, text }) => {
  const o = interpolate(f, [in_, in_ + 14, out - 12, out], [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (o <= 0) return null;
  return (
    <>
      <div style={{
        position: "absolute", left: 0, right: 0, top: 0, height: 400,
        background: `linear-gradient(to bottom, ${R.bg} 30%, rgba(252,251,248,0))`,
        opacity: o * 0.94, zIndex: 940, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", left: 78, right: 78, top: 148,
        zIndex: 950, opacity: o, pointerEvents: "none",
        transform: `translateY(${interpolate(f, [in_, in_ + 18], [10, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
      }}>
        <div style={{
          fontFamily: R.fontSerif, fontSize: 44, fontWeight: 600,
          color: R.ink, letterSpacing: "-0.018em", lineHeight: 1.15,
        }}>{text}</div>
      </div>
    </>
  );
};
