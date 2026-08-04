import React from "react";
import {
  AbsoluteFill, Sequence, Audio, staticFile,
  useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import { typed } from "./parts";
import { morphAt, Card, Words, Rise, useTheme, ThemeProvide, LIGHT } from "./morph";
import {
  TOOLS_FRAMES, STATES as S, IX, TILE, T, NOTE_TEXT, WB_MARKS,
  BOOKS, BOOK_TONE, COMMANDS, CMD_ROW_H, WB_VIEW,
} from "./toolsSpec";

export { TOOLS_FRAMES };

/* ── Every tool ────────────────────────────────────────────────────────────
   One object on a flat stage, morphing from each tool to the next. Nothing is
   explained and no screen is shown whole: each tool is opened, glimpsed, and
   put away. The container is the icon, the window, and the next icon.       */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease3 = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/* ── Icon tiles ───────────────────────────────────────────────────────────
   Line-art at one weight and one optical size, so a tile becoming another
   tile changes the drawing and nothing else. */

const Glyph: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 140 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48"
    fill="none" stroke="currentColor" strokeWidth={2.3}
    strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

/** A full-bleed tile, so an "app icon" reads as an icon and not as a card with
 *  something small in the middle. */
const Tile: React.FC<{
  f: number; s: number; bg: string; fg: string; children: React.ReactNode;
}> = ({ f, s, bg, fg, children }) => {
  const e = ease3((f - s) / 20);
  return (
    <div style={{
      position: "absolute", inset: 0, background: bg, color: fg,
      display: "grid", placeItems: "center",
      transform: `scale(${0.86 + e * 0.14})`, opacity: e,
    }}>{children}</div>
  );
};

const MarkTile: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  return (
    <Tile f={f} s={s} bg={th.ink} fg={th.card}>
      <span style={{ fontFamily: R.fontSans, fontSize: 152, fontWeight: 700 }}>T</span>
    </Tile>
  );
};

const PadTile: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  return (
    <Tile f={f} s={s} bg={th.panel} fg={th.ink}>
      <Glyph d={<>
        <path d="M12 6h18l6 6v30H12z" />
        <path d="M30 6v6h6" />
        <path d="M18 22h12M18 29h12M18 36h7" />
      </>} />
    </Tile>
  );
};

const WbTile: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  return (
    <Tile f={f} s={s} bg={th.panel} fg={th.ink}>
      <Glyph d={<>
        <rect x="7" y="10" width="34" height="24" rx="3" />
        <path d="M24 34v6M18 40h12" />
        <path d="M14 26c4-9 8 4 12-4s5 6 8 2" />
      </>} />
    </Tile>
  );
};

const LibTile: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  return (
    <Tile f={f} s={s} bg={th.panel} fg={th.ink}>
      <Glyph d={<>
        <rect x="9" y="11" width="8" height="27" rx="1.5" />
        <rect x="20" y="11" width="8" height="27" rx="1.5" />
        <path d="M31.5 12.6l7 1.6-5.4 25-7-1.6z" />
        <path d="M7 41h34" />
      </>} />
    </Tile>
  );
};

const SlashTile: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  return (
    <Tile f={f} s={s} bg={th.accent} fg="#fff">
      <span style={{ fontFamily: R.fontSans, fontSize: 168, fontWeight: 600, lineHeight: 1 }}>/</span>
    </Tile>
  );
};

/* ── The three windows ────────────────────────────────────────────────────*/

const PadOpen: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const body = typed(NOTE_TEXT, f, T.padType, T.padCps);
  return (
    <div style={{ padding: 44, height: "100%", boxSizing: "border-box" }}>
      <div style={{
        fontFamily: R.fontSerif, fontSize: 40, fontWeight: 700, color: th.ink,
        letterSpacing: "-0.012em",
      }}>
        <Words f={f} start={s} text="As-Sabʿ al-Mathānī" step={8} />
      </div>
      <Rise f={f} start={s} i={2} style={{
        fontFamily: R.fontSans, fontSize: 19, color: th.ink4, marginTop: 10,
      }}>Study note</Rise>
      <div style={{
        fontFamily: R.fontSans, fontSize: 25, lineHeight: 1.6, color: th.ink2,
        marginTop: 30, minHeight: 120,
      }}>
        {body}
        <span style={{
          display: "inline-block", width: 2, height: 26, background: th.ink,
          marginLeft: 3, verticalAlign: "text-bottom",
          opacity: Math.floor(f / 16) % 2 === 0 ? 1 : 0,
        }} />
      </div>
      <Rise f={f} start={s} i={5} style={{
        marginTop: 26, display: "flex", gap: 10,
      }}>
        {["Al-Fātiḥah 1:1", "Al-Ḥijr 15:87"].map((v) => (
          <span key={v} style={{
            fontFamily: R.fontSans, fontSize: 17, color: th.accentInk,
            background: th.accentSoft, padding: "7px 14px", borderRadius: 999,
          }}>{v}</span>
        ))}
      </Rise>
    </div>
  );
};

/** Marks appear in the order a hand would make them, each drawing itself. */
const WbOpen: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const P = (i: number) =>
    interpolate(f, [T.wbFrom + i * T.wbStep, T.wbFrom + i * T.wbStep + T.wbFor], [0, 1], clamp);
  const ink = ["#2563eb", "#dc2626", "#16a34a", "#7c3aed", "#18181b"];
  return (
    <div style={{ padding: 40, height: "100%", boxSizing: "border-box", position: "relative" }}>
      {/* Faint grid, the way a board reads before anything is on it. */}
      <div style={{
        position: "absolute", inset: 40, borderRadius: 12,
        backgroundImage:
          `linear-gradient(${th.line} 1px, transparent 1px),
           linear-gradient(90deg, ${th.line} 1px, transparent 1px)`,
        backgroundSize: "44px 44px",
      }} />
      <svg viewBox={`0 0 ${WB_VIEW.w} ${WB_VIEW.h}`} preserveAspectRatio="none"
        style={{ position: "absolute", inset: 40 }}
        width="100%" height="100%" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {WB_MARKS.map((m, i) => {
          const p = P(i);
          if (p <= 0) return null;
          const c = ink[i % ink.length];
          if (m.kind === "box") return (
            <rect key={i} x={m.x} y={m.y} width={m.w * p} height={m.h} rx="10"
              stroke={c} strokeWidth={4} />
          );
          if (m.kind === "circle") return (
            <ellipse key={i} cx={m.x + m.w / 2} cy={m.y + m.h / 2}
              rx={(m.w / 2) * p} ry={(m.h / 2) * p} stroke={c} strokeWidth={4} />
          );
          if (m.kind === "arrow") return (
            <g key={i} stroke={c} strokeWidth={4}>
              <line x1={m.x} y1={m.y} x2={m.x + m.w * p} y2={m.y} />
              {p > 0.8 && <polyline points={`${m.x + m.w - 18},${m.y - 12} ${m.x + m.w},${m.y} ${m.x + m.w - 18},${m.y + 12}`} />}
            </g>
          );
          if (m.kind === "line") return (
            <line key={i} x1={m.x} y1={m.y} x2={m.x + m.w * p} y2={m.y}
              stroke={c} strokeWidth={4} strokeOpacity={0.35} />
          );
          const len = 900;
          return (
            <path key={i}
              d={`M${m.x} ${m.y + m.h} q80 -${m.h} 160 -10 t150 -20 t210 30`}
              stroke={c} strokeWidth={4}
              strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
          );
        })}
      </svg>
    </div>
  );
};

const LibOpen: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  return (
    <div style={{
      padding: "30px 34px 26px", height: "100%", boxSizing: "border-box",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        fontFamily: R.fontSans, fontSize: 15, color: th.ink4,
        letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 20,
      }}>
        <Words f={f} start={s} text="Library" step={7} />
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "flex-end", flex: 1 }}>
        {BOOKS.map((b, i) => {
          const e = ease3((f - (T.libFrom + i * T.libStep)) / 26);
          const tone = BOOK_TONE[b.cat] ?? "#7a7a7a";
          return (
            <div key={b.en} style={{
              flex: 1, height: 340, borderRadius: 8,
              background: th.card, border: `1px solid ${th.line}`,
              boxShadow: th.shadowMd, overflow: "hidden",
              display: "flex", flexDirection: "column",
              opacity: e, transform: `translateY(${(1 - e) * 46}px)`,
            }}>
              {/* The spine, coloured by the science it belongs to. */}
              <div style={{ height: 10, background: tone }} />
              {/* A cover, not a poster: title block, rule, attribution. The
                  author was pushed to the floor with margin-top:auto, which
                  left a hole through the middle of every book. */}
              <div style={{
                flex: 1, padding: "20px 14px 16px",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div dir="rtl" style={{
                  fontFamily: R.fontArabic, fontSize: 25, lineHeight: 1.5,
                  color: th.ink, textAlign: "center",
                }}>{b.ar}</div>
                <div style={{
                  fontFamily: R.fontSans, fontSize: 14, lineHeight: 1.35,
                  color: th.ink2, textAlign: "center",
                }}>{b.en}</div>
                <div style={{
                  width: 34, height: 1, background: th.line, margin: "4px auto",
                }} />
                <div style={{
                  fontFamily: R.fontSans, fontSize: 12, lineHeight: 1.35,
                  color: th.ink4, textAlign: "center",
                }}>{b.by}</div>
                <div style={{
                  fontFamily: R.fontSans, fontSize: 11, color: tone,
                  textAlign: "center", letterSpacing: "0.06em",
                }}>{b.cat.toUpperCase()}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Every command in the registry, run past at speed. */
const SlashOpen: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const HEAD = 92;
  const view = 940 - HEAD - 24;
  const total = COMMANDS.length * CMD_ROW_H;
  const scroll = interpolate(f, [T.slashFrom, T.slashFrom + T.slashFor],
    [0, Math.max(0, total - view)], clamp);
  return (
    <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>
      <div style={{
        height: HEAD, display: "flex", alignItems: "center", gap: 12,
        padding: "0 26px", borderBottom: `1px solid ${th.line}`, boxSizing: "border-box",
      }}>
        <span style={{
          fontFamily: R.fontSans, fontSize: 30, fontWeight: 600, color: th.accentInk,
        }}>/</span>
        <span style={{ fontFamily: R.fontSans, fontSize: 21, color: th.ink3 }}>
          {COMMANDS.length} commands
        </span>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: HEAD, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `translateY(${-scroll}px)` }}>
          {COMMANDS.map((c, i) => {
            /* The row under the reading line is the one lit, so the eye has
               something to hold while the rest streams past. */
            const centre = i * CMD_ROW_H - scroll + CMD_ROW_H / 2;
            const on = Math.abs(centre - view / 2) < CMD_ROW_H * 0.6;
            return (
              <div key={c.cmd} style={{
                height: CMD_ROW_H, display: "flex", alignItems: "center", gap: 16,
                padding: "0 26px", boxSizing: "border-box",
                background: on ? th.panel : "transparent",
              }}>
                <span style={{ fontSize: 22, width: 34, textAlign: "center" }}>{c.icon}</span>
                <span style={{
                  fontFamily: R.fontMono, fontSize: 19,
                  color: on ? th.accentInk : th.ink3, width: 150,
                }}>{c.cmd}</span>
                <span style={{
                  fontFamily: R.fontSans, fontSize: 20,
                  fontWeight: on ? 600 : 400, color: th.ink,
                }}>{c.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Wordmark: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const rule = interpolate(f, [s + 24, s + 58], [0, 200], clamp);
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        fontFamily: R.fontSerif, fontSize: 62, color: th.ink, letterSpacing: "-0.025em",
      }}>
        <Words f={f} start={s} text="Tafsir Lab" step={7} />
      </div>
      <div style={{ width: rule, height: 2, background: th.accent, borderRadius: 2, marginTop: 26 }} />
      <Rise f={f} start={s} i={5} style={{
        fontFamily: R.fontSans, fontSize: 22, color: th.ink3, marginTop: 24,
        letterSpacing: "0.14em", textTransform: "uppercase",
      }}>Every tool, in one place</Rise>
    </div>
  );
};

/* ── Composition ──────────────────────────────────────────────────────────*/

const Body: React.FC = () => {
  const f = useCurrentFrame();
  const m = morphAt(f, S);

  const render = (key: string, start: number) => {
    switch (key) {
      case "mark":      return <MarkTile f={f} s={start} />;
      case "padIcon":
      case "padMin":    return <PadTile f={f} s={start} />;
      case "padOpen":   return <PadOpen f={f} s={start} />;
      case "wbIcon":
      case "wbMin":     return <WbTile f={f} s={start} />;
      case "wbOpen":    return <WbOpen f={f} s={start} />;
      case "libIcon":
      case "libMin":    return <LibTile f={f} s={start} />;
      case "libOpen":   return <LibOpen f={f} s={start} />;
      case "slashIcon": return <SlashTile f={f} s={start} />;
      case "slashOpen": return <SlashOpen f={f} s={start} />;
      case "wordmark":  return <Wordmark f={f} s={start} />;
      default: return null;
    }
  };

  return (
    <Card m={m}>
      {m.old && m.old.opacity > 0.01 && (
        <div style={{
          position: "absolute", inset: 0, opacity: m.old.opacity,
          transform: `translate(${m.old.x}px, ${m.old.y}px)`,
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
  );
};

const Sfx: React.FC<{ at: number; file: string; v: number; len?: number }> =
({ at, file, v, len = 26 }) => (
  <Sequence from={at} durationInFrames={len}>
    <Audio src={staticFile(file)} volume={v} />
  </Sequence>
);

export const ToolsReel: React.FC = () => (
  <ThemeProvide value={LIGHT}>
    <AbsoluteFill style={{ background: LIGHT.stage }}>
      {/* A flat stage lifted in the middle, so the object always sits in light
          — the one piece of depth in the whole piece. */}
      <AbsoluteFill style={{
        background:
          `radial-gradient(58% 42% at 50% 46%, rgba(255,255,255,0.85), rgba(255,255,255,0) 70%)`,
      }} />
      <Body />

      <Audio
        src={staticFile("bg2.mp3")}
        startFrom={33 * 60}
        volume={(fr) =>
          0.18 * interpolate(fr, [0, 90, TOOLS_FRAMES - 90, TOOLS_FRAMES], [0, 1, 1, 0], clamp)}
      />

      {/* An icon becoming another icon snaps; a window opening or closing
          sweeps. The sound follows what the container is doing. */}
      {S.slice(1).map((st) => {
        const at = st.at - st.morph;
        const big = st.w > TILE.w;
        const closing = ["padMin", "wbMin", "libMin"].includes(st.key);
        if (big) return <Sfx key={st.key} at={at} file="sfx/whoosh.mp3" v={0.46} len={54} />;
        if (closing) return <Sfx key={st.key} at={at} file="sfx/granular.mp3" v={0.4} len={22} />;
        return <Sfx key={st.key} at={at} file="sfx/magnetic.mp3" v={0.6} len={14} />;
      })}

      <Sequence from={T.padType} durationInFrames={230}>
        <Audio src={staticFile("sfx/typing.mp3")} volume={0.34} />
      </Sequence>
      {WB_MARKS.map((_, i) => (
        <Sfx key={`wb${i}`} at={T.wbFrom + i * T.wbStep} file="sfx/click.mp3" v={0.26} len={14} />
      ))}
      {BOOKS.map((b, i) => (
        <Sfx key={b.en} at={T.libFrom + i * T.libStep} file="sfx/click.mp3" v={0.24} len={14} />
      ))}
    </AbsoluteFill>
  </ThemeProvide>
);
