import React from "react";
import {
  AbsoluteFill, Sequence, Audio, staticFile,
  useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
/* The measured curves live in one place — the trailer opens with this same
   animation, and a second copy of a tracked table is a copy that quietly
   stops matching. See searchCurves.ts and MOTION-STUDY.md §9. */
import {
  clamp, easeIO, springy, track, PS, PV, buildArc, XS, XV_SRC,
} from "./searchCurves";

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

const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);


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



/* 1920/1280 = 1.5 horizontally, 1080/714 = 1.512 vertically. */
const M = buildArc(1.5, 1.512);

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
const XV = XV_SRC.map((v) => v * 1.5);

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

/**
 * One shot, placed by its TRANSIENT rather than by its first sample.
 *
 * `at` is the frame the hit should be *heard* on. `lead` is how far into the
 * file its peak actually sits — measured when the file was baked — so the
 * sequence starts that much earlier. Whooshes are the reason: `card.mp3`
 * swells for 19 frames before it peaks, so placed by its first sample it
 * lands a third of a second late, which reads as sound that does not belong
 * to the picture.
 *
 * The tail is faded, not cut. Sequence stops the audio dead at
 * durationInFrames, and chopping a decaying tail mid-sample is an audible
 * click — every cue in the previous set ended on one.
 */
const Sfx: React.FC<{ at: number; file: string; v: number; len?: number; lead?: number }> =
({ at, file, v, len = 20, lead = 0 }) => {
  const n    = Math.max(8, len);
  const fade = Math.max(2, Math.min(10, Math.round(n * 0.3)));
  return (
    <Sequence from={Math.max(0, at - lead)} durationInFrames={n}>
      <Audio
        src={staticFile(file)}
        volume={(f) => v * interpolate(f, [0, 1, n - fade, n], [0, 1, 1, 0], clamp)}
      />
    </Sequence>
  );
};

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

      {/*
        The cue sheet, taken off the source's own audio.
        ────────────────────────────────────────────────
        Its hits sit under a 128 BPM bed, so each event was measured by
        subtracting the median spectrum of a neighbouring music-only window.
        What that leaves is an energy profile with the SAME shape as the
        picture — loud through the rule and launch, then:

          rule +28.2   launch +26.7   rise +9.7   HANG +5.9
          fall +20.2   landing +21.3  typing +19.9
          collapse +34.3   card 2 +30.6   card 3 +32.3   (dB over the bed)

        Two things follow. The collapse and the card arrivals are the loudest
        moments in the whole reel, not the launch — so `v` follows that order
        rather than being flat as it was. And the HANG is nearly silent: the
        launch's tail is faded out by frame 113 and nothing else starts until
        137, so the float has the mix to itself exactly as it has the frame.

        The TIMBRE target from that same measurement is thrown away, though,
        and this is the part I got wrong twice. Subtracting the bed leaves
        residue, and the residue is tonal — the "SFX" I measured came back
        with flatness 0.02-0.09, which is a pure tone, and no whoosh or impact
        ever is. Those were the source's MUSIC leaking through. Matching them
        asked the library for tonal sounds and duly got them: an 8.4kHz scan
        tone under the typing and a 773Hz pitched boom on the collapse. Two
        beeps, both of which I requested. Ranking on envelope alone had
        already produced a pistol shot for the rule and a cash register for
        the launch — those features describe an envelope, not an identity.

        So every file here had to pass a gate instead: spectral flatness above
        0.32 (it must BE noise) and no pitch held across frames. Worth knowing
        that ZERO files in either pack named impact/hit/boom pass it — a bass
        hit is tuned by nature, which is exactly what put a tone on the
        collapse. Weight there comes from layered whooshes now, not a boom.

        And there is no typing cue at all. The +19.9dB I measured under the
        source's reveal is its music, not a sound effect.
      */}

      {/* Every whoosh is the house one — the same sfx/whoosh.mp3 the other six
          reels move on. Worth recording that it FAILS the tonality gate above
          (flatness 0.207, pitch-locked 72%) and sounds completely right
          anyway. The gate catches a scan tone and a pitched boom, which is
          what it was for, but it is a proxy: a resonant whoosh reads as
          "tonal" to it and as a whoosh to an ear. The ear is the authority
          and the gate is a way of narrowing the search, not deciding it.

          Its transient sits 10 frames in, so every cue leads by that. */}

      {/* The rule drawing out. */}
      <Sfx at={58}  file="sfx/whoosh.mp3" v={0.20} len={26} lead={10} />
      {/* Gather and launch — one move, and the source's second-loudest hit. */}
      <Sfx at={90}  file="sfx/whoosh.mp3" v={0.34} len={30} lead={10} />
      {/*  … the hang. Nothing here, on purpose. */}
      {/* The fall, crescendoing into the landing. */}
      <Sfx at={154} file="sfx/whoosh.mp3" v={0.22} len={28} lead={10} />
      <Sfx at={LANDED} file="sfx/land.mp3" v={0.26} len={14} lead={3} />
      {/* Pulled well down: the house whoosh is bass-heavy and this click
          is bright, so at the level that suited the old bright whooshes it
          became the loudest thing in the reel. The collapse has to be. */}
      {/*  … the address paints in silence. */}
      {/* Enter. The house click, four frames ahead of the collapse so the
          page going reads as the CONSEQUENCE of the keypress rather than as
          something that happened to coincide with it. Its transient sits 3
          frames into the file, hence the lead.

          v is well under the 0.24-0.42 the other reels use it at. Those
          reels cue it against bright material; here it sits among dark,
          bass-heavy whooshes, and at 0.38 it measured +21.9dB over the bed
          against the collapse's +12.4 — an accent turning into a stab. */}
      <Sfx at={T.collapse - 4} file="sfx/click.mp3" v={0.17} len={18} lead={3} />
      {/* The field becoming the first panel: the loudest moment in the reel,
          carried by two whooshes rather than an impact. */}
      <Sfx at={290} file="sfx/whoosh.mp3" v={0.46} len={34} lead={10} />
      <Sfx at={296} file="sfx/whoosh.mp3" v={0.24} len={44} lead={10} />
      {/* Each later panel, peaking ON arrival rather than after it. */}
      {PANELS.slice(1).map((p) => (
        <Sfx key={p.label} at={p.at} file="sfx/whoosh.mp3" v={0.38} len={34} lead={10} />
      ))}
      {/* Three becoming one. */}
      <Sfx at={T.converge + 40} file="sfx/whoosh.mp3" v={0.50} len={56} lead={10} />
      <Sfx at={T.converge + T.convergeFor} file="sfx/whoosh.mp3" v={0.26} len={30} lead={10} />
    </AbsoluteFill>
  );
};
