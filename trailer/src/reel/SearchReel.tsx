import React from "react";
import {
  AbsoluteFill, Sequence, Audio, staticFile,
  useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import { typed } from "./parts";

/* ── Search, then the panels ───────────────────────────────────────────────
   Rebuilt beat for beat from the reference: a browser bar resolves out of a
   push-in, a pointer drops onto it, the field takes focus and empties, an
   address is typed, the bar blurs away, and then labelled panels arrive one
   at a time from the right — each pushing the strip left so the oldest slides
   out of frame.

   The panels are the change: instead of someone else's edits, they are the
   editor typing, the canvas being written on by hand, and the mutoon library
   running past.                                                             */

export const SEARCH_FRAMES = 710;   // 11.8s @ 60fps
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
/** Front-loaded with a settle — how a panel lands when it is thrown in. */
const back = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return 1 + 2.1 * Math.pow(x - 1, 3) + 1.1 * Math.pow(x - 1, 2);
};

const URL = "tafsir-lab.com";

export const T = {
  barIn: 0, bloom: 26,          // the page's loading bar
  dropFrom: 54, dropTo: 96,     // the pointer descends
  click: 96, focus: 106,
  type: 118, cps: 0.13,
  barOut: 236,

  card1: 250,
  card2: 366,
  card3: 482,
} as const;
const TYPE_END = T.type + Math.ceil(URL.length / T.cps);

/* Panel geometry. Two fit the frame; the third pushes the first out, which is
   what the reference does and why the strip reads as a strip. */
const CARD = { w: 520, h: 1150, gap: 26, cy: 1010 };
const STEP = CARD.w + CARD.gap;

/* ── The browser bar ──────────────────────────────────────────────────────*/

const Chevron: React.FC<{ o?: number }> = ({ o = 1 }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3c3c43"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: o }}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
const Reader: React.FC<{ o: number }> = ({ o }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" stroke="#3c3c43" strokeWidth="2"
    strokeLinecap="round" style={{ opacity: o }}>
    <path d="M4 7h16M4 12h11M4 17h16" />
  </svg>
);
const Reload: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3c3c43"
    strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 5v6h-6" />
  </svg>
);
const Tabs: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3c3c43"
    strokeWidth="2" strokeLinejoin="round">
    <rect x="8" y="4" width="12" height="12" rx="2.5" />
    <path d="M16 20H6a2 2 0 01-2-2V8" strokeLinecap="round" />
  </svg>
);

const Bar: React.FC<{ f: number }> = ({ f }) => {
  /* The bar arrives already mid-push-in, the way a recording that has been
     zoomed into does. */
  const zoom = interpolate(f, [0, 40], [0.82, 1], clamp);
  const soft = interpolate(f, [0, 22], [10, 0], clamp);
  const out = interpolate(f, [T.barOut, T.barOut + 22], [1, 0], clamp);
  const blurOut = interpolate(f, [T.barOut, T.barOut + 22], [0, 16], clamp);
  if (out <= 0) return null;

  const focused = f >= T.focus;
  const text = f >= T.type ? typed(URL, f, T.type, T.cps) : "";
  /* Loading bar: a colour wash that runs across and then settles to a rule. */
  const load = interpolate(f, [T.bloom, T.bloom + 30], [0, 1], clamp);
  const settle = interpolate(f, [T.bloom + 34, T.bloom + 52], [0, 1], clamp);

  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: 900,
      display: "flex", flexDirection: "column", alignItems: "center",
      opacity: out, filter: `blur(${soft + blurOut}px)`,
      transform: `scale(${zoom})`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 24,
        padding: "0 8px",
      }}>
        <Chevron />
        <Reader o={focused ? 0 : 1} />
        <div style={{
          minWidth: focused ? 620 : 400, height: 82, borderRadius: 41,
          background: focused ? "#ffffff" : "#efeff2",
          boxShadow: focused
            ? "0 0 0 4px rgba(90,140,255,0.28), 0 2px 10px rgba(0,0,0,0.10)"
            : "none",
          display: "flex", alignItems: "center", justifyContent: focused ? "flex-start" : "center",
          padding: focused ? "0 34px" : 0, boxSizing: "border-box",
          fontFamily: R.fontSans, fontSize: 33,
          color: focused ? "#111" : "#8a8a90",
          transition: "none",
        }}>
          {focused ? (
            <>
              {text}
              <span style={{
                display: "inline-block", width: 3, height: 37, background: "#111",
                marginLeft: 2, opacity: Math.floor(f / 16) % 2 === 0 ? 1 : 0,
              }} />
            </>
          ) : "search..."}
        </div>
        <Reload /><Tabs />
      </div>

      {/* The page's own loading bar, under the toolbar. */}
      {!focused && (
        <div style={{
          marginTop: 16, width: 400, height: 7, borderRadius: 4,
          overflow: "hidden", background: "transparent",
        }}>
          <div style={{
            width: `${load * 100}%`, height: "100%", borderRadius: 3,
            background: settle > 0.5
              ? "#1c1c1e"
              : "linear-gradient(90deg,#5ac8fa,#34c759,#ffcc00,#ff375f,#af52de)",
          }} />
        </div>
      )}
    </div>
  );
};

/** The pointer, dropping in from off the top of the frame. */
const Pointer: React.FC<{ f: number }> = ({ f }) => {
  const p = ease((f - T.dropFrom) / (T.dropTo - T.dropFrom));
  const gone = interpolate(f, [T.click + 12, T.click + 30], [1, 0], clamp);
  if (f < T.dropFrom || gone <= 0) return null;
  const y = interpolate(p, [0, 1], [520, 924]);
  const tap = interpolate(f, [T.click, T.click + 14], [1, 0], clamp);
  return (
    <div style={{
      position: "absolute", left: 540 - 19, top: y, opacity: gone,
    }}>
      {tap > 0 && (
        <div style={{
          position: "absolute", left: -22, top: -22, width: 82, height: 82,
          borderRadius: "50%", border: "3px solid rgba(20,20,25,0.35)",
          transform: `scale(${0.4 + (1 - tap) * 1.1})`, opacity: tap,
        }} />
      )}
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#16161a" }} />
    </div>
  );
};

/* ── Panel contents ───────────────────────────────────────────────────────*/

const NOTE = "The sūrah is seven verses, and it is named as-Sabʿ al-Mathānī.";

/** The editor, writing itself. */
const EditorPane: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const s = at + 14;
  const body = typed(NOTE, f, s + 16, 0.44);
  const chip = (t: string, i: number) => {
    const e = ease((f - (s + 232 + i * 12)) / 20);
    return (
      <span key={t} style={{
        fontFamily: R.fontSans, fontSize: 15, color: "#255940",
        background: "rgba(68,128,97,0.11)", padding: "6px 13px", borderRadius: 999,
        opacity: e, transform: `translateY(${(1 - e) * 8}px)`, display: "inline-block",
      }}>{t}</span>
    );
  };
  return (
    <div style={{ padding: 34, height: "100%", boxSizing: "border-box", background: "#fefdfc" }}>
      <div style={{
        fontFamily: R.fontSerif, fontSize: 32, fontWeight: 700, color: "#1e1a14",
        opacity: ease((f - s) / 18),
      }}>As-Sabʿ al-Mathānī</div>
      <div style={{
        fontFamily: R.fontSans, fontSize: 15, color: "#908d88", marginTop: 8,
        opacity: ease((f - s - 6) / 18),
      }}>Study note</div>
      <div style={{
        fontFamily: R.fontSans, fontSize: 20, lineHeight: 1.65, color: "#46423b",
        marginTop: 22, minHeight: 168,
      }}>
        {body}
        <span style={{
          display: "inline-block", width: 2, height: 21, background: "#1e1a14",
          marginLeft: 2, verticalAlign: "text-bottom",
          opacity: Math.floor(f / 16) % 2 === 0 ? 1 : 0,
        }} />
      </div>

      {/* The āyah the note is about, pulled in once the sentence lands. */}
      <div style={{
        border: "1px solid rgba(30,26,20,0.09)", borderRadius: 10,
        padding: "12px 14px 14px", marginTop: 6,
        opacity: ease((f - s - 150) / 24),
        transform: `translateY(${(1 - ease((f - s - 150) / 24)) * 12}px)`,
      }}>
        <div style={{
          fontFamily: R.fontMono, fontSize: 12, letterSpacing: "0.06em",
          color: "#908d88", marginBottom: 8,
        }}>AL-ḤIJR 15:87</div>
        <div dir="rtl" style={{
          fontFamily: R.fontArabic, fontSize: 25, lineHeight: 1.95,
          color: "#1e1a14", textAlign: "right",
        }}>وَلَقَدْ آتَيْنَاكَ سَبْعًا مِّنَ الْمَثَانِي</div>
        <div style={{
          fontFamily: R.fontSans, fontSize: 14, lineHeight: 1.5, color: "#46423b",
          paddingTop: 9, marginTop: 7, borderTop: "1px solid rgba(30,26,20,0.09)",
        }}>And We have given you seven of the oft-repeated.</div>
      </div>

      <div style={{
        fontFamily: R.fontSans, fontSize: 19, lineHeight: 1.65, color: "#46423b",
        marginTop: 22,
        opacity: ease((f - s - 196) / 26),
      }}>
        Al-Baghawī: it is seven verses by consensus, and Mathānī because it is
        repeated in every rakʿah.
      </div>
      <div style={{
        fontFamily: R.fontSans, fontSize: 15, color: "#908d88", marginTop: 12,
        opacity: ease((f - s - 214) / 26),
      }}>— Tafsīr al-Baghawī, 1:37</div>

      <div style={{ display: "flex", gap: 9, marginTop: 22 }}>
        {["Al-Fātiḥah 1:1", "Al-Ḥijr 15:87"].map(chip)}
      </div>
    </div>
  );
};

/**
 * The canvas, written on by hand.
 *
 * Arabic is cursive already, so sweeping a mask across it right to left with a
 * nib at the leading edge reads as the line being written rather than as text
 * fading up.
 */
const CanvasPane: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const s = at + 16;
  const w = (from: number, over: number) =>
    interpolate(f, [s + from, s + from + over], [0, 1], clamp);
  const line1 = w(0, 52);      // the āyah
  const line2 = w(58, 44);     // the note under it
  const mark  = w(108, 30);    // the marker stroke
  const PAD = 32;

  const Written: React.FC<{
    p: number; y: number; size: number; text: string; col: string; font: string;
  }> = ({ p, y, size, text, col, font }) => (
    <div style={{ position: "absolute", left: PAD, right: PAD, top: y, height: size * 1.7 }}>
      <div dir="rtl" style={{
        fontFamily: font, fontSize: size, color: col, textAlign: "right",
        whiteSpace: "nowrap", lineHeight: 1.7,
        /* Reveal from the right, because that is the direction it is written. */
        clipPath: `inset(0 0 0 ${(1 - p) * 100}%)`,
      }}>{text}</div>
      {p > 0.02 && p < 0.99 && (
        <div style={{
          position: "absolute", top: size * 0.35, left: `${(1 - p) * 100}%`,
          width: 9, height: 9, borderRadius: "50%", background: "#1e1a14",
        }} />
      )}
    </div>
  );

  return (
    <div style={{
      padding: 0, height: "100%", boxSizing: "border-box", position: "relative",
      background: "#fdfcf9",
      backgroundImage:
        "linear-gradient(rgba(30,26,20,0.055) 1px, transparent 1px)," +
        "linear-gradient(90deg, rgba(30,26,20,0.055) 1px, transparent 1px)",
      backgroundSize: "44px 44px",
    }}>
      <Written p={line1} y={92}  size={44} col="#1e1a14"
        text="اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ" font={R.fontArabic} />
      {/* The marker, laid over the phrase after it is written. */}
      <div style={{
        position: "absolute", right: PAD, top: 136, height: 34,
        width: `${mark * 70}%`, background: "rgba(232,194,90,0.55)", borderRadius: 3,
      }} />
      <Written p={line2} y={268} size={33} col="#2563eb"
        text="الصراط المستقيم هو الإسلام" font={R.fontArabic} />
      <div style={{
        position: "absolute", left: PAD, right: PAD, top: 390,
        height: 4, borderRadius: 2, background: "#2563eb",
        transform: `scaleX(${w(150, 26)})`, transformOrigin: "right",
      }} />
      <div style={{
        position: "absolute", left: PAD, top: 440,
        fontFamily: R.fontSans, fontSize: 20, color: "#dc2626",
        opacity: w(176, 24),
      }}>the pivot of the sūrah</div>

      <Written p={w(196, 46)} y={540} size={38} col="#1e1a14"
        text="صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ" font={R.fontArabic} />
      <div style={{
        position: "absolute", right: PAD, top: 660, height: 30,
        width: `${w(250, 26) * 52}%`, background: "rgba(134,239,172,0.5)", borderRadius: 3,
      }} />
      <Written p={w(272, 40)} y={716} size={29} col="#7c3aed"
        text="النعمة هي الهداية" font={R.fontArabic} />
      {/* An arrow, drawn last, tying the note back to the phrase. */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox={`0 0 ${CARD.w} ${CARD.h}`} fill="none">
        <path d={`M${PAD + 24} 902 Q190 836 330 792`}
          stroke="#dc2626" strokeWidth={7} strokeLinecap="round"
          strokeDasharray={320} strokeDashoffset={320 * (1 - w(316, 34))} />
      </svg>
      <div style={{
        position: "absolute", left: PAD, top: 908,
        fontFamily: R.fontSans, fontSize: 19, color: "#dc2626",
        opacity: w(352, 24),
      }}>and the answer to the duʿāʾ</div>
    </div>
  );
};

const BOOKS = [
  { ar: "الأصول الثلاثة",     en: "Three Principles",  c: "#6b7f9e", cat: "ʿAQĪDAH" },
  { ar: "العقيدة الواسطية",   en: "Al-Wāsiṭiyyah",     c: "#6b7f9e", cat: "ʿAQĪDAH" },
  { ar: "الأربعون النووية",   en: "Forty Ḥadīth",      c: "#8a7a5e", cat: "ḤADĪTH" },
  { ar: "عمدة الأحكام",       en: "ʿUmdat al-Aḥkām",   c: "#8a7a5e", cat: "ḤADĪTH" },
  { ar: "المنظومة البيقونية", en: "Al-Bayqūniyyah",    c: "#7d6b86", cat: "MUṢṬALAḤ" },
  { ar: "الورقات",            en: "Al-Waraqāt",        c: "#7d6b86", cat: "UṢŪL" },
  { ar: "الآجرومية",          en: "Al-Ājurrūmiyyah",   c: "#9e6b6b", cat: "NAḤW" },
  { ar: "كتاب التوحيد",       en: "Kitāb at-Tawḥīd",   c: "#9e6b6b", cat: "TAWḤĪD" },
];

/** The mutoon library, running past. */
const LibraryPane: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const s = at + 14;
  const BW = 156, BG = 18;
  const total = BOOKS.length * (BW + BG);
  const scroll = interpolate(f, [s + 24, s + 176], [0, total - (CARD.w - 46)], clamp);
  return (
    <div style={{
      height: "100%", boxSizing: "border-box", background: "#fefdfc",
      padding: "28px 0 0", overflow: "hidden", position: "relative",
    }}>
      <div style={{
        fontFamily: R.fontSans, fontSize: 15, color: "#908d88", padding: "0 30px",
        letterSpacing: "0.1em", textTransform: "uppercase",
        opacity: ease((f - s) / 18),
      }}>Mutūn · {BOOKS.length}</div>
      <div style={{
        display: "flex", gap: BG, alignItems: "center", paddingLeft: 30,
        height: CARD.h - 120,
        transform: `translateX(${-scroll}px)`,
      }}>
        {BOOKS.map((b, i) => {
          const e = ease((f - (s + 10 + i * 6)) / 22);
          return (
            <div key={b.en} style={{
              width: BW, flexShrink: 0, height: 640, borderRadius: 9,
              background: "#fff", border: "1px solid rgba(30,26,20,0.10)",
              boxShadow: "0 2px 10px rgba(30,26,20,0.07)",
              overflow: "hidden", display: "flex", flexDirection: "column",
              opacity: e, transform: `translateY(${(1 - e) * 22}px)`,
            }}>
              <div style={{ height: 9, background: b.c }} />
              <div style={{
                flex: 1, padding: "26px 13px", display: "flex",
                flexDirection: "column", alignItems: "center", gap: 12,
              }}>
                <div dir="rtl" style={{
                  fontFamily: R.fontArabic, fontSize: 25, lineHeight: 1.5,
                  color: "#1e1a14", textAlign: "center",
                }}>{b.ar}</div>
                <div style={{
                  width: 32, height: 1, background: "rgba(30,26,20,0.12)",
                }} />
                <div style={{
                  fontFamily: R.fontSans, fontSize: 14, lineHeight: 1.3,
                  color: "#73706a", textAlign: "center",
                }}>{b.en}</div>
                <div style={{
                  marginTop: "auto", fontFamily: R.fontSans, fontSize: 11,
                  letterSpacing: "0.09em", color: b.c, textAlign: "center",
                }}>{b.cat}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── The strip ────────────────────────────────────────────────────────────*/

const PANELS = [
  { at: T.card1, label: "editor",  tint: "#4a8cf0", Pane: EditorPane },
  { at: T.card2, label: "canvas",  tint: "#e0a44b", Pane: CanvasPane },
  { at: T.card3, label: "mutoon",  tint: "#6bb187", Pane: LibraryPane },
] as const;

const Strip: React.FC<{ f: number }> = ({ f }) => {
  /* Each arrival shifts the whole strip one panel to the left, so the newest
     lands centre-right and the oldest walks out of frame. */
  let shift = 0;
  for (let i = 1; i < PANELS.length; i++) {
    shift += back((f - PANELS[i].at) / 42) * (STEP / 2 + (i === 2 ? STEP / 2 : 0));
  }

  return (
    <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
      {PANELS.map((p, i) => {
        const e = back((f - p.at) / 42);
        if (f < p.at - 6) return null;
        /* Panels are laid out left to right from the centre, then the whole
           run is translated by the accumulated shift. */
        const home = 540 - CARD.w / 2 + i * STEP;
        const x = home + (1 - e) * 520 - shift;
        return (
          <div key={p.label} style={{
            position: "absolute", left: x, top: CARD.cy - CARD.h / 2,
            width: CARD.w, opacity: Math.min(1, e * 1.6),
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 9, marginBottom: 12,
              paddingLeft: 4,
            }}>
              <span style={{
                width: 17, height: 14, borderRadius: 3, background: p.tint,
                display: "inline-block",
              }} />
              <span style={{
                fontFamily: R.fontSans, fontSize: 19, color: "#5c5c62",
              }}>{p.label}</span>
            </div>
            <div style={{
              width: CARD.w, height: CARD.h, borderRadius: 22, overflow: "hidden",
              boxShadow: "0 18px 44px rgba(20,20,30,0.13), 0 3px 10px rgba(20,20,30,0.07)",
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
    <AbsoluteFill style={{ background: "#f7f7f8" }}>
      <Strip f={f} />
      <Bar f={f} />
      <Pointer f={f} />

      <Audio
        src={staticFile("bg2.mp3")}
        startFrom={33 * 60}
        volume={(fr) =>
          0.18 * interpolate(fr, [0, 50, SEARCH_FRAMES - 60, SEARCH_FRAMES], [0, 1, 1, 0], clamp)}
      />

      <Sfx at={T.click} file="sfx/magnetic.mp3" v={0.55} len={14} />
      <Sequence from={T.type} durationInFrames={TYPE_END - T.type + 10}>
        <Audio src={staticFile("sfx/typing.mp3")} volume={0.34} />
      </Sequence>
      {PANELS.map((p) => (
        <Sfx key={p.label} at={p.at} file="sfx/whoosh.mp3" v={0.4} len={34} />
      ))}
    </AbsoluteFill>
  );
};
