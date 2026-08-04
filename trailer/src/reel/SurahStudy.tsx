import React from "react";
import {
  AbsoluteFill, Sequence, Audio, staticFile,
  useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import { typed } from "./parts";
import {
  morphAt, Card, Stage, Words, Rise, Say, SmearCursor,
  themeAt, useTheme, ThemeProvide, LIGHT,
} from "./morph";
import {
  STUDY_FRAMES, STATES as S, SAYS, LEGS, IX, DESK, ED, ED_H, MUS, MUS_H,
  TOOLS, INK, MARK, AYAH_CMD, TAF_CMD, MARK_TEXT, T, T_END,
  FATIHA, AYAH, SOURCES, TAFSIR_TEXT, MAGNETIC, FALLS,
} from "./studySpec";

export { STUDY_FRAMES };

/* ── Studying a sūrah ──────────────────────────────────────────────────────
   One container for 54 seconds. It begins as the app icon in the dock, is
   clicked, flies up and becomes the window; it grows into a note as an āyah
   and a commentary are pulled in by command; it becomes the muṣḥaf sheet and
   is marked up; and it closes on the brand.

   Nothing here is a cut, and nothing is invented — the commands, the tafsīr
   sources, the six canvas tools and the block metrics are all read out of the
   app. Only a crop of the interface is ever shown, never a whole screen.   */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease3 = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/* ── The desktop the app is launched from ─────────────────────────────────*/

/**
 * Backdrop, not container. The menu bar and dock live on the stage behind the
 * icon; they fade once the window has opened, because from that point the
 * piece is inside the product and the desktop is no longer the subject.
 */
const Desktop: React.FC<{ f: number }> = ({ f }) => {
  const out = interpolate(f, [200, 300], [1, 0], clamp);
  if (out <= 0) return null;
  const others = [-2, -1, 1, 2];
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out, zIndex: 0 }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(165deg, #cfd6dd 0%, #b9c3cd 45%, #a8b4c2 100%)",
      }} />

      {/* Menu bar. The app's own menus — it is already the front application. */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: 0, height: DESK.menuH,
        background: "rgba(255,255,255,0.55)",
        display: "flex", alignItems: "center", gap: 26,
        padding: "0 22px", boxSizing: "border-box",
        fontFamily: R.fontSans, fontSize: 15, color: "#22252a",
      }}>
        <span style={{ fontSize: 15, opacity: 0.75 }}>◉</span>
        <span style={{ fontWeight: 700 }}>TafsirLab</span>
        {["File", "Edit", "View", "Window", "Help"].map((m) => (
          <span key={m} style={{ opacity: 0.72 }}>{m}</span>
        ))}
        <span style={{ marginLeft: "auto", opacity: 0.72 }}>Fri 14:02</span>
      </div>

      {/* Dock. The TafsirLab slot is deliberately empty — the container is
          standing in it. */}
      <div style={{
        position: "absolute", left: FRAME_CX - DESK.dockW / 2,
        top: DESK.dockCy - DESK.dockH / 2,
        width: DESK.dockW, height: DESK.dockH, borderRadius: 26,
        background: "rgba(255,255,255,0.42)",
        border: "1px solid rgba(255,255,255,0.55)",
        boxShadow: "0 12px 40px rgba(20,30,45,0.22)",
      }} />
      {others.map((k) => (
        <div key={k} style={{
          position: "absolute",
          left: FRAME_CX + k * (DESK.icon + DESK.gap) - DESK.icon / 2,
          top: DESK.dockCy - DESK.icon / 2,
          width: DESK.icon, height: DESK.icon, borderRadius: 19,
          background: ["#5b8dd9", "#e0a44b", "#6bb187", "#c76b7f"][k < 0 ? k + 2 : k + 1],
          opacity: 0.9,
        }} />
      ))}
    </div>
  );
};

const FRAME_CX = 540;

/* ── Container contents ───────────────────────────────────────────────────*/

const Mark: React.FC<{ size: number }> = ({ size }) => {
  const th = useTheme();
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.26,
      background: th.ink, color: th.card,
      display: "grid", placeItems: "center",
      fontFamily: R.fontSans, fontSize: size * 0.5, fontWeight: 700,
    }}>T</div>
  );
};

/** The icon, while it is still in the dock: it lifts as the pointer nears,
 *  names itself, and bounces once when clicked. */
const DockIcon: React.FC<{ f: number }> = ({ f }) => {
  const th = useTheme();
  const hover = interpolate(f, [T.dockHover - 26, T.dockHover], [0, 1], clamp);
  const b = Math.max(0, Math.sin((f - T.dockClick) / 9)) *
            interpolate(f, [T.dockClick, T.dockClick + 8, T.dockClick + 46], [0, 1, 0], clamp);
  return (
    <div style={{
      height: "100%", display: "grid", placeItems: "center",
      transform: `translateY(${-hover * 8 - b * 22}px)`,
      borderRadius: 28, background: th.ink, color: th.card,
      fontFamily: R.fontSans, fontSize: 60, fontWeight: 700,
      boxShadow: "0 14px 34px rgba(20,30,45,0.35)",
      position: "relative",
    }}>
      T
      <div style={{
        position: "absolute", bottom: -50, left: "50%", transform: "translateX(-50%)",
        opacity: hover, whiteSpace: "nowrap",
        background: "rgba(255,255,255,0.92)", color: "#22252a",
        fontFamily: R.fontSans, fontSize: 17, padding: "6px 14px", borderRadius: 8,
      }}>TafsirLab</div>
      {/* Running indicator, once it has been launched. */}
      <div style={{
        position: "absolute", bottom: -18, left: "50%", transform: "translateX(-50%)",
        width: 6, height: 6, borderRadius: "50%", background: "#22252a",
        opacity: interpolate(f, [T.dockClick + 10, T.dockClick + 30], [0, 0.7], clamp),
      }} />
    </div>
  );
};

/** The first thing the app shows: a crop, never the whole screen. */
const Window: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Rise f={f} start={s} i={0} style={{
        height: 62, display: "flex", alignItems: "center", gap: 12,
        padding: "0 22px", borderBottom: `1px solid ${th.line}`, flexShrink: 0,
      }}>
        <Mark size={28} />
        <span style={{ fontFamily: R.fontSans, fontSize: 18, fontWeight: 600, color: th.ink }}>
          TafsirLab
        </span>
        <span style={{ marginLeft: "auto", fontFamily: R.fontSans, fontSize: 15, color: th.ink4 }}>
          Tafsir Circle
        </span>
      </Rise>

      <div style={{ padding: "26px 30px", flex: 1 }}>
        <Rise f={f} start={s} i={1} style={{
          fontFamily: R.fontSans, fontSize: 14, color: th.ink4, letterSpacing: "0.06em",
          textTransform: "uppercase", marginBottom: 18,
        }}>Continue</Rise>
        {[
          { n: "1", t: "Al-Fātiḥah", s: "7 āyāt · 4 notes", on: true },
          { n: "2", t: "Al-Baqarah", s: "286 āyāt · 12 notes", on: false },
          { n: "15", t: "Al-Ḥijr", s: "99 āyāt · 2 notes", on: false },
        ].map((row, i) => (
          <Rise key={row.t} f={f} start={s} i={2 + i} style={{
            display: "flex", alignItems: "center", gap: 16, marginBottom: 10,
            padding: "14px 16px", borderRadius: 12,
            background: row.on ? th.accentSoft : th.panel,
            border: `1px solid ${row.on ? th.accent : th.line}`,
          }}>
            <span style={{
              fontFamily: R.fontMono, fontSize: 15, color: th.ink4,
              width: 30, textAlign: "right",
            }}>{row.n}</span>
            <span style={{ fontFamily: R.fontSans, fontSize: 21, fontWeight: 600, color: th.ink }}>
              {row.t}
            </span>
            <span style={{ marginLeft: "auto", fontFamily: R.fontSans, fontSize: 16, color: th.ink3 }}>
              {row.s}
            </span>
          </Rise>
        ))}
      </div>
    </div>
  );
};

/* ── Blocks, at the product's own metrics ─────────────────────────────────*/

const AyahBlockView: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const e = ease3((f - s) / 22);
  return (
    <div style={{
      height: ED.ayahH, boxSizing: "border-box",
      border: `1px solid ${th.line}`, borderRadius: 10,
      padding: "9px 15px 11px",
      opacity: e, transform: `translateY(${(1 - e) * 14}px)`,
    }}>
      <div style={{
        fontFamily: R.fontMono, fontSize: 13, fontWeight: 500,
        letterSpacing: "0.06em", color: th.ink4, marginBottom: 10,
      }}>AL-ḤIJR {AYAH.ref}</div>
      <div dir="rtl" style={{
        fontFamily: R.fontArabic, fontSize: 27, lineHeight: 1.95,
        textAlign: "right", color: th.ink, marginBottom: 8,
      }}>{AYAH.ar}</div>
      <div style={{
        fontFamily: R.fontSans, fontSize: 16, lineHeight: 1.55, color: th.ink2,
        paddingTop: 8, borderTop: `1px solid ${th.line}`,
      }}>{AYAH.en}</div>
    </div>
  );
};

/**
 * The commentary block, including the state the product actually passes
 * through: it lands empty and shimmers while the source is fetched, then the
 * text replaces the skeleton in place.
 */
const TafsirBlockView: React.FC<{ f: number }> = ({ f }) => {
  const th = useTheme();
  const e = ease3((f - T.tafSkeleton) / 22);
  const done = interpolate(f, [T.tafResolve, T.tafResolve + 26], [0, 1], clamp);
  /* Driven off the frame, not a CSS animation — a render has no wall clock. */
  const shim = `${200 - ((f * 3) % 400)}% 0`;
  const line = (w: string) => ({
    height: 16, width: w, borderRadius: 4,
    background: `linear-gradient(90deg, ${th.line} 25%, ${th.panel2} 50%, ${th.line} 75%)`,
    backgroundSize: "200% 100%", backgroundPosition: shim,
  });
  return (
    <div style={{
      height: ED.tafH, boxSizing: "border-box",
      border: `1px solid ${th.line}`, borderRadius: 10,
      background: th.card, padding: "16px 16px 16px 18px",
      opacity: e, transform: `translateY(${(1 - e) * 14}px)`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
      }}>
        <span style={{
          fontFamily: R.fontMono, fontSize: 13, fontWeight: 600,
          color: th.accentInk, background: th.accentSoft,
          padding: "2px 8px", borderRadius: 4,
        }}>{AYAH.ref}</span>
        <span style={{
          fontFamily: R.fontSans, fontSize: 14, fontWeight: 500,
          color: th.ink3, fontStyle: "italic",
        }}>{SOURCES[0].note}</span>
      </div>

      <div style={{ position: "relative" }}>
        <div style={{
          display: "flex", flexDirection: "column", gap: 11,
          opacity: 1 - done,
        }}>
          <div style={line("92%")} /><div style={line("75%")} /><div style={line("55%")} />
        </div>
        <div style={{
          position: "absolute", left: 0, right: 0, top: 0,
          fontFamily: R.fontSerif, fontSize: 17, lineHeight: 1.8, color: th.ink2,
          opacity: done, transform: `translateY(${(1 - done) * 6}px)`,
        }}>
          {TAFSIR_TEXT.map((p) => (
            <p key={p} style={{ margin: "0 0 10px" }}>{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── The note, growing ────────────────────────────────────────────────────*/

const Suggest: React.FC<{
  f: number; from: number; rows: { icon: string; title: string; desc: string }[];
}> = ({ f, from, rows }) => {
  const th = useTheme();
  const o = interpolate(f, [from, from + 20], [0, 1], clamp);
  return (
    <div style={{
      opacity: o, transform: `translateY(${(1 - o) * -8}px)`,
      background: th.card, border: `1px solid ${th.lineStrong}`,
      borderRadius: 10, boxShadow: th.shadowLg, padding: 8, boxSizing: "border-box",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      {rows.map((r, i) => (
        <div key={r.title} style={{
          display: "flex", alignItems: "center", gap: 14, height: 100,
          padding: "0 14px", borderRadius: 6,
          background: i === 0 ? th.panel : "transparent", boxSizing: "border-box",
        }}>
          <span style={{ fontSize: 24 }}>{r.icon}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{
              display: "block", fontFamily: R.fontSans, fontSize: 21,
              fontWeight: 600, color: th.ink,
            }}>{r.title}</span>
            <span style={{
              display: "block", fontFamily: R.fontSans, fontSize: 15,
              color: th.ink3, marginTop: 2,
            }}>{r.desc}</span>
          </span>
        </div>
      ))}
    </div>
  );
};

const Editor: React.FC<{
  f: number; s: number;
  cmd?: string; caret?: boolean; menuFrom?: number; menuRows?: number;
  ayah?: number; tafsir?: boolean;
}> = ({ f, s, cmd, caret, menuFrom, menuRows = 1, ayah, tafsir }) => {
  const th = useTheme();
  return (
    <div style={{
      padding: ED.pad, height: "100%", boxSizing: "border-box",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ height: ED.headH, flexShrink: 0 }}>
        <div style={{
          fontFamily: R.fontSerif, fontSize: 38, fontWeight: 700,
          color: th.ink, letterSpacing: "-0.012em", lineHeight: 1.2,
        }}>
          <Words f={f} start={s} text="Al-Fātiḥah — the seven" step={8} />
        </div>
        <Rise f={f} start={s} i={2} style={{
          fontFamily: R.fontSans, fontSize: 19, color: th.ink4, marginTop: 12,
        }}>Study note · 14 February</Rise>
      </div>

      <Rise f={f} start={s} i={3} style={{
        height: ED.proseH, flexShrink: 0,
        fontFamily: R.fontSans, fontSize: 21, lineHeight: 1.62, color: th.ink2,
      }}>
        The sūrah is seven verses, and it is named as-Sabʿ al-Mathānī. The
        naming is not in al-Fātiḥah itself — it is given elsewhere.
      </Rise>

      {ayah !== undefined && <AyahBlockView f={f} s={ayah} />}
      {tafsir && <TafsirBlockView f={f} />}

      {cmd !== undefined && (
        <div style={{
          height: ED.lineH, flexShrink: 0, display: "flex", alignItems: "center",
          fontFamily: R.fontSans, fontSize: 26, color: th.accentInk,
        }}>
          {cmd}
          {caret && (
            <span style={{
              display: "inline-block", width: 2, height: 28, background: th.ink,
              marginLeft: 3, opacity: Math.floor(f / 18) % 2 === 0 ? 1 : 0,
            }} />
          )}
        </div>
      )}

      {menuFrom !== undefined && (
        <div style={{
          marginTop: ED.menuGap,
          height: menuRows === 1 ? ED.menuH : ED.menuH2, flexShrink: 0,
        }}>
          <Suggest f={f} from={menuFrom} rows={
            menuRows === 1
              ? [{ icon: "📖", title: "Ayah block", desc: "Embed a Qurʾanic verse (e.g. /ayah 2:255)" }]
              : SOURCES.map((x) => ({ icon: "📚", title: x.title, desc: x.note }))
          } />
        </div>
      )}
    </div>
  );
};

/* ── The mode switch ──────────────────────────────────────────────────────*/

const ModeSwitch: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const k = interpolate(f, [T.modeClick, T.modeClick + 16], [0, 1], clamp);
  return (
    <div style={{
      height: "100%", padding: "0 34px", boxSizing: "border-box",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18,
    }}>
      <div>
        <Rise f={f} start={s} i={0} style={{
          fontFamily: R.fontSans, fontSize: 24, fontWeight: 600, color: th.ink,
        }}>{k > 0.5 ? "Canvas" : "Editor"}</Rise>
        <Rise f={f} start={s} i={1} style={{
          fontFamily: R.fontSans, fontSize: 17, color: th.ink3, marginTop: 4,
        }}>{k > 0.5 ? "Draw on the muṣḥaf" : "Type your notes"}</Rise>
      </div>
      <Rise f={f} start={s} i={2}>
        <div style={{
          width: 96, height: 50, borderRadius: 25,
          background: k > 0.5 ? th.accent : th.panel2,
          border: `1px solid ${th.lineStrong}`, position: "relative", boxSizing: "border-box",
        }}>
          <div style={{
            position: "absolute", top: 4, left: 5 + k * 46,
            width: 40, height: 40, borderRadius: "50%", background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            display: "grid", placeItems: "center", fontSize: 17,
          }}>{k > 0.5 ? "✎" : "⌨"}</div>
        </div>
      </Rise>
    </div>
  );
};

/* ── The muṣḥaf, and the marks made on it ─────────────────────────────────*/

/** The rail's six tools, drawn rather than borrowed from the emoji table so
 *  they share one weight and one optical size. */
const ToolIcon: React.FC<{ id: string }> = ({ id }) => {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7,
              strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="21" height="21" viewBox="0 0 24 24">
      {id === "hand" && (
        <path {...p} d="M6 11V6.5a1.3 1.3 0 0 1 2.6 0V10 M8.6 9.6V5a1.3 1.3 0 0 1 2.6 0v4.6
          M11.2 9.4V5.6a1.3 1.3 0 0 1 2.6 0v4.4 M13.8 10.6V7.4a1.3 1.3 0 0 1 2.6 0v5.4
          c0 3.6-2.4 6.2-6 6.2-2.9 0-4.4-1.3-5.6-3.5L3.4 13c-.6-1 .7-2 1.6-1.2l1.3 1.2" />
      )}
      {id === "pen" && <path {...p} d="M4 20l3.5-1L19 7.5a2.1 2.1 0 0 0-3-3L4.5 16 4 20z" />}
      {id === "highlight" && (
        <g {...p}><path d="M9 14l-3 3 1.5 2.5H12l1.5-2.5-3-3z" />
          <path d="M10.5 13.5L18 6a1.8 1.8 0 0 1 2.6 2.6l-7.5 7.5" /></g>
      )}
      {id === "arrow" && <path {...p} d="M6 18L18 6M10 6h8v8" />}
      {id === "text" && <path {...p} d="M5 6h14M12 6v13M9 19h6" />}
      {id === "eraser" && (
        <g {...p}><path d="M8 19h11" /><path d="M15.5 4.5l4 4a1.8 1.8 0 0 1 0 2.6L11 19.6 5 13.6 13 5.6a1.8 1.8 0 0 1 2.5-1.1z" /></g>
      )}
    </svg>
  );
};

const Mushaf: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const active =
    f >= T.txtTool ? "text" : f >= T.arrTool ? "arrow"
    : f >= T.penTool ? "pen" : f >= T.hlTool ? "highlight" : "hand";

  const hl  = interpolate(f, [T.hlDraw, T.hlDraw + T.hlFor], [0, 1], clamp);
  const pen = interpolate(f, [T.penDraw, T.penDraw + T.penFor], [0, 1], clamp);
  const arr = interpolate(f, [T.arrDraw, T.arrDraw + T.arrFor], [0, 1], clamp);
  const txtIn = interpolate(f, [T.txtDraw, T.txtDraw + 18], [0, 1], clamp);

  const pageX = MUS.pad + MUS.railW + 20;
  const pageW = 840 - pageX - MUS.pad;
  const ARR_LEN = Math.hypot(MARK.arr.x1 - MARK.arr.x0, MARK.arr.y1 - MARK.arr.y);

  return (
    <div style={{ height: "100%", position: "relative" }}>
      {/* Tool rail — the app's six tools, in the app's order. */}
      <div style={{
        position: "absolute", left: MUS.pad, top: MUS.pad,
        width: MUS.railW, borderRadius: 14,
        background: th.panel, border: `1px solid ${th.line}`,
        padding: "10px 0", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 12,
      }}>
        {TOOLS.map((t) => {
          const on = t.id === active;
          return (
            <div key={t.id} style={{
              width: 44, height: 44, borderRadius: 10,
              display: "grid", placeItems: "center",
              background: on ? th.accent : "transparent",
              color: on ? "#fff" : th.ink3,
            }}><ToolIcon id={t.id} /></div>
          );
        })}
      </div>

      {/* The sheet */}
      <div style={{ position: "absolute", left: pageX, top: MUS.pad, width: pageW }}>
        <Rise f={f} start={s} i={0} style={{
          height: MUS.headH, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          borderBottom: `1px solid ${th.line}`, marginBottom: 24,
        }}>
          <div style={{ fontFamily: R.fontArabic, fontSize: 34, color: th.ink }}>
            سُورَةُ الفَاتِحَة
          </div>
          <div style={{
            fontFamily: R.fontSans, fontSize: 15, color: th.ink4, marginTop: 6,
            letterSpacing: "0.08em",
          }}>AL-FĀTIḤAH · 7 ĀYĀT</div>
        </Rise>

        {FATIHA.map((ln, i) => (
          <Rise key={i} f={f} start={s} i={1 + i} style={{
            height: MUS.lineH, display: "flex", alignItems: "center",
            justifyContent: "flex-end", gap: 12,
          }}>
            <div dir="rtl" style={{
              fontFamily: R.fontArabic, fontSize: 31, lineHeight: 1.9,
              color: th.ink, textAlign: "right",
            }}>{ln}</div>
            <span style={{
              fontFamily: R.fontMono, fontSize: 13, color: th.ink4, flexShrink: 0,
            }}>{i + 1}</span>
          </Rise>
        ))}
      </div>

      {/* ── The marks. Each is drawn, never pasted. ── */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox={`0 0 840 ${MUS_H}`}>
        {/* Highlighter: a wide translucent stroke, laid right to left. */}
        {hl > 0 && (
          <line
            x1={MARK.hl.x1} y1={MARK.hl.y + MARK.hl.h / 2}
            x2={MARK.hl.x1 - (MARK.hl.x1 - MARK.hl.x0) * hl} y2={MARK.hl.y + MARK.hl.h / 2}
            stroke={INK.highlight} strokeWidth={MARK.hl.h}
            strokeOpacity={0.42} strokeLinecap="butt" />
        )}
        {/* Pen: an underline, drawn the same way a hand would. */}
        {pen > 0 && (
          <line
            x1={MARK.pen.x1} y1={MARK.pen.y}
            x2={MARK.pen.x1 - (MARK.pen.x1 - MARK.pen.x0) * pen} y2={MARK.pen.y}
            stroke={INK.pen} strokeWidth={3.5} strokeLinecap="round" />
        )}
        {/* Arrow, tail first, head last. */}
        {arr > 0 && (
          <g>
            <line x1={MARK.arr.x0} y1={MARK.arr.y}
              x2={MARK.arr.x0 + (MARK.arr.x1 - MARK.arr.x0) * arr}
              y2={MARK.arr.y + (MARK.arr.y1 - MARK.arr.y) * arr}
              stroke={INK.penRed} strokeWidth={3} strokeLinecap="round" />
            {arr > 0.82 && (
              <polygon
                points={`${MARK.arr.x1},${MARK.arr.y1} ${MARK.arr.x1 - 16},${MARK.arr.y1 + 4} ${MARK.arr.x1 - 6},${MARK.arr.y1 + 15}`}
                fill={INK.penRed}
                opacity={interpolate(arr, [0.82, 1], [0, 1], clamp)} />
            )}
          </g>
        )}
      </svg>

      {/* Text box, typed in place. */}
      {txtIn > 0 && (
        <div style={{
          position: "absolute", left: MARK.txt.x, top: MARK.txt.y,
          width: MARK.txt.w, minHeight: MARK.txt.h, boxSizing: "border-box",
          border: `2px dashed ${INK.penRed}`, borderRadius: 8,
          padding: "12px 14px", opacity: txtIn,
          fontFamily: R.fontSans, fontSize: 19, color: INK.penRed, lineHeight: 1.4,
        }}>
          {typed(MARK_TEXT, f, T.txtDraw, T.txtCps)}
          <span style={{
            display: "inline-block", width: 2, height: 20,
            background: INK.penRed, marginLeft: 2,
            opacity: f < T_END.txt + 40 && Math.floor(f / 16) % 2 === 0 ? 1 : 0,
          }} />
        </div>
      )}
    </div>
  );
};

/* ── Closing ──────────────────────────────────────────────────────────────*/

const Done: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  return (
    <div style={{
      height: "100%", display: "flex", alignItems: "center",
      justifyContent: "center", gap: 14,
    }}>
      <Rise f={f} start={s} i={0}>
        <span style={{ fontSize: 26, color: th.accent }}>✓</span>
      </Rise>
      <div style={{ fontFamily: R.fontSans, fontSize: 26, fontWeight: 600, color: th.ink }}>
        <Words f={f} start={s + 3} text="Al-Fātiḥah, studied" step={6} />
      </div>
    </div>
  );
};

const Cta: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      <Rise f={f} start={s} i={0} style={{ marginBottom: 20 }}><Mark size={58} /></Rise>
      <div style={{ fontFamily: R.fontSerif, fontSize: 44, color: th.ink, letterSpacing: "-0.022em" }}>
        <Words f={f} start={s + 4} text="Tafsir Lab" step={7} />
      </div>
      <Rise f={f} start={s} i={3} style={{
        display: "flex", alignItems: "center", gap: 14, marginTop: 24, width: 300,
      }}>
        <div style={{ flex: 1, height: 1, background: th.lineStrong }} />
        <div style={{ color: th.ink4, fontSize: 13 }}>◆</div>
        <div style={{ flex: 1, height: 1, background: th.lineStrong }} />
      </Rise>
      <div style={{ fontFamily: R.fontSans, fontSize: 27, color: th.accentInk, marginTop: 24 }}>
        <Words f={f} start={s + 26} text="Join the waitlist." step={7} />
      </div>
    </div>
  );
};

const TitleCard: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const rule = interpolate(f, [s + 26, s + 60], [0, 168], clamp);
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 4,
    }}>
      <Rise f={f} start={s} i={0} style={{ marginBottom: 22 }}><Mark size={64} /></Rise>
      <div style={{ fontFamily: R.fontSerif, fontSize: 50, color: th.ink, letterSpacing: "-0.025em" }}>
        <Words f={f} start={s + 5} text="Tafsir Lab" step={7} />
      </div>
      <div style={{
        fontFamily: R.fontSans, fontSize: 24, color: th.accent,
        letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 12,
      }}>
        <Words f={f} start={s + 16} text="Study" step={7} />
      </div>
      <div style={{ width: rule, height: 2, background: th.accent, borderRadius: 2, marginTop: 26 }} />
    </div>
  );
};

/* ── Composition ──────────────────────────────────────────────────────────*/

const Body: React.FC = () => {
  const f = useCurrentFrame();
  const m = morphAt(f, S);

  const render = (key: string, start: number) => {
    switch (key) {
      case "dock":     return <DockIcon f={f} />;
      case "window":   return <Window f={f} s={start} />;
      case "note":     return <Editor f={f} s={start} />;
      case "ayahCmd":  return (
        <Editor f={f} s={start} caret
          cmd={typed(AYAH_CMD, f, T.ayahStart, T.ayahCps)} />
      );
      case "ayahMenu": return (
        <Editor f={f} s={start} caret cmd={AYAH_CMD}
          menuFrom={S[IX.ayahMenu].at - S[IX.ayahMenu].morph} />
      );
      case "ayah":     return <Editor f={f} s={start} ayah={S[IX.ayah].at - 14} />;
      case "tafCmd":   return (
        <Editor f={f} s={start} ayah={S[IX.ayah].at - 14} caret
          cmd={typed(TAF_CMD, f, T.tafStart, T.tafCps)} />
      );
      case "tafMenu":  return (
        <Editor f={f} s={start} ayah={S[IX.ayah].at - 14} caret cmd={TAF_CMD}
          menuFrom={S[IX.tafMenu].at - S[IX.tafMenu].morph} menuRows={2} />
      );
      case "tafsir":   return <Editor f={f} s={start} ayah={S[IX.ayah].at - 14} tafsir />;
      case "mode":     return <ModeSwitch f={f} s={start} />;
      case "mushaf":   return <Mushaf f={f} s={start} />;
      case "done":     return <Done f={f} s={start} />;
      case "cta":      return <Cta f={f} s={start} />;
      case "title":    return <TitleCard f={f} s={start} />;
      default: return null;
    }
  };

  /* The pointer exists while the product is being operated: from reaching for
     the dock icon to the last mark on the muṣḥaf. */
  const cur = interpolate(f, [60, 100, 2760, 2820], [0, 1, 1, 0], clamp);

  return (
    <>
      <Desktop f={f} />
      <Card m={m}>
        {m.old && m.old.opacity > 0.01 && (
          <div style={{
            position: "absolute", inset: 0, opacity: m.old.opacity,
            transform: `translate(${m.old.x}px, ${m.old.y}px) rotate(${m.old.rot}deg)`,
            filter: m.old.blur > 0.05 ? `blur(${m.old.blur}px)` : undefined,
          }}>
            {render(m.old.key, -9999)}
          </div>
        )}
        <div style={{
          position: "absolute", inset: 0, opacity: m.now.opacity,
          transform: `translate(${m.now.x}px, ${m.now.y}px)`,
        }}>
          {render(m.now.key, m.contentStart)}
        </div>
      </Card>

      {SAYS.map((x) => (
        <Say key={x.from} f={f} from={x.from} to={x.to} text={x.text} top={x.top} />
      ))}

      {cur > 0.01 && (
        <div style={{ opacity: cur }}><SmearCursor f={f} legs={LEGS} /></div>
      )}
    </>
  );
};

const Sfx: React.FC<{ at: number; file: string; v: number; len?: number }> =
({ at, file, v, len = 26 }) => (
  <Sequence from={at} durationInFrames={len}>
    <Audio src={staticFile(file)} volume={v} />
  </Sequence>
);

export const SurahStudy: React.FC = () => (
  <ThemeProvide value={LIGHT}>
    <AbsoluteFill style={{ background: LIGHT.stage }}>
      <Stage theme={LIGHT}><Body /></Stage>

      <Audio
        src={staticFile("bg.mp3")}
        volume={(fr) =>
          0.28 * interpolate(fr, [0, 120, STUDY_FRAMES - 120, STUDY_FRAMES], [0, 1, 1, 0], clamp)}
      />

      {/* Typing: the two commands, and the note written on the muṣḥaf. */}
      <Sequence from={T.ayahStart} durationInFrames={T_END.ayah - T.ayahStart + 10}>
        <Audio src={staticFile("sfx/typing.mp3")} volume={0.36} />
      </Sequence>
      <Sequence from={T.tafStart} durationInFrames={T_END.taf - T.tafStart + 10}>
        <Audio src={staticFile("sfx/typing.mp3")} volume={0.36} />
      </Sequence>
      <Sequence from={T.txtDraw} durationInFrames={T_END.txt - T.txtDraw + 10}>
        <Audio src={staticFile("sfx/typing.mp3")} volume={0.30} />
      </Sequence>

      {LEGS.filter((l) => l.click).map((l) => (
        MAGNETIC.has(l.at)
          ? <Sfx key={l.at} at={l.at} file="sfx/magnetic.mp3" v={0.62} len={14} />
          : <Sfx key={l.at} at={l.at} file="sfx/click.mp3" v={0.38} len={18} />
      ))}

      {FALLS.map((at) => (
        <Sfx key={`fall-${at}`} at={at} file="sfx/granular.mp3" v={0.45} len={22} />
      ))}

      {/* The launch, the mode change, and the muṣḥaf arriving. */}
      <Sfx at={S[IX.window].at - S[IX.window].morph} file="sfx/whoosh.mp3" v={0.5} len={56} />
      <Sfx at={S[IX.mode].at - S[IX.mode].morph} file="sfx/whoosh.mp3" v={0.34} len={48} />
      <Sfx at={S[IX.mushaf].at - S[IX.mushaf].morph} file="sfx/whoosh.mp3" v={0.44} len={56} />
      <Sfx at={S[IX.cta].at - S[IX.cta].morph} file="sfx/whoosh.mp3" v={0.28} len={44} />
    </AbsoluteFill>
  </ThemeProvide>
);
