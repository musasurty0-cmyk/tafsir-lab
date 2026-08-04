import React from "react";
import {
  AbsoluteFill, Sequence, Audio, staticFile,
  useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import { LIGHT } from "./morph";
import {
  BEATS, MOVE, STAGGER, N, STROKE_FRAMES, type Stroke, type Field,
} from "./strokes";

export { STROKE_FRAMES };

/* ── Eight strokes, rearranged ─────────────────────────────────────────────
   No fades, no cuts, no dissolves. The same eight objects are on screen for
   the whole piece and every scene is an arrangement of them, so one idea
   physically becomes the next.                                              */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const S = 1000;

/* Front-loaded with a little overshoot: the set arrives fast and settles,
   which is what gives a move a peak instead of a slow drift. */
const ease = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return 1 + 2.05 * Math.pow(x - 1, 3) + 1.05 * Math.pow(x - 1, 2);
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const hex = (c: string): [number, number, number] =>
  [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mixC = (a: string, b: string, t: number) => {
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b);
  return `rgb(${Math.round(lerp(ar, br, t))},${Math.round(lerp(ag, bg, t))},${Math.round(lerp(ab, bb, t))})`;
};

/** Handles the transparent field a ring needs, which hex mixing cannot. */
const rgba = (c: string): [number, number, number, number] => {
  if (c.startsWith("#")) { const [r, g, b] = hex(c); return [r, g, b, 1]; }
  const n = c.replace(/[^\d.,]/g, "").split(",").map(Number);
  return [n[0] || 0, n[1] || 0, n[2] || 0, n[3] ?? 1];
};
const mixRGBA = (a: string, b: string, t: number) => {
  const A = rgba(a), B = rgba(b);
  /* A transparent colour has no hue to blend, so take the visible side's hue
     and move only the alpha — otherwise a fill fading out drags through grey. */
  const hueFrom = A[3] < 0.02 ? B : A, hueTo = B[3] < 0.02 ? A : B;
  return `rgba(${Math.round(lerp(hueFrom[0], hueTo[0], t))},${Math.round(lerp(hueFrom[1], hueTo[1], t))},` +
         `${Math.round(lerp(hueFrom[2], hueTo[2], t))},${lerp(A[3], B[3], t).toFixed(3)})`;
};

/** Where the eight strokes are at this frame, and how far through a move. */
function strokesAt(f: number) {
  let i = 0;
  for (let k = 0; k < BEATS.length; k++) if (BEATS[k].at <= f) i = k;
  const a = BEATS[i], b = BEATS[i + 1];
  const moving = b !== undefined && f > b.at - MOVE;

  if (!moving) {
    /* Even at rest the set breathes, so no frame is ever truly static. */
    const drift = Math.sin((f - a.at) / 34) * 3;
    return {
      key: a.key, p: 1, spin: 0, field: a.field,
      strokes: a.shape.map((s, k) => ({
        ...s, y1: s.y1 + drift * (k % 2 ? 1 : -1), y2: s.y2 + drift * (k % 2 ? 1 : -1),
      })),
    };
  }

  const from = b.at - MOVE;
  const p = Math.max(0, Math.min(1, (f - from) / MOVE));
  const spin = (b.spin ?? 0) * Math.sin(p * Math.PI);

  const strokes = a.shape.map((s0, k) => {
    const s1 = b.shape[k];
    /* Per-stroke offset: the wave is what stops eight lines moving as one
       rigid plank. */
    const t = ease((f - (from + k * STAGGER)) / (MOVE - (N - 1) * STAGGER));
    return {
      x1: lerp(s0.x1, s1.x1, t), y1: lerp(s0.y1, s1.y1, t),
      x2: lerp(s0.x2, s1.x2, t), y2: lerp(s0.y2, s1.y2, t),
      w:  lerp(s0.w,  s1.w,  t),
      b:  lerp(s0.b ?? 0, s1.b ?? 0, t),
      c:  mixC(s0.c, s1.c, Math.max(0, Math.min(1, t))),
    };
  });
  /* The field is the mass of the picture, so it travels on the same curve as
     the strokes rather than being cross-faded underneath them. */
  const tf = ease((f - from) / MOVE);
  const ct = Math.max(0, Math.min(1, tf));
  const field: Field = {
    w: lerp(a.field.w, b.field.w, tf),
    h: lerp(a.field.h, b.field.h, tf),
    r: lerp(a.field.r, b.field.r, tf),
    c: mixRGBA(a.field.c, b.field.c, ct),
    sc: a.field.sc || b.field.sc
      ? mixRGBA(a.field.sc ?? "rgba(0,0,0,0)", b.field.sc ?? "rgba(0,0,0,0)", ct)
      : undefined,
    sw: lerp(a.field.sw ?? 0, b.field.sw ?? 0, tf),
  };

  return { key: b.key, p, spin, strokes, field };
}

/** A stroke is drawn as a quadratic so it can bow into a chord. */
const path = (s: { x1: number; y1: number; x2: number; y2: number; b?: number }) => {
  const bow = s.b ?? 0;
  if (Math.abs(bow) < 0.002) return `M${s.x1} ${s.y1} L${s.x2} ${s.y2}`;
  const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
  /* Bow toward the centre of the square, which is what turns a straight line
     into a chord across a ring. */
  const cx = mx + (500 - mx) * bow * 2.2;
  const cy = my + (500 - my) * bow * 2.2;
  return `M${s.x1} ${s.y1} Q${cx} ${cy} ${s.x2} ${s.y2}`;
};

/* ── What each arrangement is showing ─────────────────────────────────────
   The overlay lands ON the strokes — Arabic sitting on the lines that became
   āyāt, titles on the lines that became spines. It arrives late in the hold
   and leaves before the next move, so the strokes are never interrupted. */

/* The envelope has to stay strictly increasing however short the hold is —
   a fixed 10/26/-14 pattern inverts as soon as a beat is under 40 frames. */
const useHold = (f: number, key: string) => {
  const i = BEATS.findIndex((b) => b.key === key);
  const at = BEATS[i].at;
  const end = BEATS[i + 1] ? BEATS[i + 1].at - MOVE : STROKE_FRAMES;
  const span = Math.max(4, end - at);
  const a = at + span * 0.10;
  const b = at + span * 0.30;
  const c = at + span * 0.82;
  return interpolate(f, [a, b, c, end], [0, 1, 1, 0], clamp);
};

const Label: React.FC<{ f: number; k: string; text: string; y: number }> =
({ f, k, text, y }) => {
  const o = useHold(f, k);
  if (o <= 0.01) return null;
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: y, textAlign: "center",
      opacity: o, fontFamily: R.fontSans, fontSize: 30, letterSpacing: "0.18em",
      textTransform: "uppercase", color: LIGHT.ink4,
    }}>{text}</div>
  );
};

/** Arabic written onto the strokes that became āyāt. */
const AYAT = [
  "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
  "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
  "الرَّحْمَٰنِ الرَّحِيمِ",
  "مَالِكِ يَوْمِ الدِّينِ",
  "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
  "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
  "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ",
];

const Mushaf: React.FC<{ f: number; k: string; px: (v: number) => number }> =
({ f, k, px }) => {
  const o = useHold(f, k);
  if (o <= 0.01) return null;
  return (
    <>
      {AYAT.map((t, i) => (
        <div key={i} dir="rtl" style={{
          position: "absolute", right: px(240), top: px(320 + i * 72 - 34),
          opacity: o, fontFamily: R.fontArabic, fontSize: px(46),
          color: LIGHT.ink, whiteSpace: "nowrap",
        }}>{t}</div>
      ))}
    </>
  );
};

const COMMANDS = ["/link", "/ayah", "/tafsir", "/kathir", "/quote", "/h1", "/task", "/help"];

const Menu: React.FC<{ f: number; k: string; px: (v: number) => number }> = ({ f, k, px }) => {
  const o = useHold(f, k);
  if (o <= 0.01) return null;
  return (
    <>
      {COMMANDS.map((c, i) => (
        <div key={c} style={{
          position: "absolute", left: px(276), top: px(250 + i * 70 - 22),
          opacity: o, fontFamily: R.fontMono, fontSize: px(30), color: LIGHT.ink2,
        }}>{c}</div>
      ))}
    </>
  );
};

const BOOKS = ["الأصول", "الواسطية", "النووية", "الأحكام", "البيقونية", "الورقات", "الآجرومية", "التوحيد"];

const Shelf: React.FC<{ f: number; k: string; px: (v: number) => number }> = ({ f, k, px }) => {
  const o = useHold(f, k);
  if (o <= 0.01) return null;
  return (
    <>
      {BOOKS.map((b, i) => (
        <div key={b} style={{
          position: "absolute", left: px(300 + i * 58 - 22), top: px(400),
          width: px(44), opacity: o,
          fontFamily: R.fontArabic, fontSize: px(26), color: "#fff",
          writingMode: "vertical-rl", textAlign: "center", whiteSpace: "nowrap",
        }}>{b}</div>
      ))}
    </>
  );
};

const Wordmark: React.FC<{ f: number; px: (v: number) => number }> = ({ f, px }) => {
  const at = BEATS[BEATS.length - 1].at;
  const o = interpolate(f, [at - 26, at + 6], [0, 1], clamp);
  if (o <= 0.01) return null;
  return (
    <>
      <div style={{
        position: "absolute", left: 0, right: 0, top: px(430), textAlign: "center",
        opacity: o, fontFamily: R.fontSerif, fontSize: px(96),
        color: LIGHT.ink, letterSpacing: "-0.025em",
        transform: `translateY(${(1 - o) * px(20)}px)`,
      }}>Tafsir Lab</div>
      <div style={{
        position: "absolute", left: 0, right: 0, top: px(640), textAlign: "center",
        opacity: interpolate(f, [at + 10, at + 34], [0, 1], clamp),
        fontFamily: R.fontSans, fontSize: px(26), color: LIGHT.ink3,
        letterSpacing: "0.2em", textTransform: "uppercase",
      }}>Study the Qurʾān</div>
    </>
  );
};

/* ── Composition ──────────────────────────────────────────────────────────*/

const Body: React.FC = () => {
  const f = useCurrentFrame();
  const st = strokesAt(f);

  /* The square is mapped into the frame; px() converts square units to frame
     pixels so overlays land exactly on the strokes they belong to. */
  const BOX = 980;
  const px = (v: number) => (v / S) * BOX;
  const left = (1080 - BOX) / 2, top = (1920 - BOX) / 2;

  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", left, top, width: BOX, height: BOX,
        transform: `rotate(${st.spin}deg)`,
      }}>
        <svg viewBox={`0 0 ${S} ${S}`} width={BOX} height={BOX}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {/* The field: one form carrying the weight of the picture, so a
              scene change swings most of the frame and not just eight lines. */}
          <rect
            x={500 - st.field.w / 2} y={500 - st.field.h / 2}
            width={st.field.w} height={st.field.h} rx={st.field.r} ry={st.field.r}
            fill={st.field.c}
            stroke={st.field.sc} strokeWidth={st.field.sw} />
          {st.strokes.map((s, i) => (
            <path key={i} d={path(s)} stroke={s.c} strokeWidth={s.w}
              strokeLinecap="round" fill="none" />
          ))}
        </svg>

        <Mushaf f={f} k="mushaf" px={px} />
        <Mushaf f={f} k="annotated" px={px} />
        <Menu   f={f} k="menu"   px={px} />
        <Shelf  f={f} k="shelf"  px={px} />
        <Wordmark f={f} px={px} />
      </div>

      <Label f={f} k="page"      text="Write" y={1560} />
      <Label f={f} k="slash"     text="One key" y={1560} />
      <Label f={f} k="menu"      text="Every block" y={1560} />
      <Label f={f} k="mushaf"    text="The muṣḥaf" y={1560} />
      <Label f={f} k="annotated" text="Marked up" y={1560} />
      <Label f={f} k="ring"      text="Connections" y={1560} />
      <Label f={f} k="shelf"     text="A library" y={1560} />
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ at: number; file: string; v: number; len?: number }> =
({ at, file, v, len = 22 }) => (
  <Sequence from={at} durationInFrames={len}>
    <Audio src={staticFile(file)} volume={v} />
  </Sequence>
);

export const StrokeReel: React.FC = () => (
  <AbsoluteFill style={{ background: LIGHT.stage }}>
    <AbsoluteFill style={{
      background: "radial-gradient(56% 40% at 50% 47%, rgba(255,255,255,0.9), rgba(255,255,255,0) 72%)",
    }} />
    <Body />

    <Audio
      src={staticFile("bg2.mp3")}
      startFrom={33 * 60}
      volume={(fr) =>
        0.18 * interpolate(fr, [0, 60, STROKE_FRAMES - 70, STROKE_FRAMES], [0, 1, 1, 0], clamp)}
    />

    {/* One hit per rearrangement, on the frame the strokes start travelling. */}
    {BEATS.slice(1).map((b) => (
      <Sfx key={b.key} at={b.at - MOVE} file="sfx/magnetic.mp3" v={0.5} len={14} />
    ))}
    <Sfx at={BEATS[6].at - MOVE} file="sfx/whoosh.mp3" v={0.4} len={40} />
    <Sfx at={BEATS[BEATS.length - 1].at - MOVE} file="sfx/whoosh.mp3" v={0.34} len={44} />
  </AbsoluteFill>
);
