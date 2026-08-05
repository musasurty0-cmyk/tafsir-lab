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
/** A hand does not type at a constant rate: it runs, then hesitates. Same
 *  total duration, uneven cadence, so the reveal has a pulse to it. */
const rhythm = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return Math.max(0, Math.min(1, x + 0.055 * Math.sin(x * 15.5) + 0.03 * Math.sin(x * 6.1)));
};

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
  /** The mark's whole life, as one span. */
  markFrom: 54, markFor: 112,
  paint: 190, paintFor: 44,
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

/** Text inset from the field's left edge. */
const PAD = 40;
/** The frame the mark finishes and the field's own caret takes over. Both
 *  sides read this one constant, so they can never both be on screen. */
const CARET_AT = T.markFrom + T.markFor;

/**
 * One source of truth for the field.
 *
 * The mark has to land exactly on the text line, and the text line moves,
 * because the field grows as it fills. Deriving both from here means they
 * cannot drift apart — the mark's left edge IS the field's text origin.
 */
const geom = (f: number) => {
  const grow = springy((f - (T.markFrom + 12)) / 46);
  const paint = rhythm(interpolate(f, [T.paint, T.paint + T.paintFor], [0, 1], clamp));
  const w = interpolate(grow, [0, 1], [430, 520], clamp) + paint * 190;
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

const MS = [0, 0.30, 0.52, 0.66, 0.86, 0.94, 1];
const MW = [0, 230, 16, 16, 3, 3, 3];
const MH = [7, 7, 16, 16, 40, 50, 46];   // 50 is a deliberate overshoot
const MR = [3.5, 3.5, 8, 8, 1.5, 1.5, 1.5];
const MY = [22, 22, 22, 20, 2, 0, 0];    // relative to the text line

const Mark: React.FC<{ f: number }> = ({ f }) => {
  if (f < T.markFrom || f >= CARET_AT) return null;
  const p = (f - T.markFrom) / T.markFor;
  const h = track(p, MS, MH);

  return (
    <div style={{
      position: "absolute",
      left: geom(f).textLeft,
      top: BAR_CY + track(p, MS, MY) - h / 2,
      width: track(p, MS, MW), height: h, borderRadius: track(p, MS, MR),
      background: "#111114", zIndex: 40,
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

const ic = { fill: "none", stroke: "#3c3c43", strokeWidth: 2.1,
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

  /* Continuous, not a boolean. The old `focused` flag flipped the background,
     the alignment, the text colour and the whole placeholder-to-URL swap on a
     single frame — six properties changing at once, which is a cut. */
  const foc = interpolate(f, [T.markFrom + 4, T.markFrom + T.markFor * 0.55], [0, 1], clamp);
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
      zIndex: 30,
    }}>
      <Round style={{
        transform: `translateX(${side}px) scale(${1 - c})`, opacity: 1 - c * 1.4,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" {...ic}><path d="M15 5l-7 7 7 7" /></svg>
      </Round>

      <div style={{
        width: pw, height: ph, borderRadius: pr, ...glass,
        background: `rgba(255,255,255,${0.66 + 0.3 * foc})`,
        boxSizing: "border-box", overflow: "hidden", position: "relative",
        fontFamily: R.fontSans, fontSize: 37,
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
            <span style={{ opacity: frac, filter: `blur(${(1 - frac) * 6}px)` }}>
              {URL[full]}
            </span>
          )}
          {/* The mark, continued. It ends at 3 x 46 on this exact line, so the
              swap on CARET_AT moves nothing. No blink — at this length a blink
              only ever reads as a glitch. */}
          {f >= CARET_AT && (
            <span style={{ display: "inline-block", width: 3, height: 46,
                           background: "#111114", flexShrink: 0 }} />
          )}
        </span>
      </div>

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
      filter: speed > 0.02 ? `blur(${speed * 5}px)` : undefined,
    }}>
      {PANELS.map((p, i) => {
        if (f < p.at - 10) return null;
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
            opacity: first ? ease((f - (p.at - 10)) / 9) : Math.min(1, e * 1.7),
            /* Enough to move attention forward, not enough to hide anything. */
            filter: depth > 0.02 ? `blur(${Math.min(depth, 1) * 2.6}px)` : undefined,
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

export const SearchReel: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#ffffff" }}>
      {/* The bloom the reference carries above the field — the only thing on
          the page that is not white. */}
      {f < T.collapse + T.collapseFor && (
        <div style={{
          position: "absolute", left: W / 2 - 260, top: BAR_CY - 150,
          width: 520, height: 120, borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(120,165,255,0.22), rgba(120,165,255,0))",
          filter: "blur(26px)",
          opacity: interpolate(f, [0, 30, T.collapse, T.collapse + 20], [0, 1, 1, 0], clamp),
        }} />
      )}
      <Stack f={f} />
      <Bar f={f} />
      <Mark f={f} />

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
