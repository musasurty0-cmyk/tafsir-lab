/**
 * ui.tsx — TafsirLab's interface, rebuilt as live React.
 *
 * Deliberately NOT screenshots. A PNG cannot be zoomed 14x, cannot be typed
 * into, cannot have one screen morph into another, and never matches the
 * room's lighting. Rebuilding the UI is what lets the camera push through it.
 *
 * Qur'anic text comes from data/verses.json, fetched from the same source the
 * product uses (api.quran.com v4, text_uthmani) — never typed from memory.
 */
import React from "react";
import { C, FONT } from "./theme";
import versesRaw from "./data/verses.json";

export interface Word { t: string; tr: string }
export interface Verse { key: string; text: string; words: Word[]; translation: string }
export const VERSES = versesRaw as Verse[];

/** The word the whole trailer turns on: ٱلْكِتَـٰبُ (2:2, word index 1). */
export const HERO_VERSE = 1;
export const HERO_WORD = 1;

/* ── Mushaf page ───────────────────────────────────────────────────────── */

export const MushafPage: React.FC<{
  width?: number;
  /** 0→1 reveal of the amber highlight under the hero word */
  highlight?: number;
  /** 0→1 wash that dims everything except the hero word */
  focus?: number;
  showHeader?: boolean;
}> = ({ width = 900, highlight = 0, focus = 0, showHeader = true }) => {
  return (
    <div
      style={{
        width,
        background: C.paper,
        border: `1px solid ${C.hair}`,
        borderRadius: 10,
        boxShadow: C.shadowSoft,
        padding: "64px 56px 72px",
        fontFamily: FONT.ar,
        direction: "rtl",
        textAlign: "center",
      }}
    >
      {showHeader && (
        <>
          <div style={{
            fontFamily: FONT.sans, fontSize: 17, letterSpacing: "0.18em",
            color: C.grey2, textTransform: "uppercase", direction: "ltr",
            marginBottom: 26,
          }}>
            Al-Baqarah
          </div>
          <div style={{ height: 1, background: C.hair, margin: "0 0 34px" }} />
          <div style={{ fontSize: 44, color: C.ink, marginBottom: 30, lineHeight: 1.9 }}>
            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
          </div>
        </>
      )}

      {VERSES.map((v, vi) => (
        <div
          key={v.key}
          style={{
            fontSize: 40,
            lineHeight: 2.35,
            color: C.ink,
            marginBottom: 10,
            // The focus wash dims every line except the one holding the word.
            opacity: 1 - focus * (vi === HERO_VERSE ? 0 : 0.82),
            transition: "none",
          }}
        >
          {v.words.map((w, wi) => {
            const isHero = vi === HERO_VERSE && wi === HERO_WORD;
            return (
              <span
                key={wi}
                style={{
                  position: "relative",
                  padding: "0 4px",
                  opacity: isHero ? 1 : 1 - focus * 0.35,
                }}
              >
                {isHero && highlight > 0 && (
                  // Highlighter ink is laid DOWN under the glyphs, left→right,
                  // the way a real marker behaves — never a box fading in.
                  <span
                    style={{
                      position: "absolute",
                      left: 0, right: 0,
                      bottom: 2, top: 6,
                      background: C.amber,
                      borderRadius: 3,
                      transformOrigin: "right center",
                      transform: `scaleX(${highlight})`,
                      zIndex: 0,
                    }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>{w.t}</span>
              </span>
            );
          })}
          <span style={{
            fontFamily: FONT.sans, fontSize: 20, color: C.grey2,
            margin: "0 10px", verticalAlign: "middle",
          }}>
            {"۝"}{v.key.split(":")[1]}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── Note container — arrives ALREADY rich ────────────────────────────────
   Watching text type is not engaging, so the container unfolds with its
   contents already present: handwriting, a coloured highlight, a linked ayah
   and a tafsir snippet. Depth is communicated instantly.                   */

export const NoteCard: React.FC<{
  width?: number;
  /** 0→1 unfold from the word's edge */
  unfold?: number;
  /** 0→1 reveal of the interior content, staggered by the caller */
  content?: number;
  inkDraw?: number;
}> = ({ width = 560, unfold = 1, content = 1, inkDraw = 0 }) => {
  const row = (i: number) => Math.max(0, Math.min(1, content * 4 - i));
  return (
    <div
      style={{
        width,
        background: C.paper,
        border: `1px solid ${C.hair2}`,
        borderRadius: 12,
        boxShadow: C.shadowLift,
        padding: "30px 32px 34px",
        fontFamily: FONT.sans,
        transformOrigin: "top center",
        transform: `scaleY(${0.12 + 0.88 * unfold}) scaleX(${0.88 + 0.12 * unfold})`,
        opacity: Math.min(1, unfold * 2.2),
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 15, letterSpacing: "0.14em", textTransform: "uppercase",
        color: C.green, fontWeight: 650, marginBottom: 18,
        opacity: row(0),
      }}>
        <span style={{ width: 7, height: 7, borderRadius: 9, background: C.green }} />
        Word note · 2:2
      </div>

      <div style={{
        fontSize: 27, lineHeight: 1.5, color: C.ink, marginBottom: 16,
        opacity: row(1), transform: `translateY(${(1 - row(1)) * 8}px)`,
      }}>
        <span style={{
          fontFamily: FONT.ar, fontSize: 32, background: C.amber,
          padding: "1px 7px", borderRadius: 4,
        }}>ٱلْكِتَـٰبُ</span>
        {" — "}the Book, definite. Not "a" book.
      </div>

      {/* Linked ayah — a real embed, not a quote */}
      <div style={{
        border: `1px solid ${C.hair}`, borderLeft: `3px solid ${C.green}`,
        borderRadius: 6, padding: "14px 16px", marginBottom: 16,
        background: "#FCFCFB",
        opacity: row(2), transform: `translateY(${(1 - row(2)) * 8}px)`,
      }}>
        <div style={{ fontSize: 13, letterSpacing: "0.1em", color: C.grey2, marginBottom: 7 }}>
          LINKED · 2:286
        </div>
        <div style={{ fontFamily: FONT.ar, fontSize: 26, color: C.ink2, direction: "rtl", lineHeight: 1.8 }}>
          لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا
        </div>
      </div>

      {/* Tafsir snippet */}
      <div style={{
        fontSize: 19, lineHeight: 1.55, color: C.grey,
        opacity: row(3), transform: `translateY(${(1 - row(3)) * 8}px)`,
      }}>
        <span style={{ color: C.ink2, fontWeight: 600 }}>Ibn Kathīr — </span>
        guidance is affirmed for those who already fear their Lord.
      </div>

      {/* Handwriting, drawn along its real path */}
      <svg width={width - 64} height={54} style={{ display: "block", marginTop: 14 }}>
        <path
          d="M6 34 C 40 8, 74 8, 104 30 S 168 56, 202 28 C 232 4, 268 10, 292 34"
          fill="none" stroke={C.amberInk} strokeWidth={3.4} strokeLinecap="round"
          strokeDasharray={340}
          strokeDashoffset={340 * (1 - inkDraw)}
          opacity={0.85}
        />
      </svg>
    </div>
  );
};

/* ── Tafsir panel ──────────────────────────────────────────────────────── */

export const TafsirPanel: React.FC<{ width?: number; source?: number; reveal?: number }> = ({
  width = 460, source = 0, reveal = 1,
}) => {
  const sources = [
    { name: "Ibn Kathīr", lang: "English", dir: "ltr" as const,
      body: "“That is the Book” — meaning the Qur’an. Allah affirms it is free of any doubt, revealed from Him." },
    { name: "Al-Saʿdī", lang: "العربية", dir: "rtl" as const,
      body: "أي: هذا الكتاب العظيم الذي لا شك فيه ولا ريب، هدى للمتقين." },
  ];
  const active = sources[Math.min(source, sources.length - 1)];
  return (
    <div style={{
      width, background: C.paper, border: `1px solid ${C.hair}`,
      borderRadius: 10, boxShadow: C.shadowSoft, padding: "28px 30px",
      fontFamily: FONT.sans, opacity: reveal,
    }}>
      <div style={{
        fontSize: 14, letterSpacing: "0.16em", textTransform: "uppercase",
        color: C.grey2, marginBottom: 18,
      }}>Tafsīr · 2:2</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {sources.map((sc, i) => (
          <div key={sc.name} style={{
            fontSize: 16, padding: "7px 14px", borderRadius: 999,
            border: `1px solid ${i === source ? C.ink : C.hair2}`,
            background: i === source ? C.ink : "transparent",
            color: i === source ? C.white : C.grey,
            fontWeight: i === source ? 600 : 500,
          }}>{sc.name}</div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: C.grey2, marginBottom: 10 }}>{active.lang}</div>
      <div style={{
        fontSize: active.dir === "rtl" ? 25 : 20,
        fontFamily: active.dir === "rtl" ? FONT.ar : FONT.sans,
        direction: active.dir,
        lineHeight: active.dir === "rtl" ? 1.95 : 1.6,
        color: C.ink2,
      }}>{active.body}</div>
    </div>
  );
};

/* ── Workspace chrome — the frame that surrounds the page ──────────────── */

export const WorkspaceChrome: React.FC<{
  width: number; height: number; children?: React.ReactNode; reveal?: number;
}> = ({ width, height, children, reveal = 1 }) => (
  <div style={{
    width, height, background: "#FBFAF8",
    border: `1px solid ${C.hair}`, borderRadius: 14,
    boxShadow: C.shadowLift, display: "flex", overflow: "hidden",
    fontFamily: FONT.sans, opacity: reveal,
  }}>
    {/* icon rail */}
    <div style={{
      width: 62, borderRight: `1px solid ${C.hair}`, background: "#F7F6F3",
      display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 18, gap: 14,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, background: C.ink, color: C.white,
        fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
      }}>T</div>
      {["", ""].map((_, i) => (
        <div key={i} style={{ width: 30, height: 30, borderRadius: 8, background: i ? C.ink : "#E8E6E1" }} />
      ))}
    </div>
    {/* sidebar */}
    <div style={{ width: 232, borderRight: `1px solid ${C.hair}`, padding: "20px 16px" }}>
      <div style={{ fontSize: 17, fontWeight: 650, color: C.ink, marginBottom: 18 }}>Tafsir Circle</div>
      <div style={{
        fontSize: 12, letterSpacing: "0.12em", color: C.grey2,
        textTransform: "uppercase", marginBottom: 10,
      }}>Al-Baqarah</div>
      <div style={{
        fontSize: 15, color: C.ink, background: "#EEF4F0",
        borderRadius: 7, padding: "9px 11px", marginBottom: 7,
      }}>Al-Baqarah 1–5</div>
      {["Ayah 2 · rayb", "Tafsīr notes"].map((t) => (
        <div key={t} style={{ fontSize: 15, color: C.grey, padding: "9px 11px" }}>{t}</div>
      ))}
    </div>
    {/* canvas */}
    <div style={{ flex: 1, position: "relative", background: "#FDFDFC" }}>{children}</div>
  </div>
);

/* ── Chaos: the "five different apps" ─────────────────────────────────── */

export const AppWindow: React.FC<{
  title: string; accent: string; w?: number; h?: number; kind?: "text" | "pdf" | "web";
}> = ({ title, accent, w = 420, h = 300, kind = "text" }) => (
  <div style={{
    width: w, height: h, background: C.paper, border: `1px solid ${C.hair2}`,
    borderRadius: 12, boxShadow: C.shadowLift, overflow: "hidden",
    fontFamily: FONT.sans, display: "flex", flexDirection: "column",
  }}>
    <div style={{
      height: 38, borderBottom: `1px solid ${C.hair}`, display: "flex",
      alignItems: "center", gap: 7, padding: "0 13px", background: "#FBFAF9", flexShrink: 0,
    }}>
      <span style={{ width: 10, height: 10, borderRadius: 9, background: "#E5E3DF" }} />
      <span style={{ width: 10, height: 10, borderRadius: 9, background: "#E5E3DF" }} />
      <span style={{ width: 10, height: 10, borderRadius: 9, background: "#E5E3DF" }} />
      <span style={{ marginLeft: 10, fontSize: 14, color: C.grey, fontWeight: 550 }}>{title}</span>
    </div>
    <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ width: 54, height: 5, borderRadius: 4, background: accent, marginBottom: 5 }} />
      {kind === "web" && (
        <div style={{
          fontFamily: FONT.ar, fontSize: 21, color: C.ink2, direction: "rtl",
          textAlign: "center", lineHeight: 2, marginBottom: 6,
        }}>ذَٰلِكَ ٱلْكِتَـٰبُ لَا رَيْبَ</div>
      )}
      {Array.from({ length: kind === "web" ? 3 : 6 }).map((_, i) => (
        <div key={i} style={{
          height: 8, borderRadius: 5, background: "#EFEDE9",
          width: `${[92, 74, 86, 62, 80, 55][i % 6]}%`,
        }} />
      ))}
    </div>
  </div>
);

/* ── Devices ───────────────────────────────────────────────────────────── */

export const DeviceFrame: React.FC<{
  kind: "laptop" | "tablet" | "phone";
  w: number; h: number; children?: React.ReactNode;
}> = ({ kind, w, h, children }) => {
  const bezel = kind === "laptop" ? 12 : kind === "tablet" ? 14 : 10;
  const radius = kind === "laptop" ? 12 : kind === "tablet" ? 26 : 30;
  return (
    <div style={{ width: w }}>
      <div style={{
        width: w, height: h, background: "#111315",
        borderRadius: radius, padding: bezel,
        boxShadow: "0 50px 120px rgba(10,10,10,0.16), 0 12px 36px rgba(10,10,10,0.10)",
      }}>
        <div style={{
          width: "100%", height: "100%", background: C.white,
          borderRadius: radius - bezel + 2, overflow: "hidden", position: "relative",
        }}>{children}</div>
      </div>
      {kind === "laptop" && (
        <div style={{
          width: w * 1.1, height: 14, marginLeft: -w * 0.05,
          borderRadius: "0 0 12px 12px",
          background: "linear-gradient(#1B1E22,#0E1013)",
          boxShadow: "0 22px 40px rgba(10,10,10,0.14)",
        }} />
      )}
    </div>
  );
};

/* ── Cursor ────────────────────────────────────────────────────────────── */

export const Cursor: React.FC<{ press?: number }> = ({ press = 0 }) => (
  <div style={{ position: "relative", transform: `scale(${1 - press * 0.18})` }}>
    <svg width="30" height="34" viewBox="0 0 30 34">
      <path d="M5 3 L5 26 L11.2 20.4 L15.4 29.6 L19.6 27.6 L15.4 18.6 L23.6 18.2 Z"
            fill="#0A0A0A" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
    {press > 0 && (
      <span style={{
        position: "absolute", left: -14, top: -12, width: 46, height: 46,
        borderRadius: 99, border: `2px solid rgba(10,10,10,${0.28 * (1 - press)})`,
        transform: `scale(${0.5 + press * 1.5})`,
      }} />
    )}
  </div>
);

/** Absolute placement helper — everything sits at explicit world coords. */
export const At: React.FC<{
  x: number; y: number; z?: number; children: React.ReactNode;
  opacity?: number; rotate?: number; scale?: number; origin?: string;
}> = ({ x, y, z = 0, children, opacity = 1, rotate = 0, scale = 1, origin = "center center" }) => (
  <div style={{
    position: "absolute", left: x, top: y, zIndex: z, opacity,
    transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
    transformOrigin: origin,
  }}>{children}</div>
);
