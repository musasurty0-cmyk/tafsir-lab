/**
 * TafsirLab — app trailer (REAL capture footage + Remotion motion design).
 *
 * Uses the actual screen recordings (public/showcase/*.mp4, trimmed + sped by
 * ffmpeg) embedded via <OffthreadVideo>, wrapped in branded title/end cards,
 * animated lower-third captions, device frames for the two side-by-side "live
 * sync" sections, a sync pulse, and a global progress bar. So it genuinely
 * shows the app — just professionally framed.
 *
 * Footage lives in public/showcase (gitignored). Re-extract with the ffmpeg
 * script, then: npx remotion render remotion/index.ts AppTrailer out.mp4
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, FONTS } from "./theme";

export const APP_FPS = 30;

const LEN = {
  title:     78,
  makeGroup: 244,
  grid:      196,
  join:      210,
  promote:   244,
  sync:      362,
  notes:     298,
  annot:     362,
  channels:  298,
  end:       96,
};
export const APP_DURATION = Object.values(LEN).reduce((a, b) => a + b, 0);

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ── caption (lower-third over footage) ──────────────────────────────────────

const Caption: React.FC<{ eyebrow: string; title: string; dur: number; center?: boolean }> = ({ eyebrow, title, dur, center }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame: frame - 8, fps, config: { damping: 16 } });
  const outP = interpolate(frame, [dur - 18, dur - 6], [1, 0], CL);
  const op = Math.min(inP, outP);
  return (
    <div style={{
      position: "absolute",
      left: center ? "50%" : 84,
      bottom: 76,
      transform: `translateX(${center ? "-50%" : "0"}) translateY(${(1 - inP) * 22}px)`,
      opacity: op,
      background: "rgba(18,21,28,0.86)",
      borderRadius: 16,
      padding: "20px 30px",
      boxShadow: "0 18px 44px rgba(0,0,0,0.3)",
      textAlign: center ? "center" : "left",
      maxWidth: center ? undefined : 900,
    }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: 18, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8FD3B6", display: "flex", alignItems: "center", gap: 12, justifyContent: center ? "center" : "flex-start" }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, background: C.accent }} />{eyebrow}
      </div>
      <div style={{ fontFamily: FONTS.serif, fontSize: 44, fontWeight: 600, color: "#fff", marginTop: 8, letterSpacing: "-0.01em" }}>{title}</div>
    </div>
  );
};

// ── full-bleed footage section ──────────────────────────────────────────────

const Footage: React.FC<{ src: string; eyebrow: string; title: string; dur: number }> = ({ src, eyebrow, title, dur }) => {
  const frame = useCurrentFrame();
  const fade = Math.min(interpolate(frame, [0, 8], [0, 1], CL), interpolate(frame, [dur - 8, dur], [1, 0], CL));
  return (
    <AbsoluteFill style={{ background: C.bg, opacity: fade }}>
      <OffthreadVideo src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <Caption eyebrow={eyebrow} title={title} dur={dur} />
    </AbsoluteFill>
  );
};

// ── side-by-side (two devices) ──────────────────────────────────────────────

const DevicePanel: React.FC<{ src: string; x: number; w: number; label: string; labelColor: string; slide: number; fromLeft: boolean }> = ({ src, x, w, label, labelColor, slide, fromLeft }) => {
  const off = (1 - slide) * (fromLeft ? -80 : 80);
  return (
    <div style={{ position: "absolute", left: x + off, top: 214, width: w, opacity: slide }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 20, fontWeight: 600, letterSpacing: "0.08em", color: "#fff", background: labelColor, padding: "6px 16px", borderRadius: 8 }}>{label}</span>
      </div>
      <div style={{ width: w, borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <OffthreadVideo src={staticFile(src)} style={{ width: "100%", display: "block" }} />
      </div>
    </div>
  );
};

const SideBySide: React.FC<{ lap: string; tab: string; eyebrow: string; title: string; dur: number }> = ({ lap, tab, eyebrow, title, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = Math.min(interpolate(frame, [0, 10], [0, 1], CL), interpolate(frame, [dur - 10, dur], [1, 0], CL));
  const slide = spring({ frame: frame - 6, fps, config: { damping: 18, mass: 1 } });
  const pulse = (Math.sin(frame / 8) + 1) / 2;
  return (
    <AbsoluteFill style={{ background: C.dark, opacity: fade }}>
      <AbsoluteFill style={{ background: "radial-gradient(1000px 640px at 50% 44%, rgba(62,142,110,0.16), transparent 66%)" }} />
      <DevicePanel src={lap} x={70} w={870} label="LAPTOP" labelColor={C.accent} slide={slide} fromLeft />
      <DevicePanel src={tab} x={980} w={870} label="TABLET" labelColor={C.warm} slide={slide} fromLeft={false} />
      {/* sync pulse link */}
      <div style={{ position: "absolute", left: 900, top: 486, width: 120, height: 4, opacity: slide, background: `rgba(62,142,110,${0.35 + pulse * 0.5})`, boxShadow: `0 0 ${10 + pulse * 20}px rgba(62,142,110,0.85)` }} />
      <div style={{ position: "absolute", left: 960, top: 448, transform: "translateX(-50%)", fontFamily: FONTS.mono, fontSize: 15, letterSpacing: "0.14em", color: "rgba(246,244,238,0.72)", opacity: slide }}>SYNC</div>
      <Caption eyebrow={eyebrow} title={title} dur={dur} center />
    </AbsoluteFill>
  );
};

// ── title & end cards (vector) ──────────────────────────────────────────────

const Grain: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(1100px 700px at 82% -8%, rgba(201,138,45,0.06), transparent 60%), radial-gradient(900px 620px at -6% 24%, rgba(62,142,110,0.055), transparent 60%)" }} />
);

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 18, fps, config: { damping: 14, mass: 0.7 } });
  const bism = interpolate(frame, [4, 28], [0, 1], CL);
  const tag = interpolate(frame, [40, 62], [0, 1], CL);
  const fade = interpolate(frame, [LEN.title - 10, LEN.title], [1, 0], CL);
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", opacity: fade }}>
      <Grain />
      <div style={{ fontFamily: FONTS.arabic, fontSize: 46, color: C.ink2, opacity: bism, direction: "rtl", marginBottom: 40 }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>
      <div style={{ display: "flex", alignItems: "center", gap: 26, transform: `scale(${0.9 + pop * 0.1})`, opacity: pop }}>
        <div style={{ width: 100, height: 100, borderRadius: 24, background: C.ink, color: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.serif, fontSize: 58, fontWeight: 700, boxShadow: "0 24px 60px rgba(34,31,26,0.25)" }}>T</div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 108, fontWeight: 600, letterSpacing: "-0.02em" }}>Tafsir<span style={{ fontStyle: "italic", fontWeight: 400, color: C.ink2 }}>Lab</span></div>
      </div>
      <div style={{ fontFamily: FONTS.serif, fontSize: 38, color: C.ink2, marginTop: 38, opacity: tag }}>A collaborative study desk for the Qurʾān.</div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 12, fps, config: { damping: 14 } });
  const btn = spring({ frame: frame - 46, fps, config: { damping: 13 } });
  const fade = interpolate(frame, [0, 10], [0, 1], CL);
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", opacity: fade }}>
      <Grain />
      <div style={{ fontFamily: FONTS.arabic, fontSize: 36, color: C.ink3, marginBottom: 34, direction: "rtl", opacity: interpolate(frame, [2, 22], [0, 1], CL) }}>ٱقْرَأْ وَرَبُّكَ ٱلْأَكْرَمُ</div>
      <div style={{ fontFamily: FONTS.serif, fontSize: 92, fontWeight: 500, textAlign: "center", lineHeight: 1.08, opacity: pop, transform: `scale(${0.94 + pop * 0.06})` }}>
        Open the lab.<br /><span style={{ fontStyle: "italic", fontWeight: 400, color: C.accentInk }}>Begin the work.</span>
      </div>
      <div style={{ marginTop: 50, background: C.ink, color: C.bg, fontFamily: FONTS.sans, fontSize: 27, fontWeight: 600, padding: "19px 44px", borderRadius: 16, boxShadow: "0 26px 60px rgba(34,31,26,0.28)", opacity: btn, transform: `translateY(${(1 - btn) * 22}px)` }}>
        Start your study group — free forever →
      </div>
    </AbsoluteFill>
  );
};

// ── progress bar (global) ───────────────────────────────────────────────────

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const p = frame / APP_DURATION;
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, height: 5, width: `${p * 100}%`, background: C.accent, opacity: 0.9, zIndex: 100 }} />
  );
};

// ── composition ─────────────────────────────────────────────────────────────

export const AppTrailer: React.FC = () => {
  let at = 0;
  const seq = (len: number) => { const from = at; at += len; return { from, durationInFrames: len }; };
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONTS.sans }}>
      <Sequence {...seq(LEN.title)}><TitleCard /></Sequence>
      <Sequence {...seq(LEN.makeGroup)}><Footage src="showcase/makegroup.mp4" eyebrow="Step 1 · Make a group" title="Start a workspace in seconds" dur={LEN.makeGroup} /></Sequence>
      <Sequence {...seq(LEN.grid)}><Footage src="showcase/grid.mp4" eyebrow="Step 2 · The board" title="All 114 sūrahs, one workspace" dur={LEN.grid} /></Sequence>
      <Sequence {...seq(LEN.join)}><Footage src="showcase/join.mp4" eyebrow="Step 3 · Invite the circle" title="Share a code — they’re in" dur={LEN.join} /></Sequence>
      <Sequence {...seq(LEN.promote)}><Footage src="showcase/promote.mp4" eyebrow="Step 4 · Roles" title="You decide who does what" dur={LEN.promote} /></Sequence>
      <Sequence {...seq(LEN.sync)}><SideBySide lap="showcase/sync_lap.mp4" tab="showcase/sync_tab.mp4" eyebrow="Step 5 · Together, live" title="One document. Every device. Real time." dur={LEN.sync} /></Sequence>
      <Sequence {...seq(LEN.notes)}><Footage src="showcase/notes.mp4" eyebrow="Step 6 · Write" title="Notes, ʾāyah blocks & tafsīr" dur={LEN.notes} /></Sequence>
      <Sequence {...seq(LEN.annot)}><SideBySide lap="showcase/annot_lap.mp4" tab="showcase/annot_tab.mp4" eyebrow="Step 7 · Ink the Mushaf" title="Annotate together, in sync" dur={LEN.annot} /></Sequence>
      <Sequence {...seq(LEN.channels)}><Footage src="showcase/channels.mp4" eyebrow="Step 8 · Organise" title="A channel for every topic" dur={LEN.channels} /></Sequence>
      <Sequence {...seq(LEN.end)}><EndCard /></Sequence>
      <Progress />
    </AbsoluteFill>
  );
};
