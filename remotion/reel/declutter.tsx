/**
 * declutter.tsx — the "so many apps" problem, and its resolution.
 *
 * Built to the supplied reference: each fragment is a real, recognisable app
 * card (floating brand tab + genuine content), not an abstract window with a
 * coloured accent bar. Hand-drawn arrows wander between them. Then they all
 * converge into one TafsirLab window.
 *
 * Type treatment follows the reference too: a letter-spaced grey eyebrow, a
 * serif headline, and an italic serif accent line.
 */
import React from "react";
import { FONT } from "./theme";
import { P } from "./app";

const SERIF = '"EB Garamond", Georgia, serif';

/* ── Brand marks, drawn (no external logo assets) ─────────────────────── */

const Mark: React.FC<{ kind: string }> = ({ kind }) => {
  const box = (bg: string, children: React.ReactNode, radius = 7) => (
    <span style={{
      width: 26, height: 26, borderRadius: radius, background: bg, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1,
    }}>{children}</span>
  );
  switch (kind) {
    case "notes":  return box("#FDD835", <span style={{
      width: 16, height: 13, background: "#fff", borderRadius: 2,
      boxShadow: "inset 0 4px 0 #FFF3B0",
    }} />);
    case "quran":  return box("#1E8E4E", <span style={{ fontSize: 13 }}>۩</span>);
    case "search": return box("#fff", <span style={{
      fontFamily: FONT.sans, fontWeight: 700, fontSize: 16,
      background: "linear-gradient(90deg,#4285F4,#EA4335,#FBBC05,#34A853)",
      WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
    }}>G</span>);
    case "pdf":    return box("#E5493A", <span style={{ fontSize: 9, letterSpacing: "-0.02em" }}>PDF</span>);
    case "onenote":return box("#7719AA", <span style={{ fontSize: 14 }}>N</span>);
    case "notion": return box("#111", <span style={{ fontSize: 15, fontFamily: SERIF }}>N</span>);
    default:       return box("#999", "");
  }
};

const Line: React.FC<{ w: string; dim?: boolean }> = ({ w, dim }) => (
  <div style={{ height: 6, borderRadius: 4, background: dim ? "#EFEDE9" : "#E7E4DF", width: w }} />
);

/* ── One fragment card ───────────────────────────────────────────────── */

export const AppCard: React.FC<{ kind: string; label: string; w?: number }> = ({ kind, label, w = 300 }) => {
  const card = (children: React.ReactNode) => (
    <div style={{ width: w, position: "relative", fontFamily: FONT.sans }}>
      {/* floating brand tab, overlapping the card's top edge */}
      <div style={{
        position: "absolute", left: 22, top: -18, zIndex: 2,
        display: "flex", alignItems: "center", gap: 9,
        background: "#fff", borderRadius: 12, padding: "7px 14px 7px 8px",
        boxShadow: "0 6px 18px rgba(20,20,20,0.07)",
      }}>
        <Mark kind={kind} />
        <span style={{ fontSize: 14, fontWeight: 600, color: P.ink }}>{label}</span>
      </div>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "34px 22px 20px",
        boxShadow: "0 14px 40px rgba(20,20,20,0.07), 0 2px 8px rgba(20,20,20,0.04)",
      }}>{children}</div>
    </div>
  );

  if (kind === "notes") return card(
    <>
      <div style={{ fontSize: 17, fontWeight: 700, color: P.ink, marginBottom: 12 }}>Reflection on Ayah</div>
      {["Think", "Reflect", "Write…"].map((t) => (
        <div key={t} style={{ fontSize: 14.5, color: P.ink2, marginBottom: 7 }}>• {t}</div>
      ))}
    </>
  );
  if (kind === "quran") return card(
    <div style={{ fontFamily: SERIF, direction: "rtl", textAlign: "right", lineHeight: 2.1 }}>
      {["بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ", "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ", "ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"].map((t, i) => (
        <div key={i} style={{ fontSize: 16, color: P.ink, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: P.grey2 }}>۝{i + 1} </span>{t}
        </div>
      ))}
    </div>
  );
  if (kind === "search") return card(
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 9, border: `1px solid ${P.line2}`,
        borderRadius: 999, padding: "8px 13px", marginBottom: 12,
      }}>
        <span style={{ color: P.grey2, fontSize: 13 }}>⌕</span>
        <span style={{ fontSize: 14, color: P.ink2 }}>tafsir of al-fatiha</span>
      </div>
      <div style={{ display: "flex", gap: 14, marginBottom: 14, fontSize: 12.5 }}>
        {["All", "Images", "Videos", "News", "Books"].map((t, i) => (
          <span key={t} style={{
            color: i === 0 ? P.ink : P.grey, fontWeight: i === 0 ? 600 : 500,
            borderBottom: i === 0 ? `2px solid ${P.ink}` : "none", paddingBottom: 3,
          }}>{t}</span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 6, borderRadius: 4, background: "#C9CFF0", width: "58%" }} />
        <Line w="88%" dim /><Line w="72%" dim />
      </div>
    </>
  );
  if (kind === "pdf") return card(
    <>
      <div style={{ fontSize: 17, fontWeight: 700, color: P.ink, marginBottom: 6 }}>Tafsir Ibn Kathir</div>
      <div style={{ fontSize: 14, color: P.grey, marginBottom: 10 }}>Al-Fatihah</div>
      <div style={{ fontSize: 14.5, color: P.ink2, marginBottom: 12 }}>1. Introduction</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {["92%", "84%", "88%", "66%"].map((w, i) => <Line key={i} w={w} dim />)}
      </div>
    </>
  );
  if (kind === "onenote") return card(
    <>
      <div style={{ fontSize: 17, fontWeight: 700, color: P.ink, marginBottom: 12 }}>Al-Fatihah – Study</div>
      {["Word meanings", "Themes", "Reflections", "Connections"].map((t) => (
        <div key={t} style={{ fontSize: 14.5, color: P.ink2, marginBottom: 7 }}>• {t}</div>
      ))}
    </>
  );
  if (kind === "notion") return card(
    <>
      <div style={{ fontSize: 17, fontWeight: 700, color: P.ink, marginBottom: 12 }}>Qur’an Study Hub</div>
      {["Surahs", "Themes", "Notes", "Resources"].map((t) => (
        <div key={t} style={{ fontSize: 14.5, color: P.grey, marginBottom: 8 }}>
          <span style={{ color: P.grey2, marginRight: 8 }}>›</span>{t}
        </div>
      ))}
    </>
  );
  return card(null);
};

/* ── Hand-drawn wandering arrows between the fragments ───────────────── */

export const ScatterArrows: React.FC<{ draw: number }> = ({ draw }) => {
  const A = [
    { d: "M40 92 C 96 26, 210 20, 258 74", len: 260, tip: "M258 74 L 236 62 M258 74 L 242 88" },
    { d: "M470 40 C 520 96, 512 168, 452 200", len: 250, tip: "M452 200 L 474 194 M452 200 L 462 178" },
    { d: "M96 300 C 40 246, 46 176, 110 152", len: 230, tip: "M110 152 L 88 158 M110 152 L 98 174" },
    { d: "M300 366 C 372 402, 470 396, 520 350", len: 270, tip: "M520 350 L 498 356 M520 350 L 508 334" },
  ];
  const seg = (i: number) => Math.max(0, Math.min(1, draw * A.length - i));
  return (
    <svg width={620} height={430} style={{ overflow: "visible" }}>
      {A.map((a, i) => (
        <g key={i} stroke="#D9D5CE" strokeWidth={2.2} fill="none" strokeLinecap="round">
          <path d={a.d} strokeDasharray={a.len} strokeDashoffset={a.len * (1 - seg(i))} />
          <path d={a.tip} strokeDasharray={40} strokeDashoffset={40 * (1 - Math.max(0, seg(i) * 1.2 - 0.2))} />
        </g>
      ))}
    </svg>
  );
};

/* ── Headline block (eyebrow / serif / italic serif) ─────────────────── */

export const Headline: React.FC<{
  eyebrow: string; line1: string; line2: string; o: number; o2?: number;
}> = ({ eyebrow, line1, line2, o, o2 = o }) => (
  <div style={{ width: 1000, textAlign: "center", fontFamily: SERIF }}>
    <div style={{
      fontFamily: FONT.sans, fontSize: 25, letterSpacing: "0.18em",
      textTransform: "uppercase", color: P.grey2, marginBottom: 26, opacity: o,
    }}>{eyebrow}</div>
    <div style={{
      fontSize: 96, lineHeight: 1.1, color: P.ink, opacity: o,
      transform: `translateY(${(1 - o) * 14}px)`,
      whiteSpace: "nowrap",   /* an ellipsis must never wrap to its own line */
    }}>{line1}</div>
    <div style={{
      fontSize: 84, lineHeight: 1.18, fontStyle: "italic", color: "#A9A296",
      marginTop: 8, opacity: o2, transform: `translateY(${(1 - o2) * 14}px)`,
      whiteSpace: "nowrap",
    }}>{line2}</div>
  </div>
);

/** The small verdict pill under the scatter. */
export const VerdictPill: React.FC<{ o: number }> = ({ o }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 16,
    background: "#F3F1ED", borderRadius: 999, padding: "20px 38px",
    fontFamily: SERIF, fontSize: 34, color: P.ink, opacity: o,
    transform: `translateY(${(1 - o) * 10}px)`, whiteSpace: "nowrap",
  }}>
    <span style={{ fontSize: 28, opacity: 0.55 }}>☹</span>
    So many apps. <span style={{ fontStyle: "italic", color: "#A9A296" }}>So little flow.</span>
  </div>
);
