/**
 * app.tsx — the REAL TafsirLab interface, rebuilt 1:1 inside Remotion.
 *
 * Rebuilt, not screenshotted: a PNG can't have a cursor move through it, text
 * typed into it, a drawer slide open, or ink laid down. Every measurement here
 * is taken from the product screenshots — the rail chips, the breadcrumb, the
 * Live pill, the Editor/Canvas/Split/Board tabs, the Tafsīr drawer's source
 * row and tab row. Nothing is redesigned.
 *
 * Text is the user's genuine Al-Fātiḥah study notes. Qur'anic text comes from
 * data/fatihah.json (api.quran.com v4, text_uthmani) — never from memory.
 */
import React from "react";
import { FONT } from "./theme";
import fatihahRaw from "./data/fatihah.json";

export interface AWord { t: string; tr: string }
export interface AVerse { key: string; text: string; words: AWord[]; translation: string }
export const FATIHAH = fatihahRaw as AVerse[];

/** Palette sampled from the product. */
export const P = {
  ink: "#1A1A1A",
  ink2: "#3A3A3A",
  grey: "#6B6660",
  grey2: "#9C968E",
  line: "#EDEDE9",
  line2: "#E5E3DF",
  rail: "#F7F6F3",
  side: "#FBFAF8",
  page: "#FFFFFF",
  sel: "#EEF4F0",
  dark: "#1B1E22",
  live: "#34C759",
  green: "#4F9A7A",
  hl: {
    blue: "#CBDDF3", green: "#CBE7CE", pink: "#F3CEDC",
    yellow: "#F3E3A9", orange: "#F5D6B8", violet: "#DCD3F2",
  },
  ink3: "#2B2B2B",
};

export const APP_W = 1640;
export const APP_H = 1030;

const SERIF = '"EB Garamond", Georgia, "Times New Roman", serif';

/* ── Small chrome atoms ──────────────────────────────────────────────── */

const Chip: React.FC<{ label: string; active?: boolean }> = ({ label, active }) => (
  <div style={{
    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
    background: active ? P.dark : "#F0EEEA",
    color: active ? "#fff" : P.ink2,
    fontSize: 13, fontWeight: 700, letterSpacing: "0.02em",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>{label}</div>
);

const Tab: React.FC<{ label: string; icon: string; active?: boolean }> = ({ label, icon, active }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 7,
    padding: "8px 15px", borderRadius: 8, whiteSpace: "nowrap",
    background: active ? "#fff" : "transparent",
    border: `1px solid ${active ? P.line2 : "transparent"}`,
    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
    color: active ? P.ink : P.grey,
    fontSize: 15, fontWeight: active ? 600 : 500,
  }}>
    <span style={{ fontSize: 13, opacity: 0.75 }}>{icon}</span>{label}
  </div>
);

const BarItem: React.FC<{ label: string; icon: string }> = ({ label, icon }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 7,
    color: P.ink2, fontSize: 15, fontWeight: 500, whiteSpace: "nowrap",
  }}>
    <span style={{ fontSize: 13, opacity: 0.7 }}>{icon}</span>{label}
  </div>
);

/* ── The app shell ───────────────────────────────────────────────────── */

export const AppShell: React.FC<{
  mode: "editor" | "canvas" | "split" | "board";
  crumb?: string[];
  children?: React.ReactNode;
  /** 0→1 sidebar visibility (canvas mode collapses it, as in the product) */
  sidebar?: number;
  drawer?: React.ReactNode;
  /** 0→1 drawer slide */
  drawerOpen?: number;
  /** 0→1 turns the whole panel edge-on and away. The transform lives on THIS
   *  element rather than a wrapper: an extra wrapper flattens the 3D context
   *  set up by the camera, so the rotation renders as a flat fade. */
  flip?: number;
}> = ({ mode, crumb = ["Study Group", "Al-Fatihah", "A"], children, sidebar = 1, drawer, drawerOpen = 0, flip = 0 }) => {
  const sideW = 268 * sidebar;
  return (
    <div style={{
      width: APP_W, height: APP_H,
      background: flip > 0.01 ? "transparent" : P.page,
      border: `1px solid ${flip > 0.01 ? "transparent" : P.line}`,
      borderRadius: 12, overflow: "hidden",
      display: "flex", fontFamily: FONT.sans, position: "relative",
      boxShadow: flip > 0.01 ? "none" : "0 30px 90px rgba(20,20,20,0.09), 0 6px 20px rgba(20,20,20,0.05)",
      transform: `perspective(2200px) rotateY(${-flip * 180}deg)`,
      transformOrigin: "50% 50%",
      backfaceVisibility: "hidden",
    }}>
      {/* icon rail */}
      <div style={{
        width: 72, flexShrink: 0, background: P.rail, borderRight: `1px solid ${P.line}`,
        display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: P.dark, color: "#fff",
          fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
        }}>T</div>
        <div style={{ fontSize: 19, color: P.grey, marginTop: 4 }}>⌂</div>
        <div style={{ width: 30, height: 1, background: P.line2, margin: "4px 0" }} />
        <Chip label="ST" active />
        <Chip label="BO" />
        <Chip label="GJ" />
        <div style={{
          width: 38, height: 38, borderRadius: 10, border: `1.5px dashed ${P.line2}`,
          color: P.grey2, fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center",
        }}>+</div>
      </div>

      {/* sidebar */}
      {sidebar > 0.01 && (
        <div style={{
          width: sideW, flexShrink: 0, background: P.side, borderRight: `1px solid ${P.line}`,
          overflow: "hidden", position: "relative", opacity: Math.min(1, sidebar * 1.6),
        }}>
          <div style={{ width: 268, padding: "18px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7, background: P.dark, color: "#fff",
                fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
              }}>ST</div>
              <div style={{ fontSize: 17, fontWeight: 650, color: P.ink }}>Study Group</div>
              <div style={{ fontSize: 13, color: P.grey2 }}>⌄</div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 12, color: P.grey2, fontSize: 16 }}>
                <span>+</span><span>‹</span>
              </div>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 11px",
              border: `1px solid ${P.line2}`, borderRadius: 9, marginBottom: 20,
              color: P.grey2, fontSize: 15,
            }}><span>⌕</span> Search…</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
              fontSize: 12.5, letterSpacing: "0.09em", color: P.grey, textTransform: "uppercase",
            }}>
              <span style={{ opacity: 0.6 }}>▤</span> AL-FATIHAH
              <span style={{ fontFamily: SERIF, textTransform: "none", fontSize: 15 }}>الفاتحة</span>
              <span style={{ marginLeft: "auto", color: P.grey2 }}>1</span>
            </div>
            <div style={{
              background: P.sel, borderRadius: 8, padding: "10px 12px",
              fontSize: 15.5, color: P.ink, fontWeight: 500,
            }}>A</div>
          </div>
          <div style={{
            position: "absolute", left: 0, bottom: 0, width: 268,
            borderTop: `1px solid ${P.line}`, padding: "14px 16px",
            fontSize: 14.5, color: P.grey, lineHeight: 2.1,
          }}>
            <div>← Workspace home</div>
            <div>All notes</div>
          </div>
        </div>
      )}

      {/* main column */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          height: 62, flexShrink: 0, borderBottom: `1px solid ${P.line}`,
          display: "flex", alignItems: "center", gap: 16, padding: "0 20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 15, color: P.grey }}>
            {crumb.map((c, i) => (
              <React.Fragment key={c}>
                {i > 0 && <span style={{ color: P.grey2 }}>/</span>}
                <span style={{ color: i === crumb.length - 1 ? P.ink : P.grey, fontWeight: i === crumb.length - 1 ? 550 : 500 }}>{c}</span>
              </React.Fragment>
            ))}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 7, padding: "5px 12px",
            border: `1px solid ${P.line2}`, borderRadius: 999, fontSize: 14, color: P.ink2,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 9, background: P.live }} /> Live
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: 6 }}>
            <Tab label="Editor" icon="✎" active={mode === "editor"} />
            <Tab label="Canvas" icon="▦" active={mode === "canvas"} />
            <Tab label="Split"  icon="◫" active={mode === "split"} />
            <Tab label="Board"  icon="▭" active={mode === "board"} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 22 }}>
            <BarItem label="Formatting" icon="T" />
            <BarItem label="Tafsīr" icon="▤" />
            <BarItem label="Tweaks" icon="⇅" />
            <BarItem label="Export" icon="⤓" />
            <div style={{
              display: "flex", alignItems: "center", gap: 7, padding: "7px 13px",
              border: `1px solid ${P.line2}`, borderRadius: 9, fontSize: 15, color: P.ink2,
            }}>🌐 English ⌄</div>
          </div>
        </div>

        <div style={{
          flex: 1, minHeight: 0, position: "relative", overflow: "hidden",
          // The drawer takes real space — the canvas shifts to make room for
          // it rather than being covered by it.
          marginRight: 560 * drawerOpen,
        }}>
          {children}
        </div>
      </div>

      {/* Tafsīr drawer — slides in from the right edge, over the content */}
      {drawer && drawerOpen > 0.001 && (
        <div style={{
          position: "absolute", top: 0, right: 0, height: "100%", width: 560,
          transform: `translateX(${(1 - drawerOpen) * 560}px)`,
          background: "#fff", borderLeft: `1px solid ${P.line}`,
          boxShadow: "-24px 0 60px rgba(20,20,20,0.07)",
        }}>{drawer}</div>
      )}
    </div>
  );
};

/* ── Editor: the user's real Al-Fātiḥah notes ────────────────────────── */

export const EditorDoc: React.FC<{
  scroll?: number; typed?: number; selection?: number;
  /** 0→1 slash-command palette, opened by typing "/" */
  slash?: number;
  /** 0→1 the /ayah embed the command inserts */
  embed?: number;
}> = ({ scroll = 0, typed = 0, selection = 0, slash = 0, embed = 0 }) => {
  const NEW = "It is the opening of the Book and the opening of the prayer.";
  const shown = NEW.slice(0, Math.floor(typed * NEW.length));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#fff" }}>
      <div style={{
        transform: `translateY(${-scroll}px)`,
        padding: "46px 60px 60px", display: "flex", gap: 56,
        fontFamily: SERIF, color: P.ink,
      }}>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.3, marginBottom: 14 }}>
            1. Al-Fātiḥah (<span style={{ fontFamily: SERIF }}>الفاتحة</span>) – “The Opening”
          </h1>
          <p style={{ fontSize: 21, lineHeight: 1.62, marginBottom: 18, position: "relative" }}>
            <span style={{
              background: selection > 0 ? P.hl.yellow : "transparent",
              boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
              padding: selection > 0 ? "2px 0" : 0,
            }}>
              It opens the Mushaf, the recitation in salāh, and the path of guidance.
            </span>
          </p>
          <ul style={{ margin: "0 0 16px 26px" }}>
            <li style={{ fontSize: 20, direction: "rtl", textAlign: "right", lineHeight: 2, marginBottom: 12 }}>
              وسميت فاتحة الكتاب لأنها يُفتتح بكتابتها المصاحف، ويقرأ بها في الصلوات.
            </li>
          </ul>
          <p style={{ fontSize: 21, lineHeight: 1.62, marginBottom: 8 }}>
            “It is called <i>Fātiḥat al-Kitāb</i> (The Opening of the Book) because the mushafs are
            opened with it, and it is recited at the start of the prayers.”
          </p>
          <p style={{ fontSize: 19, color: P.ink2, marginBottom: 22 }}>
            — <i>Tafsīr al-Tabarī</i>, Dār Hajr ed., vol. 1, p. 107.
          </p>
          <ul style={{ margin: "0 0 16px 26px" }}>
            <li style={{ fontSize: 20, direction: "rtl", textAlign: "right", lineHeight: 2, marginBottom: 12 }}>
              يقال لها: الفاتحة… وبها تُفتح القراءة في الصلاة.
            </li>
          </ul>
          <p style={{ fontSize: 21, lineHeight: 1.62, marginBottom: 8 }}>
            “It is called <i>al-Fātiḥah</i> because the recitation in prayer begins with it.”
          </p>
          <p style={{ fontSize: 19, color: P.ink2, marginBottom: 10 }}>
            — <i>Tafsīr Ibn Kathīr</i>, Arabic text (Dār Tayyibah).
          </p>
          {/* the slash command — a real product affordance */}
          {slash > 0 && embed < 0.02 && (
            <div style={{
              width: 380, background: "#fff", border: `1px solid ${P.line2}`,
              borderRadius: 10, boxShadow: "0 18px 44px rgba(20,20,20,0.13)",
              padding: 8, fontFamily: FONT.sans, marginBottom: 18,
              opacity: Math.min(1, slash * 2), transformOrigin: "top left",
              transform: `scale(${0.96 + 0.04 * Math.min(1, slash * 2)})`,
            }}>
              <div style={{
                fontSize: 12, letterSpacing: "0.1em", color: P.grey2,
                padding: "6px 10px 8px", textTransform: "uppercase",
              }}>Insert</div>
              {[
                { k: "/ayah", d: "Embed a verse", on: true },
                { k: "/tafsir", d: "Insert commentary" },
                { k: "/word", d: "Word note" },
              ].map((o) => (
                <div key={o.k} style={{
                  display: "flex", alignItems: "baseline", gap: 12,
                  padding: "10px 10px", borderRadius: 7,
                  background: o.on ? P.sel : "transparent",
                }}>
                  <span style={{
                    fontSize: 15.5, fontWeight: 600,
                    color: o.on ? P.green : P.ink,
                  }}>{o.k}</span>
                  <span style={{ fontSize: 14, color: P.grey }}>{o.d}</span>
                </div>
              ))}
            </div>
          )}
          {embed > 0.02 && (
            <div style={{
              border: `1px solid ${P.line}`, borderLeft: `3px solid ${P.green}`,
              borderRadius: 8, padding: "16px 18px", marginBottom: 18,
              background: "#FCFCFB", fontFamily: FONT.sans,
              opacity: Math.min(1, embed * 2),
              transform: `translateY(${(1 - Math.min(1, embed * 2)) * 8}px)`,
            }}>
              <div style={{ fontSize: 12.5, letterSpacing: "0.1em", color: P.grey2, marginBottom: 8 }}>
                AYAH · 1:5
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 26, direction: "rtl", textAlign: "right", color: P.ink }}>
                إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ
              </div>
            </div>
          )}

          {/* the sentence being written during the film */}
          {typed > 0 && (
            <p style={{ fontSize: 21, lineHeight: 1.62, marginBottom: 26, color: P.ink }}>
              {shown}
              <span style={{
                display: "inline-block", width: 2, height: 22, background: P.ink,
                verticalAlign: "-4px", marginLeft: 1,
                opacity: typed < 1 ? 1 : 0,
              }} />
            </p>
          )}

          <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.32, margin: "34px 0 14px" }}>
            2. Umm al-Kitāb / Umm al-Qurʾān (<span>أم الكتاب / أم القرآن</span>) – “The Mother of the
            Book / Qurʾan”
          </h1>
          <p style={{ fontSize: 21, lineHeight: 1.62, marginBottom: 18 }}>
            It is the foundation and summary of the Qurʾan and the basis of prayer.
          </p>
          <ul style={{ margin: "0 0 16px 26px" }}>
            <li style={{ fontSize: 20, direction: "rtl", textAlign: "right", lineHeight: 2 }}>
              إنما قيل لها… أم القرآن، لتسمية العرب كل جامع أمرًا… أو مقدم لأمر… أمًّا.
            </li>
          </ul>
          <p style={{ fontSize: 21, lineHeight: 1.62 }}>
            “It is called <i>Umm al-Qurʾan</i> because the Arabs refer to anything that
            comprehensively gathers matters or leads other things as ‘umm’ (mother).”
          </p>
        </div>

        {/* right-hand reflection column, as in the product */}
        <div style={{ width: 420, flexShrink: 0, paddingTop: 210 }}>
          <ul style={{ margin: 0, paddingLeft: 22 }}>
            <li style={{ fontSize: 20, lineHeight: 1.58, marginBottom: 18 }}>
              Reflection — the first thing a child experiences when they are born is their mother;
              the first thing a reader of the Qurʾan experiences is the Fātiḥah (umm al-kitāb)
            </li>
            <li style={{ fontSize: 20, lineHeight: 1.58, marginBottom: 10 }}>
              Umm al-kitāb keeps man alive as the mother keeps the infant alive:
              <ul style={{ margin: "10px 0 0 20px" }}>
                <li style={{ marginBottom: 8 }}>Without Fātiḥah there is no salāh</li>
                <li style={{ marginBottom: 8 }}>Without salāh there is no Islam</li>
                <li style={{ marginBottom: 8 }}>No Islam means no remembrance of Allah</li>
                <li>A man who does not remember Allah is likened to a dead man</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/* ── The REAL Mushaf ──────────────────────────────────────────────────────
   Not an approximation. The product renders Mushaf pages with Quran
   Foundation's QCF v2 page fonts: every page has its own font file, and each
   word is a Private Use Area glyph code (code_v2) placed on a real line. The
   font *is* the page layout — which is why the genuine article has evenly
   filled lines that no Amiri/Uthmani fallback can reproduce.

   data/page1.json holds the exact glyph codes + line numbers the app fetches;
   public/qcf/p1.woff2 is the exact font it loads. Layout constants
   (centred RTL flex rows, 2.5 line-height, zero letter/word-spacing, kerning
   off) are copied from .qcf-lines / .qcf-line in app/globals.css.          */

import { staticFile } from "remotion";
import page1 from "./data/page1.json";

interface QWord { c: string; t: string; key: string; pos: number }
interface QLine { n: number; words: QWord[] }
const PAGE1 = page1 as { page: number; v2_page: number; lines: QLine[] };

export const QCF_FONT_CSS = `
@font-face {
  font-family: "p${PAGE1.v2_page}-v2";
  src: url("${staticFile(`qcf/p${PAGE1.v2_page}.woff2`)}") format("woff2");
  font-display: block;
}`;

/**
 * One Mushaf page, exactly as the product draws it.
 * `mark` selects a SINGLE word to highlight — studying marks one word, not a
 * rainbow across every ayah.
 */
export const QCFPage: React.FC<{
  fontSize?: number;
  /** Every highlight is anchored to a real word, so it cannot drift off the
   *  text: {key, pos} identifies the glyph, `c` the colour, and `at` the point
   *  in the 0→1 `markInk` progress at which that mark is laid down. */
  marks?: { key: string; pos: number; c: string; at: number }[];
  /** 0→1 progress that lays the marks down, right→left, like a highlighter */
  markInk?: number;
  /** 0→1 selection ring on the primary word */
  markRing?: number;
  ringOn?: { key: string; pos: number } | null;
}> = ({ fontSize = 20, marks = [], markInk = 0, markRing = 0, ringOn = null }) => (
  <div style={{
    display: "flex", flexDirection: "column", width: "100%", direction: "rtl",
    fontFamily: `"p${PAGE1.v2_page}-v2"`,
    fontSize, lineHeight: 2.5, letterSpacing: 0, wordSpacing: 0,
    fontKerning: "none", textRendering: "optimizeSpeed", color: P.ink,
  }}>
    {PAGE1.lines.map((ln) => (
      <div key={ln.n} style={{
        display: "flex", flexDirection: "row", justifyContent: "center",
        alignItems: "center", direction: "rtl", whiteSpace: "nowrap",
      }}>
        {ln.words.map((w, i) => {
          const m = marks.find((k) => k.key === w.key && k.pos === w.pos);
          const grow = m ? Math.max(0, Math.min(1, (markInk - m.at) / 0.18)) : 0;
          const isRing = !!ringOn && w.key === ringOn.key && w.pos === ringOn.pos;
          return (
            <span key={i} style={{ position: "relative", display: "inline-block" }}>
              {m && grow > 0 && (
                <span style={{
                  position: "absolute", left: -2, right: -2, top: "20%", bottom: "16%",
                  background: m.c, borderRadius: 3, zIndex: 0,
                  transformOrigin: "right center", transform: `scaleX(${grow})`,
                }} />
              )}
              {isRing && markRing > 0 && (
                <span style={{
                  position: "absolute", left: -3, right: -3, top: "14%", bottom: "10%",
                  border: `2px solid ${P.green}`, borderRadius: 6, zIndex: 2,
                  background: "rgba(79,154,122,0.08)", opacity: markRing,
                }} />
              )}
              <span style={{ position: "relative", zIndex: 1 }}>{w.c}</span>
            </span>
          );
        })}
      </div>
    ))}
  </div>
);


/* ── Written ───────────────────────────────────────────────────────────────
   Text that is WRITTEN, not wiped on. A constant-speed reveal reads as a
   wipe because a real hand doesn't move at constant speed: it accelerates
   through a word, slows at the end of it, and pauses in the gap before
   starting the next. So the reveal advances word-by-word with that pacing,
   and a small nib rides the leading edge while the pen is down — then lifts.
   Every word also drops in on a slight baseline wobble, because handwriting
   is never perfectly level.                                                */

export const Written: React.FC<{
  text: string; x: number; y: number; size: number; width: number;
  /** 0→1 progress for this phrase */ p: number; colour?: string;
}> = ({ text, x, y, size, width, p, colour = P.ink3 }) => {
  if (p <= 0) return null;
  const words = text.split(" ");
  const chars = text.length;

  // Each word owns a slice of the phrase proportional to its length.
  let acc = 0;
  const segs = words.map((wd) => {
    const a = acc / chars;
    acc += wd.length + 1;
    return { wd, a, b: Math.min(1, acc / chars) };
  });

  // How far the pen has travelled, with per-word pacing.
  let adv = 0;
  let writing = false;
  for (const g of segs) {
    if (p >= g.b) { adv = g.b; continue; }
    if (p > g.a) {
      const t = (p - g.a) / (g.b - g.a);
      // quick through the word (x1.25), then a held pause in the gap
      const e = Math.min(1, t * 1.25);
      adv = g.a + e * (g.b - g.a);
      writing = e < 1;
      break;
    }
    break;
  }
  if (p >= 1) adv = 1;

  const revealed = width * adv;
  const id = `wr-${x}-${y}`;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <rect x={x - 8} y={y - size * 1.15} width={revealed + 8} height={size * 1.7} />
        </clipPath>
      </defs>
      <text x={x} y={y} fill={colour} clipPath={`url(#${id})`}
            style={{ fontFamily: FONT.hand, fontSize: size }}>{text}</text>
      {writing && (
        // the nib — only visible while the pen is actually down
        <circle cx={x + revealed} cy={y - size * 0.22} r={size * 0.075}
                fill={colour} opacity={0.75} />
      )}
    </g>
  );
};

/* ── Canvas: the real Mushaf surface with the tool rail ──────────────── */

export const CanvasDoc: React.FC<{
  /** 0→1 fades the page-level annotations away when a word is opened */
  clearInk?: number;
  /** 0→1 draws the annotations that belong to that one word */
  wordInk?: number;
  /** 0→1 per-ayah colour highlights being laid down */
  hl?: number;
  /** 0→1 ink strokes drawn in sequence */
  ink?: number;
  /** 0→1 glow on the single word that owns a note */
  wordGlow?: number;
  tool?: number;
}> = ({ hl = 0, ink = 0, wordGlow = 0, tool = 0, clearInk = 0, wordInk = 0 }) => {
  const seg = (a: number, b: number) => Math.max(0, Math.min(1, (ink - a) / (b - a)));
  /* Handwritten margin notes. `w` is the approximate ink width, used by the
     clip that writes each one on.

     `y` is derived, not eyeballed: QCFPage sits at top 96 and every line is
     fontSize 44 × line-height 2.5 = 110px tall, so line n is centred at
     41 + 110n. A note has to sit on the āyah it is about — a margin note
     floating between two lines annotates nothing. LINE() adds the baseline
     offset so the writing reads as vertically centred on its line. */
  const LINE = (n: number, size: number) => 41 + 110 * n + size * 0.34;
  const HAND = [
    // 2 · al-ḥamd — praise comes before the request
    { t: "praise before asking",   x: 225, y: LINE(2, 34),      s: 34, w: 300, a: 0.20, b: 0.34 },
    // 3 · māliki yawmi'd-dīn
    { t: "He owns the Day",        x: 225, y: LINE(3, 34),      s: 34, w: 250, a: 0.36, b: 0.48 },
    // 4 · iyyāka naʿbudu — two lines of one thought, so they stack
    { t: "worship before help",    x: 225, y: LINE(4, 36) - 22, s: 36, w: 320, a: 0.52, b: 0.68 },
    { t: "the pivot of the sūrah", x: 225, y: LINE(4, 32) + 24, s: 32, w: 300, a: 0.70, b: 0.84 },
    // 6 · those favoured vs those astray
    { t: "the two paths",          x: 255, y: LINE(6, 34),      s: 34, w: 200, a: 0.86, b: 1.0 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: "#fff", overflow: "hidden" }}>
      {/* Nothing in here is ever transformed: the Mushaf and every mark are
          absolutely positioned in the same box, so an annotation cannot drift
          off the word it describes. The drawer is handled by framing, not by
          moving the page. */}
      {/* page pill */}
      <div style={{
        position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 16, padding: "9px 18px",
        border: `1px solid ${P.line2}`, borderRadius: 999, background: "#fff",
        fontSize: 15, color: P.ink2, zIndex: 5,
      }}>
        <span style={{ color: P.grey2 }}>‹</span> Page 1 <span style={{ color: P.grey2 }}>· Al-Fātiḥah</span> <span style={{ color: P.grey2 }}>›</span>
      </div>

      {/* tool rail */}
      <div style={{
        position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)",
        display: "flex", flexDirection: "column", gap: 6, zIndex: 5,
      }}>
        {/* Text-presentation glyphs only. ✋ and 🖍 default to *emoji*
            presentation in Chrome, so they rendered as full-colour cartoons
            in a rail that is otherwise monochrome. */}
        {["✥", "✎", "▬", "↗", "T", "⬠"].map((t, i) => (
          <div key={i} style={{
            width: 44, height: 44, borderRadius: 11,
            background: i === tool ? "#fff" : "transparent",
            border: `1px solid ${i === tool ? P.line2 : "transparent"}`,
            boxShadow: i === tool ? "0 1px 3px rgba(0,0,0,0.07)" : "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            // the highlighter chip carries the ink colour it lays down
            fontSize: 17, color: i === 2 ? "#C7A93A" : P.ink2,
            fontFamily: FONT.sans,
          }}>{t}</div>
        ))}
        <div style={{ width: 30, height: 1, background: P.line2, margin: "6px auto" }} />
        {["↶", "↷"].map((t) => (
          <div key={t} style={{
            width: 44, height: 44, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 17, color: P.grey2,
          }}>{t}</div>
        ))}
      </div>

      {/* ── Word focus ──────────────────────────────────────────────────
          Opening a word clears the page-level notes and gives that word its
          own annotation space, in place. These marks are about إِيَّاكَ
          specifically: the fronting that makes it "You ALONE". */}
      {wordInk > 0.001 && (
        <svg style={{ position: "absolute", inset: 0, overflow: "visible", zIndex: 4 }}
             width="100%" height="100%">
          {(() => {
            const g = (a: number, b: number) => Math.max(0, Math.min(1, (wordInk - a) / (b - a)));
            return (
              <>
                {/* underline directly beneath the word */}
                <path d="M958 512 C 992 504, 1046 502, 1092 510"
                      fill="none" stroke={P.ink3} strokeWidth={3} strokeLinecap="round"
                      strokeDasharray={150} strokeDashoffset={150 * (1 - g(0, 0.18))} />
                {/* Lead line down into the clear space BELOW the page, so the
                    notes never sit on top of the Qur'anic text. It leaves the
                    word through the gap between lines 4 and 5, then runs down
                    the left margin at x≈500 — clear of every line, the widest
                    of which starts at x 574. A lead line drawn straight to the
                    notes would cut across three āyāt. */}
                <path d="M1000 524 C 880 554, 700 558, 560 604 C 508 622, 496 706, 498 806"
                      fill="none" stroke={P.ink3} strokeWidth={2.6} strokeLinecap="round"
                      strokeDasharray={640} strokeDashoffset={640 * (1 - g(0.18, 0.42))} />
                <path d="M498 806 L 480 778 M498 806 L 520 780"
                      fill="none" stroke={P.ink3} strokeWidth={2.6} strokeLinecap="round"
                      strokeDasharray={72} strokeDashoffset={72 * (1 - g(0.42, 0.50))} />
                {/* the word's own notes, in open space */}
                <text x={420} y={862} fill={P.ink3} opacity={g(0.50, 0.74)}
                      style={{ fontFamily: FONT.hand, fontSize: 40 }}>fronted &#8594; &#8220;You alone&#8221;</text>
                <text x={420} y={926} fill={P.ink3} opacity={g(0.76, 1)}
                      style={{ fontFamily: FONT.hand, fontSize: 36 }}>not &#8220;we worship You&#8221;</text>
              </>
            );
          })()}
        </svg>
      )}

      {/* the real Mushaf — QCF v2 glyphs, one marked word, nothing else */}
      <style>{QCF_FONT_CSS}</style>
      <div style={{
        position: "absolute", left: 150, right: 110, top: 96,
      }}>
        <QCFPage
          fontSize={44}
          markInk={hl}
          markRing={wordGlow}
          ringOn={{ key: "1:5", pos: 1 }}
          marks={[
            { key: "1:4", pos: 1, c: P.hl.violet, at: 0.00 },
            { key: "1:4", pos: 2, c: P.hl.violet, at: 0.06 },
            { key: "1:5", pos: 1, c: P.hl.yellow, at: 0.22 },
            { key: "1:6", pos: 2, c: P.hl.violet, at: 0.40 },
            { key: "1:6", pos: 3, c: P.hl.violet, at: 0.46 },
          ]}
        />
      </div>

      {/* ── Study marks ─────────────────────────────────────────────────
          No underlines: a phrase that matters gets a purple highlight, the
          way it would with a real highlighter. Handwriting is WRITTEN — each
          note is revealed by a left-to-right clip so the strokes appear in
          the order a hand makes them, not faded in as a block. */}
      <svg style={{ position: "absolute", inset: 0, overflow: "visible", opacity: 1 - clearInk }}
           width="100%" height="100%">



        {HAND.map((h, i) => (
          <Written key={i} text={h.t} x={h.x} y={h.y} size={h.s} width={h.w}
                   p={seg(h.a, h.b)} />
        ))}
      </svg>
    </div>
  );
};

/* ── Tafsīr drawer — the real source row, tabs and ayah rail ─────────── */

const SOURCES = ["All", "English", "Arabic", "Bengali", "Urdu", "Russian"];
const TABS = ["Commentary", "Word-by-word", "Translations", "Recitation"];

export const TafsirDrawerReal: React.FC<{ lang?: number; tab?: number }> = ({ lang = 1, tab = 0 }) => {
  const body = lang === 2
    ? {
        who: "Tafseer Al-Baghawi", meta: "Live · AR", dir: "rtl" as const, serif: true,
        text: "سُورَةُ فَاتِحَةِ الْكِتَابِ. وَلَهَا ثَلَاثَةُ أَسْمَاءٍ مَعْرُوفَةٌ: فَاتِحَةُ الْكِتَابِ، وَأُمُّ الْقُرْآنِ، وَالسَّبْعُ الْمَثَانِي. سُمِّيَتْ فَاتِحَةَ الْكِتَابِ لِأَنَّ اللَّهَ بِهَا افْتَتَحَ الْقُرْآنَ.",
      }
    : {
        who: "Ibn Kathīr (English)", meta: "Cached · EN", dir: "ltr" as const, serif: false,
        text: "The Meaning of Al-Fatihah and its Various Names. This Surah is called Al-Fatihah, that is, the Opener of the Book, the Surah with which prayers are begun. It is also called Umm Al-Kitab (the Mother of the Book), according to the majority of the scholars.",
      };
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: FONT.sans }}>
      <div style={{ padding: "18px 22px 0" }}>
        <div style={{ fontSize: 19, fontWeight: 650, color: P.ink }}>Tafsīr · Classical Commentary</div>
        <div style={{ fontSize: 14, color: P.grey2, marginTop: 4, fontFamily: "monospace" }}>1:1 · Al-Qurʾān</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
          <span style={{ fontSize: 12.5, letterSpacing: "0.1em", color: P.grey2 }}>SOURCE</span>
          {SOURCES.map((sname, i) => (
            <span key={sname} style={{
              fontSize: 14.5, color: i === lang ? P.ink : P.grey,
              fontWeight: i === lang ? 650 : 500,
              borderBottom: i === lang ? `2px solid ${P.ink}` : "2px solid transparent",
              paddingBottom: 3,
            }}>{sname}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 16, borderBottom: `1px solid ${P.line}` }}>
          {TABS.map((t, i) => (
            <span key={t} style={{
              fontSize: 15, paddingBottom: 10,
              color: i === tab ? P.ink : P.grey,
              fontWeight: i === tab ? 650 : 500,
              borderBottom: i === tab ? `2px solid ${P.ink}` : "2px solid transparent",
            }}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{
          width: 44, flexShrink: 0, paddingTop: 16, textAlign: "center",
          fontSize: 14, color: P.grey2, lineHeight: 2.1,
        }}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <div key={n} style={{ color: n === 1 ? P.ink : P.grey2, fontWeight: n === 1 ? 700 : 400 }}>{n}</div>
          ))}
        </div>
        <div style={{ flex: 1, padding: "16px 22px 0 4px", minWidth: 0 }}>
          {tab === 0 && (
            <>
              <div style={{
                border: `1px solid ${P.line}`, borderRadius: 10, padding: "18px 20px",
                background: "#FCFCFB", marginBottom: 18,
              }}>
                <div style={{ fontFamily: SERIF, fontSize: 27, direction: "rtl", textAlign: "center", marginBottom: 10 }}>
                  {FATIHAH[0].text}
                </div>
                <div style={{ fontSize: 16.5, color: P.ink2, lineHeight: 1.5 }}>
                  In the name of Allāh, the Entirely Merciful, the Especially Merciful.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 999, background: "#F0EEEA",
                  fontSize: 12, fontWeight: 700, color: P.ink2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{body.who.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: P.ink }}>{body.who}</div>
                  <div style={{ fontSize: 12.5, color: P.grey2 }}>{body.meta}</div>
                </div>
              </div>
              <div style={{
                fontSize: body.dir === "rtl" ? 22 : 17,
                fontFamily: body.serif ? SERIF : FONT.sans,
                direction: body.dir, lineHeight: body.dir === "rtl" ? 2.05 : 1.62,
                color: P.ink2,
              }}>{body.text}</div>
            </>
          )}
          {tab === 1 && (
            <div style={{ paddingTop: 6 }}>
              {FATIHAH[4].words.map((w) => (
                <div key={w.t} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "13px 4px", borderBottom: `1px solid ${P.line}`,
                }}>
                  <span style={{ fontSize: 15.5, color: P.ink2 }}>{w.tr}</span>
                  <span style={{ fontFamily: SERIF, fontSize: 27, color: P.ink }}>{w.t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── The word's own note, opened in place on the canvas ──────────────── */

export const WordNote: React.FC<{ open?: number; ink?: number }> = ({ open = 0, ink = 0 }) => (
  <div style={{
    width: 470, background: "#fff", border: `1px solid ${P.line2}`, borderRadius: 12,
    boxShadow: "0 22px 60px rgba(20,20,20,0.12)", padding: "20px 22px 16px",
    fontFamily: FONT.sans, transformOrigin: "top center",
    transform: `scaleY(${0.2 + 0.8 * open}) translateY(${(1 - open) * -8}px)`,
    opacity: Math.min(1, open * 2.4),
  }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 9, fontSize: 13,
      letterSpacing: "0.12em", textTransform: "uppercase", color: P.green,
      fontWeight: 700, marginBottom: 12,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 9, background: P.green }} />
      Word note · 1:5
    </div>
    <div style={{ fontSize: 20, color: P.ink, lineHeight: 1.5, marginBottom: 6 }}>
      <span style={{ fontFamily: SERIF, fontSize: 26 }}>إِيَّاكَ</span> — fronted for exclusivity:
      <i> You alone</i>.
    </div>
    <svg width={420} height={72} style={{ display: "block" }}>
      <path d="M8 44 C 52 20, 96 18, 132 40 S 206 66, 244 38"
            fill="none" stroke={P.ink3} strokeWidth={2.8} strokeLinecap="round"
            strokeDasharray={330} strokeDashoffset={330 * (1 - Math.max(0, Math.min(1, ink * 1.6)))} />
      <text x={10} y={68} fill={P.ink3}
            opacity={Math.max(0, Math.min(1, (ink - 0.62) / 0.38))}
            style={{ fontFamily: FONT.hand, fontSize: 26 }}>not “we worship You”</text>
    </svg>
  </div>
);

