import React from "react";
import {
  AbsoluteFill, Sequence, Audio, staticFile,
  useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";

/* ── Search, then the panels ───────────────────────────────────────────────
   Rebuilt from the reference frame by frame.

   Three things the first attempt got wrong, all of them in the detail:

     · The dot is not a pointer. It is ONE object changing state — a short
       rule, which contracts to a dot, which drops into the field and becomes
       the caret. Nothing arrives and nothing leaves.
     · The address is PAINTED, not typed. It resolves as a whole out of a
       blur behind a wipe, rather than appearing a character at a time.
     · The panels do not line up and slide. Each lands ON TOP of the last,
       overlapping it, and the one behind falls out of focus. The group eases
       left only enough to keep the newest one near the middle.

   Landscape, like the source.                                              */

export const SEARCH_FRAMES = 800;   // 13.3s @ 60fps
const W = 1920, H = 1080;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const easeIO = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

const URL = "tafsir-lab.com";

const T = {
  sharp: 30,            // the push-in resolves
  load: 44,             // the page's loading bar runs
  ruleIn: 92,           // a short rule appears above the field
  toDot: 116,           // it contracts to a dot
  drop: 140,            // the dot falls into the field
  caret: 168,           // and becomes the caret; the field empties
  paint: 186,           // the address is painted in
  paintFor: 34,
  collapse: 268,        // the bar folds down into the first panel

  card1: 292,
  card2: 452,
  card3: 612,
} as const;

/** Square, all three the same, a little over a quarter of the frame wide. */
const CARD = 560;
/** How far right of the last one a new panel lands — under one card width, so
 *  they overlap rather than sitting in a row. */
const STEP = CARD * 0.62;
const CARD_CY = 560;

/* ── The browser bar ──────────────────────────────────────────────────────*/

const ic = { fill: "none", stroke: "#3c3c43", strokeWidth: 2.1,
             strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const Bar: React.FC<{ f: number }> = ({ f }) => {
  const push = interpolate(f, [0, T.sharp + 10], [0.86, 1], clamp);
  const soft = interpolate(f, [0, T.sharp], [14, 0], clamp);

  /* The bar does not fade — it folds down into where the first panel opens. */
  const c = ease((f - T.collapse) / 26);
  if (c >= 1) return null;

  const focused = f >= T.caret;
  const load = interpolate(f, [T.load, T.load + 34], [0, 1], clamp);
  const settled = interpolate(f, [T.load + 38, T.load + 58], [0, 1], clamp);

  /* Painted: a wipe uncovers the word while its own blur resolves, so it
     arrives as a whole rather than a letter at a time. */
  const paint = interpolate(f, [T.paint, T.paint + T.paintFor], [0, 1], clamp);
  const paintBlur = interpolate(f, [T.paint, T.paint + T.paintFor * 0.8], [9, 0], clamp);

  const barY = interpolate(c, [0, 1], [H / 2 - 46, CARD_CY - 30]);
  const scale = push * interpolate(c, [0, 1], [1, 0.34]);

  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: barY,
      display: "flex", flexDirection: "column", alignItems: "center",
      filter: `blur(${soft + c * 22}px)`,
      opacity: 1 - c * 0.9,
      transform: `scale(${scale})`, transformOrigin: "50% 0%",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        <svg width="34" height="34" viewBox="0 0 24 24" {...ic}><path d="M15 5l-7 7 7 7" /></svg>
        <svg width="34" height="34" viewBox="0 0 24 24" {...ic}
          style={{ opacity: focused ? 0 : 1 }}>
          <path d="M4 7h16M4 12h11M4 17h16" />
        </svg>

        <div style={{
          width: focused ? 620 : 430, height: 92, borderRadius: 46,
          background: focused ? "#ffffff" : "#eeeef1",
          boxShadow: focused ? "0 0 0 5px rgba(96,150,255,0.22)" : "none",
          display: "flex", alignItems: "center",
          justifyContent: focused ? "flex-start" : "center",
          padding: focused ? "0 38px" : 0, boxSizing: "border-box",
          fontFamily: R.fontSans, fontSize: 36,
          color: focused ? "#111114" : "#8e8e95",
          position: "relative",
        }}>
          {focused ? (
            <span style={{ position: "relative", display: "inline-block" }}>
              <span style={{
                display: "inline-block",
                clipPath: `inset(0 ${(1 - paint) * 100}% 0 0)`,
                filter: paintBlur > 0.2 ? `blur(${paintBlur}px)` : undefined,
              }}>{URL}</span>
              {paint >= 1 && (
                <span style={{
                  display: "inline-block", width: 3, height: 40, background: "#111114",
                  marginLeft: 4, verticalAlign: "middle",
                  opacity: Math.floor(f / 17) % 2 === 0 ? 1 : 0,
                }} />
              )}
            </span>
          ) : "search..."}
        </div>

        <svg width="34" height="34" viewBox="0 0 24 24" {...ic}>
          <path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 5v6h-6" />
        </svg>
        <svg width="34" height="34" viewBox="0 0 24 24" {...ic} strokeLinecap="butt">
          <rect x="8" y="4" width="12" height="12" rx="2.5" />
          <path d="M16 20H6a2 2 0 01-2-2V8" strokeLinecap="round" />
        </svg>
      </div>

      {!focused && (
        <div style={{ marginTop: 18, width: 430, height: 7, borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            width: `${load * 100}%`, height: "100%", borderRadius: 4,
            background: settled > 0.5 ? "#1c1c1e"
              : "linear-gradient(90deg,#5ac8fa,#34c759,#ffcc00,#ff375f,#af52de)",
          }} />
        </div>
      )}
    </div>
  );
};

/**
 * The mark above the field.
 *
 * Not a cursor: one object in three states. It draws as a short rule, gathers
 * itself into a dot, falls into the field, and stands up as the caret. Reading
 * it as a mouse arriving was the thing that made the opening feel ordinary.
 */
const Mark: React.FC<{ f: number }> = ({ f }) => {
  if (f < T.ruleIn || f > T.caret + 6) return null;
  const draw = ease((f - T.ruleIn) / 18);
  const gather = ease((f - T.toDot) / 20);
  const fall = easeIO((f - T.drop) / 26);
  const stand = ease((f - (T.caret - 10)) / 14);

  const w = interpolate(gather, [0, 1], [104, 22]);
  const h = interpolate(gather, [0, 1], [9, 22]);
  const r = interpolate(gather, [0, 1], [5, 11]);
  /* From dot to caret: narrow and tall, at the head of the field. */
  const cw = interpolate(stand, [0, 1], [w, 4]);
  const ch = interpolate(stand, [0, 1], [h, 42]);
  const cr = interpolate(stand, [0, 1], [r, 1]);

  const y = interpolate(fall, [0, 1], [H / 2 - 148, H / 2 + 1]);
  const x = interpolate(stand, [0, 1], [W / 2, W / 2 - 268]);

  return (
    <div style={{
      position: "absolute", left: x - cw / 2, top: y - ch / 2,
      width: cw * draw, height: ch, borderRadius: cr,
      background: "#111114", opacity: draw,
    }} />
  );
};

/* ── Panels ───────────────────────────────────────────────────────────────*/

const NOTE = "Seven verses, and the naming of them is given elsewhere.";

const EditorPane: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const s = at + 18;
  const n = Math.max(0, Math.floor((f - s - 20) * 0.5));
  const body = NOTE.slice(0, n);
  return (
    <div style={{ padding: 34, height: "100%", boxSizing: "border-box", background: "#fefdfc" }}>
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
        marginTop: 26, minHeight: 200,
      }}>
        {body}
        <span style={{
          display: "inline-block", width: 2, height: 22, background: "#1e1a14",
          marginLeft: 3, verticalAlign: "text-bottom",
          opacity: Math.floor(f / 16) % 2 === 0 ? 1 : 0,
        }} />
      </div>

      <div style={{
        marginTop: 20, padding: "16px 18px", borderRadius: 10,
        border: "1px solid rgba(30,26,20,0.10)",
        opacity: ease((f - s - 108) / 24),
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

/* Sūrat al-Fātiḥah, laid out the way the app lays it out: verses run on, with
   a numbered marker closing each one, rather than one verse to a line. */
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
const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

const AyahMark: React.FC<{ n: number }> = ({ n }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 25, height: 25, borderRadius: "50%",
    border: "1px solid rgba(30,26,20,0.34)",
    fontFamily: R.fontArabic, fontSize: 13, color: "#1e1a14",
    margin: "0 6px", verticalAlign: "middle",
  }}>{AR_DIGITS[n]}</span>
);

/** The canvas: the muṣḥaf as the app renders it, written on line by line. */
const CanvasPane: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const s = at + 16;
  return (
    <div style={{
      height: "100%", boxSizing: "border-box", background: "#fdfcfa",
      padding: "26px 24px", display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      {/* The sūrah picker, exactly as it sits on the page. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "9px 26px", borderRadius: 999,
        border: "1px solid rgba(30,26,20,0.13)", background: "#fff",
        opacity: ease((f - s) / 18),
      }}>
        <span style={{ fontSize: 11, color: "#908d88" }}>▾</span>
        <span style={{ fontFamily: R.fontArabic, fontSize: 22, color: "#1e1a14" }}>الفاتحة</span>
        <span style={{ fontFamily: R.fontSans, fontSize: 17, color: "#46423b" }}>Al-Fatihah</span>
      </div>
      <div style={{
        fontFamily: R.fontSans, fontSize: 13, color: "#a09484", marginTop: 14,
        opacity: ease((f - s - 8) / 18),
      }}>Press the Surah name to start studying</div>

      <div style={{ marginTop: 16, width: "100%" }}>
        {FATIHA.map((line, i) => {
          /* Each line is written, right to left, one after the other. */
          const p = ease((f - (s + 26 + i * 15)) / 26);
          if (p <= 0) return null;
          return (
            <div key={i} dir="rtl" style={{
              textAlign: "center", fontFamily: R.fontArabic, fontSize: 27,
              lineHeight: 2.1, color: "#1e1a14", whiteSpace: "nowrap",
              clipPath: `inset(0 0 0 ${(1 - p) * 100}%)`,
            }}>
              {line.map((seg, k) =>
                typeof seg === "number"
                  ? <AyahMark key={k} n={seg} />
                  : <span key={k}>{seg} </span>)}
            </div>
          );
        })}
      </div>

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

/** The mutoon library, running past. */
const LibraryPane: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const s = at + 16;
  const BW = 132, BG = 16;
  const total = BOOKS.length * (BW + BG);
  const scroll = interpolate(f, [s + 26, s + 190], [0, total - (CARD - 56)], clamp);
  return (
    <div style={{
      height: "100%", boxSizing: "border-box", background: "#fefdfc",
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

/* ── The stack ────────────────────────────────────────────────────────────*/

const PANELS = [
  { at: T.card1, label: "editor", tint: "#63b3f5", Pane: EditorPane },
  { at: T.card2, label: "canvas", tint: "#63b3f5", Pane: CanvasPane },
  { at: T.card3, label: "mutoon", tint: "#63b3f5", Pane: LibraryPane },
] as const;

const Stack: React.FC<{ f: number }> = ({ f }) => {
  /* How many have landed, as a smooth number — the group eases left by half a
     step per arrival so the newest sits near the middle and the older ones
     walk off to the left. */
  let landed = 0;
  for (const p of PANELS) landed += easeIO((f - p.at) / 40);
  const groupX = -(landed - 1) * (STEP * 0.52);

  /* One shared smear while the group is moving, which is what the reference
     shows on every arrival. */
  let speed = 0;
  for (const p of PANELS) {
    const d = f - p.at;
    if (d > -6 && d < 46) speed = Math.max(speed, Math.sin(Math.max(0, Math.min(1, (d + 6) / 52)) * Math.PI));
  }

  return (
    <div style={{
      position: "absolute", inset: 0,
      transform: `translateX(${groupX}px)`,
      filter: speed > 0.02 ? `blur(${speed * 7}px)` : undefined,
    }}>
      {PANELS.map((p, i) => {
        if (f < p.at - 10) return null;
        const e = easeIO((f - p.at) / 40);
        /* Later panels sit on top; earlier ones fall out of focus behind. */
        const behind = PANELS.length - 1 - i;
        let depth = 0;
        for (let k = i + 1; k < PANELS.length; k++) depth += easeIO((f - PANELS[k].at) / 40);

        const home = W / 2 - CARD / 2 - STEP * 0.5 + i * STEP;
        const x = home + (1 - e) * 300;
        return (
          <div key={p.label} style={{
            position: "absolute", left: x, top: CARD_CY - CARD / 2,
            width: CARD, zIndex: 10 + i,
            opacity: Math.min(1, e * 1.7) * (1 - depth * 0.16),
            filter: depth > 0.02 ? `blur(${depth * 5}px)` : undefined,
            transform: `scale(${1 - depth * 0.03})`,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 9, marginBottom: 11, paddingLeft: 4,
            }}>
              <svg width="22" height="18" viewBox="0 0 22 18">
                <path d="M1 3.5A2.5 2.5 0 013.5 1h4.2l2 2.2h8.8A2.5 2.5 0 0121 5.7v9.8A2.5 2.5 0 0118.5 18h-15A2.5 2.5 0 011 15.5z"
                  fill={p.tint} />
              </svg>
              <span style={{ fontFamily: R.fontSans, fontSize: 20, color: "#4a4a51" }}>
                {p.label}
              </span>
            </div>
            <div style={{
              width: CARD, height: CARD, borderRadius: 24, overflow: "hidden",
              boxShadow: "0 22px 54px rgba(20,22,34,0.14), 0 4px 12px rgba(20,22,34,0.08)",
            }}>
              <p.Pane f={f} at={p.at} />
            </div>
          </div>
        );
      })}
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
    <AbsoluteFill style={{ background: "#f8f8f9" }}>
      <Stack f={f} />
      <Bar f={f} />
      <Mark f={f} />

      <Audio
        src={staticFile("bg2.mp3")}
        startFrom={33 * 60}
        volume={(fr) =>
          0.18 * interpolate(fr, [0, 50, SEARCH_FRAMES - 60, SEARCH_FRAMES], [0, 1, 1, 0], clamp)}
      />

      <Sfx at={T.drop} file="sfx/magnetic.mp3" v={0.5} len={14} />
      <Sfx at={T.paint} file="sfx/granular.mp3" v={0.34} len={22} />
      {PANELS.map((p) => (
        <Sfx key={p.label} at={p.at} file="sfx/whoosh.mp3" v={0.42} len={36} />
      ))}
    </AbsoluteFill>
  );
};
