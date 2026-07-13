/**
 * TafsirLab — master trailer (mixed animated + real footage).
 *
 * Interleaves the polished animated scenes (Showcase: title, make-group, surah
 * grid, roles, end) with the real capture footage (AppTrailer: join, live sync,
 * notes, notes-inside-words, annotate, channels). Footage is slowed down for a
 * calmer pace, and a dedicated "notes inside words — in sync" section is added.
 *
 * ~108s @ 30fps, 1920×1080.
 *   Render: npx remotion render remotion/index.ts MasterTrailer out.mp4 \
 *             --concurrency=2 --timeout=120000
 *   (lower concurrency + higher timeout avoids transient OffthreadVideo
 *    frame-extraction timeouts when many clips are embedded.)
 */

import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { C, FONTS } from "./theme";
import {
  STitle, SMakeGroup, SSurahGrid, SPermissions, SEnd, LEN as A,
} from "./Showcase";
import { Footage, SideBySide } from "./AppTrailer";

export const MASTER_FPS = 30;

// real-footage section lengths (frames) — kept just under each clip's length
const R = {
  join:      268,
  sync:      446,
  notes:     386,
  wordnotes: 372,
  annotate:  426,
  channels:  364,
};

export const MASTER_DURATION =
  A.title + A.makeGroup + A.surahGrid + R.join + A.permissions +
  R.sync + R.notes + R.wordnotes + R.annotate + R.channels + A.end;

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, height: 5, width: `${(frame / MASTER_DURATION) * 100}%`, background: C.accent, opacity: 0.9, zIndex: 100 }} />
  );
};

export const MasterTrailer: React.FC = () => {
  let at = 0;
  const seq = (len: number) => { const from = at; at += len; return { from, durationInFrames: len }; };
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONTS.sans }}>
      {/* animated */}
      <Sequence {...seq(A.title)}><STitle /></Sequence>
      {/* animated */}
      <Sequence {...seq(A.makeGroup)}><SMakeGroup /></Sequence>
      {/* animated */}
      <Sequence {...seq(A.surahGrid)}><SSurahGrid /></Sequence>
      {/* real */}
      <Sequence {...seq(R.join)}>
        <Footage src="showcase/join.mp4" eyebrow="Invite the circle" title="Share a code — they’re in" dur={R.join} />
      </Sequence>
      {/* animated */}
      <Sequence {...seq(A.permissions)}><SPermissions /></Sequence>
      {/* real — side by side */}
      <Sequence {...seq(R.sync)}>
        <SideBySide lap="showcase/sync_lap.mp4" tab="showcase/sync_tab.mp4" eyebrow="Together, live" title="One document. Every device. Real time." dur={R.sync} />
      </Sequence>
      {/* real */}
      <Sequence {...seq(R.notes)}>
        <Footage src="showcase/notes.mp4" eyebrow="Write" title="Notes, ʾāyah blocks & tafsīr" dur={R.notes} />
      </Sequence>
      {/* real — side by side (NEW: notes inside words) */}
      <Sequence {...seq(R.wordnotes)}>
        <SideBySide lap="showcase/wordnotes_lap.mp4" tab="showcase/wordnotes_tab.mp4" eyebrow="Notes inside words" title="Tap a word, attach a note — synced" dur={R.wordnotes} />
      </Sequence>
      {/* real — side by side */}
      <Sequence {...seq(R.annotate)}>
        <SideBySide lap="showcase/annot_lap.mp4" tab="showcase/annot_tab.mp4" eyebrow="Ink the Mushaf" title="Annotate together, live" dur={R.annotate} />
      </Sequence>
      {/* real */}
      <Sequence {...seq(R.channels)}>
        <Footage src="showcase/channels.mp4" eyebrow="Organise" title="A channel for every topic" dur={R.channels} />
      </Sequence>
      {/* animated */}
      <Sequence {...seq(A.end)}><SEnd /></Sequence>

      <Progress />
    </AbsoluteFill>
  );
};
