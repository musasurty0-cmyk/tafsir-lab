import React from "react";
import {
  AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import { buildArc, track, clamp, smoothstep } from "./searchCurves";

/* ── One Desk ──────────────────────────────────────────────────────────────
   A rebuild of the first thing made for TafsirLab — the 70s landscape tour
   whose opening card read "A new way to study the Quran — deeply,
   collaboratively, and in context". Same subject, same seven things shown, but
   rebuilt against everything MOTION-STUDY.md now records.

   The original was a slideshow: seven scenes, each cutting to the next, each
   holding while its contents faded in. Everything below exists to stop that.

   ONE CONTAINER (§6). There is no cut anywhere in this file. A single rounded
   rectangle is born out of the wordmark at 0:00 and collapses back into it at
   0:20; the app is never shown, only *this object* holding one surface after
   another. The ClickUp reel gets seven screens out of one rectangle this way.

   THE THREE CAUSES OF REPETITION (§11.8) are designed against, not fixed after:
     shape        aspect swings 1.00 → 2.73 → 1.17 → 0.63 → 1.41 → 0.83 → 1.61
                  → 0.80 → 1.00. Six direction reversals, no two consecutive
                  containers alike, area deliberately NOT monotonic. The object
                  peaks at 38% of frame area — the references sit at 25–50%,
                  and the first cut of this file sat at 12%, which read as a
                  small card adrift rather than a thing being looked at.
     composition  captions alternate below/above at a constant 136px gap.
     rhythm       every beat performs a DIFFERENT VERB — birth, expand, divide,
                  throw, draw, grow, slide, swarm, collapse. This is the cause
                  that dominates and the one no amount of shape variation fixes.

   THE THROW (§9) is the tracked arc, not a sine: the slingshot to −43.5px/f,
   nine frames of hang within 3px of apex, and a fall covering 110px in 17
   frames against the rise's 160 in 34. Rise and fall are different curves.

   ONLY ONE THING MOVES AT A TIME (§11.10). The cursor idles while the
   container works and travels only in the gaps; the drift is windowed to end
   as the cursor arrives.

   IT LOOPS (§7). Frame 1199 is compositionally frame 0.                    */

const FPS = 60;
export const DESK_FRAMES = 22 * FPS;          // 1320 — beats of 152f (2.5s) — see the beat table

const W = 1080, H = 1920;
const CX = W / 2, CY = H / 2;

/* Stage is ~10% darker than the card and the object never fills the frame
   (§1). The original filled the frame edge to edge, which is what made it read
   as a screen recording rather than a thing being looked at. */
const STAGE = "#e5e4e9";

const ARC = buildArc(W / 1280, H / 1714);
const ease   = (t: number) => 1 - Math.pow(1 - t, 3);   // object motion: fast middle
const easeIn = (t: number) => t * t * t;

// ── Beats ──────────────────────────────────────────────────────────────────
// name, start frame, container w/h/radius, caption, which side the caption sits

interface Beat {
  at: number; w: number; h: number; r: number;
  cap?: string; side?: "above" | "below";
}

const BEATS: Beat[] = [
  { at:    0, w: 360, h: 360, r: 180 },
  { at:   80, w: 900, h: 360, r:  24, cap: "Start with one sūrah.",              side: "below" },
  { at:  232, w: 820, h: 700, r:  24, cap: "Its pages stay yours.",              side: "above" },
  { at:  384, w: 700, h:1120, r:  20, cap: "The muṣḥaf, exactly as it is.",      side: "below" },
  { at:  552, w: 900, h: 660, r:  20, cap: "Mark the word that stopped you.",    side: "above" },
  { at:  704, w: 760, h: 920, r:  22, cap: "Write it down — the āyah comes too.", side: "below" },
  { at:  856, w: 900, h: 620, r:  22, cap: "See how the scholars read it.",      side: "above" },
  { at: 1008, w: 660, h: 840, r:  24, cap: "Keep what you found. Share it.",     side: "below" },
  { at: 1160, w: 360, h: 360, r: 180 },
];

const MORPH = 20;   // §2: a big size delta buys ~20 frames; small ones take 12

// ── Cause and effect (§13e) ────────────────────────────────────────────────
// The beat table above says WHEN each screen arrives. This table says WHY.
//
// The first cut kept three timelines — beats, cursor route, sound cues — each
// written by hand, and they drifted apart exactly as separate timelines do:
// the six click sounds landed an average of 84 frames (1.4s) BEFORE the screen
// each was meant to cause, and the thrown card touched down 80 frames before
// the mushaf it delivered. Nothing was out of place by taste; the sound was
// uncorrelated with the picture and the screens had no visible cause. Reported
// as "some screens just come out of nowhere and sound effects feel randomly
// placed", which is a precise description of that measurement.
//
// So there is now ONE table. The cursor's route, the click sounds and the
// visible press are all derived from it below — they cannot drift again
// because there is nothing left to drift against.

const THROW_LEN = 60;

interface Act {
  beat: number;        // the beat this press produces
  x: number; y: number;// where the press lands — on a real element of the
                       // surface that is still on screen when it happens
  grab?: boolean;      // beat 3 is picked up and thrown, not clicked
}

const ACTS: Act[] = [
  { beat: 1, x: CX +  10, y: CY +  46 },              // the mark itself
  { beat: 2, x: CX - 168, y: CY -   8 },              // the Al-Baqarah row
  { beat: 3, x: CX - 196, y: CY -  50, grab: true },  // picks up Āyat al-Kursī
  /* measured off the rendered frame, not guessed from the CSS: at CY−6 the
     pointer sat ON the glyphs of ٱلْقَيُّومُ and neither could be read. It now
     tucks under the word's left edge and points up into it. */
  { beat: 4, x: CX -  70, y: CY +  30 },              // the word al-Qayyūm
  { beat: 5, x: CX - 206, y: CY + 120 },              // into the note
  { beat: 6, x: CX -  86, y: CY +  26 },              // /tafsir
  { beat: 7, x: CX + 232, y: CY -  54 },              // a commentary
  { beat: 8, x: CX + 273, y: CY - 175 },              // the 🔗 on the Connection
];

const TRAVEL   = 46;  // frames spent crossing to a target
const SETTLE   = 10;  // parked before it presses — it never presses on the move
const RESPONSE =  8;  // press → the screen answers. 133ms: instant reads as a
                      // cut, anything past ~15 frames reads as lag.

/** The frame a press happens. A grab presses at launch, so the hand is still
 *  on the card when it leaves. */
const pressAt = (a: Act) =>
  a.grab ? BEATS[a.beat].at - THROW_LEN : BEATS[a.beat].at - RESPONSE;
const arriveAt = (a: Act) => pressAt(a) - SETTLE;

const THROW_AT = pressAt(ACTS[2]);   // 324 — so the card lands ON BEATS[3].at

/** Which beat index is live at frame f, and how far into its morph. */
const phase = (f: number) => {
  let i = 0;
  for (let k = 0; k < BEATS.length; k++) if (f >= BEATS[k].at) i = k;
  const m = i === 0 ? 1 : Math.min(1, (f - BEATS[i].at) / MORPH);
  return { i, m };
};

/* Container geometry. The morph resolves the new size with a slight overshoot
   wider (§2) and settles back — measured on the source's pill → slash menu. */
const geom = (f: number) => {
  const { i, m } = phase(f);
  const a = BEATS[Math.max(0, i - 1)], b = BEATS[i];
  const t = ease(m);
  const over = 1 + 0.028 * Math.sin(Math.PI * Math.min(1, m * 1.35));
  return {
    w: (a.w + (b.w - a.w) * t) * over,
    h: a.h + (b.h - a.h) * t,
    r: a.r + (b.r - a.r) * t,
    i, m,
  };
};

/* Blur-through (§2). During peak blur the old content is COMPLETELY gone —
   there is no crossfade of two legible states, which is what separates this
   from a dissolve. The smear is directional: content exits through the
   container's right edge. */
const contentBlur = (m: number) => ({
  opacity: m < 0.42 ? interpolate(m, [0, 0.34], [1, 0], clamp)
                    : interpolate(m, [0.5, 0.78], [0, 1], clamp),
  blur:    m < 0.42 ? interpolate(m, [0, 0.34], [0, 14], clamp)
                    : interpolate(m, [0.5, 0.86], [10, 0], clamp),
  dx:      m < 0.42 ? interpolate(m, [0, 0.34], [0, 46], clamp)
                    : interpolate(m, [0.5, 0.86], [-18, 0], clamp),
});

// ── Caption, with per-word catch-up (§3) ───────────────────────────────────
// Word 1 lands first; each next word arrives from the RIGHT and slightly BELOW
// the baseline and decelerates in over 5–6 frames, offset 3 frames from its
// neighbour. A whole-block fade is the single cheapest thing to miss.

const Caption: React.FC<{ text: string; at: number; side: "above" | "below"; h: number }> =
({ text, at, side, h }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  const gone = interpolate(f, [at + 108, at + 128], [1, 0], clamp);
  if (f < at || gone <= 0) return null;
  return (
    <div style={{
      position: "absolute", left: 0, right: 0,
      /* constant 136px clearance either side, so the gap stays deliberate
         even as the container changes shape every beat (§11.8 cause 2) */
      top: side === "below" ? CY + h / 2 + 136 : CY - h / 2 - 136 - 54,
      textAlign: "center", opacity: gone,
      display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap",
    }}>
      {words.map((word, k) => {
        const s = at + 8 + k * 3;
        const p = interpolate(f, [s, s + 6], [0, 1], clamp);
        const e = ease(p);
        return (
          <span key={k} style={{
            fontFamily: R.fontSerif, fontSize: 46, color: "#2b2822",
            transform: `translate(${(1 - e) * 26}px, ${(1 - e) * 7}px)`,
            opacity: p, display: "inline-block",
          }}>{word}</span>
        );
      })}
    </div>
  );
};

// ── Cursor (§4) ────────────────────────────────────────────────────────────
// Never still. It drifts through every hold, arrives BEFORE the thing it acts
// on and lingers after, and its smear scales with speed. This one detail does
// more than anything else to make a frame read as filmed.

/* Where the cursor rests at both ends, so frame 1319's cursor is frame 0's and
   the loop closes on it too (§7). The old exit landed 80px away from the open,
   which put a visible jump on the seam. */
const REST = { x: 700, y: 1360 };

/* Each leg departs early enough to ARRIVE before the press it serves — that is
   the whole schedule, and it is arithmetic rather than eight typed numbers. */
const LEGS: { at: number; x: number; y: number }[] = [
  { at: arriveAt(ACTS[0]) - TRAVEL, x: REST.x, y: REST.y },
  ...ACTS.slice(1).map((a, k) => ({
    at: arriveAt(a) - TRAVEL, x: ACTS[k].x, y: ACTS[k].y,
  })),
  { at: pressAt(ACTS[7]) + 26, x: ACTS[7].x, y: ACTS[7].y },
  { at: DESK_FRAMES,           x: REST.x,    y: REST.y },
];

/* On the grab the hand goes WITH the card for its first frames and then lets
   go. A throw with no thrower is just an object that left. */
const flick = (f: number) => {
  const p = (f - THROW_AT) / THROW_LEN;
  if (p < 0 || p > 0.15) return 0;
  return track(p, ARC.S, ARC.Y) * interpolate(p, [0.08, 0.15], [1, 0], clamp);
};

/** 1 on the frame of a press, back to 0 seven frames later. */
const pressure = (f: number) => {
  let v = 0;
  for (const a of ACTS) {
    const d = f - pressAt(a);
    if (d >= 0 && d < 7) v = Math.max(v, 1 - d / 7);
  }
  return v;
};

const cursorAt = (f: number) => {
  let a = LEGS[0], b = LEGS[0];
  for (let k = 0; k < LEGS.length; k++) {
    if (f >= LEGS[k].at) { a = LEGS[k]; b = LEGS[Math.min(k + 1, LEGS.length - 1)]; }
  }
  const span = Math.max(1, b.at - a.at);
  /* Travel occupies the first TRAVEL frames of a leg; the rest is idle drift.
     Clamped low as well as high — the first leg no longer starts at frame 0,
     and an unclamped cubic run backwards throws the cursor off the stage. */
  const p = ease(Math.max(0, Math.min(1, (f - a.at) / Math.min(TRAVEL, span))));
  const idle = Math.max(0, f - a.at - TRAVEL);
  return {
    x: a.x + (b.x - a.x) * p + Math.sin(idle / 37) * 5.5 + Math.sin(idle / 13) * 1.6,
    y: a.y + (b.y - a.y) * p + Math.cos(idle / 29) * 4.2 + Math.cos(idle / 17) * 1.2
       + flick(f),
    v: Math.abs(b.x - a.x + b.y - a.y) * (p < 1 ? (1 - p) : 0) / 40,
  };
};

/* A press you can SEE. This is the other half of "randomly placed": a click
   sound with no picture has nothing to be placed ON, so the ear files it as
   ambience and ambience arriving in bursts sounds arbitrary. The ring is
   drawn at pressAt() — the same call the audio uses. */
const ClickFX: React.FC = () => {
  const f = useCurrentFrame();
  return (<>
    {ACTS.filter((a) => !a.grab).map((a) => {
      const t = (f - pressAt(a)) / 17;
      if (t < 0 || t > 1) return null;
      const e = ease(t), rad = 52 * e;
      return (
        <div key={a.beat} style={{
          position: "absolute", left: a.x - rad, top: a.y - rad,
          width: rad * 2, height: rad * 2, borderRadius: "50%",
          border: `${1 + 3 * (1 - e)}px solid ${R.accent}`,
          opacity: (1 - e) * 0.5, zIndex: 39,
        }} />
      );
    })}
  </>);
};

const Cursor: React.FC = () => {
  const f = useCurrentFrame();
  const { x, y, v } = cursorAt(f);
  const pr = pressure(f);
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: 26, height: 34,
      filter: `blur(${Math.min(7, v * 1.7)}px)`, zIndex: 40,
      /* the tip stays put; the body dips and shrinks, which is what a real
         pointer does under a mouse-down */
      transformOrigin: "2px 1px",
      transform: `translate(-3px,-2px) translateY(${pr * 2.5}px) scale(${1 - pr * 0.12})`,
    }}>
      <svg viewBox="0 0 26 34" width="26" height="34">
        <path d="M2 1 L2 26 L8.5 20 L12.5 30 L17 28 L13 18.5 L21 18 Z"
              fill="#1e1a14" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ── Surfaces ───────────────────────────────────────────────────────────────
// Each beat's content. "Kept deliberately plain" was the mistake in cut 1: rows
// with coloured dots and name/date pairs could belong to any note app, so the
// piece read as a generic productivity reel with good transitions.
//
// Plain is not the same as generic. Every surface below is still simple enough
// to read inside a rectangle that resizes every two seconds — but each carries
// the things that make it THIS product and no other: verse keys, Arabic surah
// names, the note-type labels in their own colours, scholars with their death
// dates AND a line of what they actually said, the munāsabāt tag, the ↔ that
// marks a Connection. Those details cost no legibility and they are the whole
// difference between showing software and showing THIS software.

const Row: React.FC<{ label: string; sub?: string; ar?: string; n?: number;
                     dim?: number; on?: boolean }> =
({ label, sub, ar, n, dim = 0, on }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 16, padding: "18px 26px",
    borderRadius: 12, background: on ? R.accentSoft : "transparent",
    filter: dim ? `blur(${dim}px)` : undefined, opacity: dim ? 0.55 : 1,
  }}>
    <div style={{ width: 12, height: 12, borderRadius: 6,
                  background: on ? R.accent : R.ink4, flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: R.fontSans, fontSize: 30, color: R.ink }}>{label}</div>
      {sub && <div style={{ fontFamily: R.fontMono, fontSize: 19, color: R.ink3,
                            marginTop: 4, letterSpacing: "0.03em" }}>{sub}</div>}
    </div>
    {n !== undefined && n > 0 && (
      <div style={{ fontFamily: R.fontMono, fontSize: 18, color: R.ink4,
                    padding: "3px 10px", borderRadius: 20, background: R.panel }}>{n}</div>
    )}
    {ar && <div style={{ fontFamily: R.fontSerif, fontSize: 27, color: R.ink3 }}>{ar}</div>}
  </div>
);

/* The open used to be 89 static frames out of 90 — the single worst reading in
   the whole measurement, and the first thing a viewer sees. The mark now builds
   itself: the letter settles, the rule under it draws left-to-right, and the
   wordmark's letters track in from tight. Nothing here is decoration; it is
   there so frame 0 is not a still. */
const Wordmark: React.FC<{ p?: number }> = ({ p = 1 }) => {
  const q = ease(Math.min(1, Math.max(0, p)));
  const letters = "TAFSIR LAB".split("");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{
        fontFamily: R.fontSerif, fontSize: 76, color: R.ink, lineHeight: 1,
        opacity: interpolate(q, [0, 0.35], [0, 1], clamp),
        transform: `translateY(${(1 - q) * 14}px)`,
      }}>ت</div>
      <div style={{ width: 118, height: 2, background: R.ink4, overflow: "hidden" }}>
        <div style={{ width: `${interpolate(q, [0.25, 0.8], [0, 100], clamp)}%`,
                      height: "100%", background: R.ink3 }} />
      </div>
      <div style={{ display: "flex", fontFamily: R.fontMono, fontSize: 18, color: R.ink3 }}>
        {letters.map((c, i) => (
          <span key={i} style={{
            /* letter-spacing settles from tight — a translate, not a tracking
               animation, so it moves real pixels (§11.9) */
            transform: `translateX(${(1 - interpolate(q, [0.4 + i * 0.02, 0.8 + i * 0.02], [0, 1], clamp)) * (i - 4.5) * -3}px)`,
            opacity: interpolate(q, [0.4 + i * 0.02, 0.72 + i * 0.02], [0, 1], clamp),
            letterSpacing: "0.22em",
          }}>{c === " " ? " " : c}</span>
        ))}
      </div>
    </div>
  );
};

/** Beat 3 — a line of Qurʾānic text with ink drawn ON it (draw, not swap). */
const InkSurface: React.FC<{ p: number }> = ({ p }) => {
  const len = 520;
  return (
    <div style={{ padding: "34px 30px", position: "relative" }}>
      <div style={{ fontFamily: R.fontSerif, fontSize: 62, color: R.ink,
                    direction: "rtl", textAlign: "center", lineHeight: 1.9 }}>
        ٱلْحَىُّ ٱلْقَيُّومُ
      </div>
      <svg width="100%" height="120" style={{ position: "absolute", left: 0, right: 0, top: 128 }}>
        {/* one continuous stroke, revealed by dash offset — the ink is drawn,
            it does not fade in */}
        <path d="M210 44 C300 12, 470 10, 600 34 C660 46, 700 40, 730 24"
              stroke={R.highlight} strokeWidth="16" fill="none" strokeLinecap="round"
              opacity={0.55}
              strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
      </svg>
      <div style={{ marginTop: 78, opacity: interpolate(p, [0.30, 0.62], [0, 1], clamp) }}>
        <div style={{ fontFamily: R.fontMono, fontSize: 17, color: R.ink3,
                      letterSpacing: "0.05em" }}>WORD 5 · 2:255 · AL-QAYYŪM</div>
        <div style={{ marginTop: 14, background: "#FEF6E7", borderRadius: 10,
                      padding: "16px 18px" }}>
          <div style={{ fontFamily: R.fontMono, fontSize: 16, color: "#92400E",
                        letterSpacing: "0.06em", textTransform: "uppercase" }}>Linguistic</div>
          <div style={{ fontFamily: R.fontSans, fontSize: 24, color: R.ink2, marginTop: 8,
                        lineHeight: 1.5 }}>
            From <i>qāma</i> — to stand. Ibn Taymiyyah held this the greatest name.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16,
                      opacity: interpolate(p, [0.62, 0.9], [0, 1], clamp) }}>
          {["Linguistic", "Thematic", "Cross-ref"].map((t, k) => (
            <div key={t} style={{
              fontFamily: R.fontMono, fontSize: 16, padding: "7px 13px", borderRadius: 20,
              background: k === 0 ? "#FEF6E7" : R.panel,
              color: k === 0 ? "#92400E" : R.ink4,
            }}>{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** Beat 5 — the slash menu grows DOWNWARD out of the line being typed. */
const SlashSurface: React.FC<{ p: number; sel: number }> = ({ p, sel }) => {
  const items: [string, string][] = [
    ["/ayah",   "Embed a verse — Al-Baqarah 2:255"],
    ["/tafsir", "Pull commentary into the note"],
    ["/link",   "Create a permanent Connection"],
    ["/word",   "Anchor a note to one word"],
  ];
  const n = interpolate(p, [0.2, 1], [0, items.length], clamp);
  /* `sel` comes from the cursor's own arrival frame rather than from p, which
     tops out five frames too early to line up with it. The highlight follows
     the cursor down to /tafsir because /tafsir is what gets pressed and what
     the next beat opens; left on /ayah, the press landed on an inert row and
     the panel that followed had no source. */
  return (
    <div style={{ padding: "30px 28px" }}>
      <div style={{ fontFamily: R.fontSans, fontSize: 30, color: R.ink }}>
        On the meaning of al-Qayyūm
      </div>
      <div style={{ fontFamily: R.fontMono, fontSize: 30, color: R.accentInk, marginTop: 22 }}>
        /{p > 0.15 ? "ayah" : ""}<span style={{ opacity: Math.round(p * 30) % 2 ? 1 : 0.2 }}>▌</span>
      </div>
      <div style={{ marginTop: 20, borderTop: `1px solid ${R.line}`, paddingTop: 14 }}>
        {items.map(([cmd, desc], k) => {
          const o = interpolate(n, [k, k + 0.6], [0, 1], clamp);
          return (
            <div key={cmd} style={{
              display: "flex", alignItems: "baseline", gap: 14,
              padding: "12px 12px", borderRadius: 8,
              background: k === sel ? R.accentSoft : "transparent",
              opacity: o, transform: `translateY(${(1 - o) * 12}px)`,
            }}>
              <span style={{ fontFamily: R.fontMono, fontSize: 24,
                             color: k === sel ? R.accentInk : R.ink2 }}>{cmd}</span>
              <span style={{ fontFamily: R.fontSans, fontSize: 19, color: R.ink3 }}>{desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Beat 6 — the tafsir panel slides in laterally; rack focus points at it (§5). */
const TafsirSurface: React.FC<{ p: number }> = ({ p }) => (
  /* inset:0 rather than height:100% — the surface wrapper is sized by its
     content, so a percentage height collapsed the panel into a floating band
     halfway down the card instead of a full-height margin. */
  <div style={{ display: "flex", position: "absolute", inset: 0 }}>
    <div style={{ flex: 1, padding: "28px 24px",
                  filter: `blur(${interpolate(p, [0.3, 1], [0, 5], clamp)}px)`,
                  opacity: interpolate(p, [0.3, 1], [1, 0.5], clamp) }}>
      <div style={{ fontFamily: R.fontSerif, fontSize: 40, color: R.ink, direction: "rtl" }}>
        ٱلْقَيُّومُ
      </div>
      <div style={{ fontFamily: R.fontSans, fontSize: 22, color: R.ink3, marginTop: 14 }}>
        2:255 · Āyat al-Kursī
      </div>
    </div>
    <div style={{
      width: "56%", background: R.panel, borderLeft: `1px solid ${R.line}`,
      padding: "26px 22px",
      transform: `translateX(${(1 - ease(p)) * 100}%)`,
    }}>
      <div style={{ fontFamily: R.fontMono, fontSize: 16, color: R.ink4,
                    letterSpacing: "0.06em", marginBottom: 16 }}>67 COMMENTARIES</div>
      {([["Ibn Kathīr", "774 AH",
          "The Ever-Living who never dies; nothing subsists without Him."],
         ["Al-Qurṭubī", "671 AH",
          "The One who stands over every soul in what it earns."],
         ["Al-Ṭabarī", "310 AH",
          "He manages the creation and is not managed by it."]] as [string,string,string][])
        .map(([n, d, body], k) => (
        <div key={n} style={{ marginBottom: 18, paddingBottom: 16,
                              borderBottom: k < 2 ? `1px solid ${R.line}` : "none",
                              opacity: interpolate(p, [0.35 + k * 0.14, 0.6 + k * 0.14], [0, 1], clamp) }}>
          <div style={{ fontFamily: R.fontSans, fontSize: 24, color: R.ink }}>{n}</div>
          <div style={{ fontFamily: R.fontMono, fontSize: 15, color: R.ink3, marginTop: 3 }}>{d}</div>
          <div style={{ fontFamily: R.fontSans, fontSize: 19, color: R.ink2, marginTop: 8,
                        lineHeight: 1.45 }}>{body}</div>
        </div>
      ))}
    </div>
  </div>
);

/** Beat 7 — collaborators arrive from outside the frame and settle (swarm). */
const HalaqaSurface: React.FC<{ p: number }> = ({ p }) => {
  /* Each needs its own DESTINATION, not just its own entry vector. The first
     cut gave all four the same final position and only varied where they came
     from, so they converged into one unreadable pile the moment they landed. */
  const people = [
    { n: "Yahya",   c: "#448061", fy:   0, dx: -340, dy: -120, t: 0.00 },
    { n: "Amina",   c: "#695ba9", fy:  74, dx:  340, dy:  -60, t: 0.12 },
    { n: "Bilal",   c: "#b07d3a", fy: 148, dx:  340, dy:   60, t: 0.24 },
    { n: "Sumayya", c: "#3a6fb0", fy: 222, dx: -340, dy:  120, t: 0.36 },
  ];
  return (
    <div style={{ padding: "28px 24px", position: "relative", height: "100%" }}>
      <div style={{ border: `1px solid ${R.lineStrong}`, borderRadius: 10,
                    padding: "16px 18px", background: R.bgElev, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontFamily: R.fontSans, fontSize: 23, fontWeight: 600, color: R.ink }}>
            The One who sustains
          </div>
          <div style={{ fontSize: 19, color: R.iconLink }}>🔗</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9,
                      fontFamily: R.fontSans, fontSize: 20, color: R.ink2 }}>
          <span>Al-Baqarah 2:255</span>
          <span style={{ color: R.iconLink }}>↔</span>
          <span>Āl ʿImrān 3:2</span>
        </div>
        <div style={{ fontFamily: R.fontMono, fontSize: 15, color: R.ink4, marginTop: 10 }}>
          Munāsabāt · divine names
        </div>
      </div>
      <div style={{ position: "relative", height: 250 }}>
        {people.map((pp) => {
          const q = ease(interpolate(p, [pp.t, pp.t + 0.4], [0, 1], clamp));
          return (
            <div key={pp.n} style={{
              position: "absolute", left: 96, top: pp.fy,
              transform: `translate(${(1 - q) * pp.dx}px, ${(1 - q) * pp.dy}px)`,
              opacity: q, display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 19, background: pp.c }} />
              <div style={{ fontFamily: R.fontSans, fontSize: 26, color: R.ink2 }}>{pp.n}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: R.fontMono, fontSize: 18, color: R.ink3,
                    opacity: interpolate(p, [0.72, 1], [0, 1], clamp) }}>
        Tuesday Ḥalaqa · 4 reading
      </div>
    </div>
  );
};

// ── Surface router ─────────────────────────────────────────────────────────

const Surface: React.FC<{ i: number; f: number }> = ({ i, f }) => {
  const since = f - BEATS[i].at;
  /* Counted from the boundary, not from boundary+8. The blur-through hands the
     card over around since=10–17, and with the old lead the incoming surface
     was still at p≈0.02 there — so the blur cleared to reveal almost nothing
     and the content then faded up on its own afterwards. Two reveals in a row,
     the first of them empty. */
  const p = Math.min(1, Math.max(0, since / 128));
  switch (i) {
    /* Beat 0 builds the mark over its own 64 frames; beat 8 is the same mark
       already assembled, so the last frame matches the first and the loop
       closes (§7). */
    case 0: return <Wordmark p={f / 52} />;
    case 8: return <Wordmark p={1} />;
    case 1: return (
      <div style={{ padding: "26px 24px" }}>
        <div style={{ fontFamily: R.fontMono, fontSize: 17, color: R.ink4,
                      letterSpacing: "0.09em", padding: "0 26px 10px" }}>
          TAFSIR STUDY GROUP · 5 MEMBERS
        </div>
        <Row label="Al-Fātiḥah" sub="7 āyāt · complete"     ar="الفاتحة" n={4} />
        <Row label="Al-Baqarah" sub="286 āyāt · in progress" ar="البقرة"  n={12} on />
        <Row label="Āl ʿImrān"  sub="200 āyāt · not started" ar="آل عمران" n={0} />
      </div>
    );
    case 2: return (
      <div style={{ padding: "22px 20px" }}>
        {/* the rack WALKS: focus sits on each row in turn rather than picking
            one and holding it for two seconds (§5 — rack focus as a pointer) */}
        {[["Overview", "surah map · 6 notes"], ["Āyat al-Kursī (2:255)", "word notes · 11"],
          ["Verses 256–286", "linguistic · 2"], ["Munāsabāt", "connections · 6"]].map(([a, b], k) => {
          /* Down the list, then back to the one being taken. It used to walk
             0→3 and finish on Munāsabāt while the cursor was picking up Āyat
             al-Kursī — the focus pointing at one row and the hand at another.
             It now settles on row 1 exactly as the grab happens. */
          const focusIdx = interpolate(p, [0.12, 0.46, 0.72], [0, 3, 1], clamp);
          const near = Math.max(0, 1 - Math.abs(focusIdx - k));
          return (
            <Row key={a} label={a} sub={b} on={near > 0.55}
                 dim={interpolate(p, [0.22, 0.42], [0, 1], clamp) * (1 - near) * 4} />
          );
        })}
      </div>
    );
    case 3: return (
      <div style={{ padding: "30px 28px" }}>
        <div style={{ fontFamily: R.fontMono, fontSize: 19, color: R.ink3,
                      letterSpacing: "0.05em", marginBottom: 18,
                      opacity: interpolate(p, [0, 0.2], [0, 1], clamp) }}>
          ● 2:255 · AL-BAQARAH
        </div>
        <div style={{ direction: "rtl", textAlign: "center" }}>
          {["ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ", "ٱلْحَىُّ ٱلْقَيُّومُ",
            "لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ"].map((line, k) => (
            <div key={k} style={{
              fontFamily: R.fontSerif, fontSize: 46, color: R.ink, lineHeight: 2.0,
              /* starts at p=0, not p=0.1. This is the one surface whose every
                 element was gated late, so it was the one the blur-through
                 revealed as a blank card — the first line now arrives WITH the
                 blur clearing rather than a third of a second after it. */
              opacity: interpolate(p, [k * 0.13, 0.22 + k * 0.13], [0, 1], clamp),
            }}>{line}</div>
          ))}
        </div>
        <div style={{ fontFamily: R.fontSerif, fontSize: 23, fontStyle: "italic",
                      color: R.ink3, marginTop: 22, textAlign: "center",
                      opacity: interpolate(p, [0.62, 0.88], [0, 1], clamp) }}>
          Allāhu lā ilāha illā huw, al-ḥayyu l-qayyūm…
        </div>
      </div>
    );
    case 4: return <InkSurface p={p} />;
    case 5: return <SlashSurface p={p} sel={f >= arriveAt(ACTS[5]) - 4 ? 1 : 0} />;
    case 6: return <TafsirSurface p={p} />;
    case 7: return <HalaqaSurface p={p} />;
    default: return null;
  }
};

// ── The throw (§9) ─────────────────────────────────────────────────────────
// Beat 3 does not morph into place — a row is THROWN out of beat 2 and the
// container catches it. The arc is the tracked one: slingshot, nine-frame
// hang, fall twice as fast as the rise.
//
// THROW_AT is derived from BEATS[3] now, not typed. Typed, it was 244: the
// card landed at 304 and the mushaf opened at 384, so the delivery finished a
// second and a third BEFORE the thing it delivered. It now touches down on the
// exact frame beat 3 begins, and dissolves into it.

const Thrown: React.FC = () => {
  const f = useCurrentFrame();
  const p = (f - THROW_AT) / THROW_LEN;
  if (p < 0 || p > 1) return null;
  const dy = track(p, ARC.S, ARC.Y);
  const v  = Math.abs(track(Math.min(1, p + 0.01), ARC.S, ARC.Y) - dy) / 0.01;
  const fade = interpolate(p, [0.86, 1], [1, 0], clamp);
  return (
    <div style={{
      /* leaves from under the cursor — ACTS[2] sits inside this box, so the
         hand is holding the card rather than standing next to it */
      position: "absolute", left: CX - 240, top: CY - 82 + dy, width: 300,
      opacity: fade, zIndex: 30,
      filter: `blur(${Math.min(9, v / 90)}px)`,
      background: R.bgElev, borderRadius: 12, padding: "16px 20px",
      boxShadow: R.shadowMd,
      fontFamily: R.fontSans, fontSize: 26, color: R.ink, textAlign: "center",
    }}>Āyat al-Kursī</div>
  );
};

// ── Composition ────────────────────────────────────────────────────────────

export const OneDesk: React.FC = () => {
  const f = useCurrentFrame();
  const g = geom(f);
  const cb = contentBlur(g.m);
  const beat = BEATS[g.i];

  /* THE OUTGOING CONTENT HAS TO ACTUALLY GO OUT.
     contentBlur is a curve in two halves — old content smears away, void, new
     content smears in — but the router below took its index from phase(), which
     flips to the new beat on the boundary frame, where the curve is still
     saying "fully opaque, no blur". So the blur-out half never had anything to
     play on: the old surface was replaced by a HARD CUT on frame BEATS[i].at,
     and the new one arrived at its own p≈0, which for a card whose contents are
     gated on p draws an empty rectangle. Measured on frame 232: the surah list
     is gone and the page list is at full opacity, one frame after the boundary,
     inside a container that has not finished resizing.
     A cut to a blank card is exactly, literally, a screen coming out of
     nowhere. Everything else in this file was designed to avoid a cut and this
     put one on all seven transitions.
     So during the first half we hold the PREVIOUS beat at its settled state and
     cross only where the curve has taken opacity to zero. */
  const out = g.m < 0.42;
  const si  = out ? Math.max(0, g.i - 1) : g.i;
  const sf  = out ? BEATS[si].at + 140 : f;

  /* The stage warms very slightly across the run and returns — a global tone
     change, so smoothstep, whose peak rate matches the linear ramp it replaces
     rather than tripling it the way cubic in/out would (§11.11). */
  const warm = smoothstep(Math.min(1, Math.abs(f - 600) / 600));

  return (
    <AbsoluteFill style={{ background: `hsl(252 8% ${89 + warm * 1.6}%)` }}>
      {/* one object, floating, with real stage around it at all times (§1) */}
      <div style={{
        position: "absolute", left: CX - g.w / 2, top: CY - g.h / 2,
        width: g.w, height: g.h, borderRadius: g.r,
        background: R.bgElev, boxShadow: R.shadowLg,
        overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: cb.opacity,
          filter: `blur(${cb.blur}px)`,
          transform: `translateX(${cb.dx}px)`,
        }}>
          <div style={{ width: "100%" }}><Surface i={si} f={sf} /></div>
        </div>
      </div>

      <Thrown />
      {beat.cap && beat.side &&
        <Caption text={beat.cap} at={beat.at + MORPH} side={beat.side} h={g.h} />}
      <ClickFX />
      <Cursor />

      {/* ── Sound ──────────────────────────────────────────────────────────
          Not a timeline. Every cue below is pinned to a frame the picture
          already computes — the clicks ARE pressAt(), the throw cues are the
          throw's own constants — so a retimed beat drags its audio with it and
          the two cannot come apart again. Hand-typed, they had: six clicks
          averaging 84 frames ahead of the screens they were meant to cause.
          §12.1: the loudest moments are the CATCH and the COLLAPSE, never a
          launch. §12.6: no one family carries a section — whoosh twice in
          twenty-two seconds. §12.3: each cue has room after it for its tail. */}
      <Audio src={staticFile("bg.mp3")} volume={0.15} />

      {/* the spine: one click per press, on the press */}
      {ACTS.filter((a) => !a.grab).map((a, k) => (
        <Sequence key={a.beat} from={pressAt(a)} durationInFrames={40}>
          <Audio src={staticFile("sfx/click.mp3")}
                 volume={[0.40, 0.36, 0.42, 0.34, 0.38, 0.36, 0.44][k]} />
        </Sequence>
      ))}

      {/* the grab, the flight, the catch */}
      <Sequence from={arriveAt(ACTS[2])} durationInFrames={40}>
        <Audio src={staticFile("sfx/granular-select.mp3")} volume={0.26} /></Sequence>
      <Sequence from={THROW_AT} durationInFrames={64}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.30} /></Sequence>
      <Sequence from={THROW_AT + THROW_LEN - 6} durationInFrames={80}>
        <Audio src={staticFile("sfx/land.mp3")} volume={0.54} /></Sequence>

      {/* and one per thing the screen does on its own: the ink drawing, the
          /ayah typing itself out, the panel sliding in, the group arriving */}
      <Sequence from={BEATS[4].at + 16}  durationInFrames={80}>
        <Audio src={staticFile("sfx/granular.mp3")} volume={0.22} /></Sequence>
      <Sequence from={BEATS[5].at + 18}  durationInFrames={96}>
        <Audio src={staticFile("sfx/typing.mp3")} volume={0.36} /></Sequence>
      <Sequence from={BEATS[6].at + 6}   durationInFrames={64}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.22} /></Sequence>
      <Sequence from={BEATS[7].at + 14}  durationInFrames={80}>
        <Audio src={staticFile("sfx/magnetic.mp3")} volume={0.34} /></Sequence>
      <Sequence from={BEATS[8].at}       durationInFrames={110}>
        <Audio src={staticFile("sfx/land.mp3")} volume={0.52} /></Sequence>
    </AbsoluteFill>
  );
};

export default OneDesk;
