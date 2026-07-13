/**
 * TafsirLab — product walkthrough (calm, step-by-step).
 *
 * Real capture footage for the flows the user wanted shown from the app —
 * creating a workspace, joining with a code, the surah grid, promoting
 * members, slash commands, and annotations (pen + notes-inside-words).
 * Built (animated) scenes for the rest, including the text-mode live sync.
 *
 * Paced as a walkthrough (slower footage, longer holds), ~94s @ 30fps, 1080p.
 *   Render: npx remotion render remotion/index.ts Walkthrough out.mp4 \
 *             --concurrency=2 --timeout=120000
 */

import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { C, FONTS } from "./theme";
import { STitle, SSync, SChannels, SEnd, LEN as A } from "./Showcase";
import { Footage } from "./AppTrailer";

export const WALK_FPS = 30;

// real-footage lengths (frames), kept just under each clip
const R = {
  create:    277,
  join:      268,
  grid:      237,
  promote:   261,
  slash:     298,
  annotate:  366,
  wordnotes: 340,
};

export const WALK_DURATION =
  A.title + R.create + R.join + R.grid + R.promote + R.slash +
  A.sync + R.annotate + R.wordnotes + A.channels + A.end;

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  return <div style={{ position: "absolute", bottom: 0, left: 0, height: 5, width: `${(frame / WALK_DURATION) * 100}%`, background: C.accent, opacity: 0.9, zIndex: 100 }} />;
};

export const Walkthrough: React.FC = () => {
  let at = 0;
  const seq = (len: number) => { const from = at; at += len; return { from, durationInFrames: len }; };
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONTS.sans }}>
      {/* built */}
      <Sequence {...seq(A.title)}><STitle /></Sequence>
      {/* real */}
      <Sequence {...seq(R.create)}>
        <Footage src="showcase/makegroup.mp4" eyebrow="Create a workspace" title="Name it, pick a type, done" dur={R.create} />
      </Sequence>
      {/* real */}
      <Sequence {...seq(R.join)}>
        <Footage src="showcase/join.mp4" eyebrow="Join with a code" title="Enter the invite code to join" dur={R.join} />
      </Sequence>
      {/* real */}
      <Sequence {...seq(R.grid)}>
        <Footage src="showcase/grid.mp4" eyebrow="Browse all 114 sūrahs" title="Every sūrah, one board" dur={R.grid} />
      </Sequence>
      {/* real */}
      <Sequence {...seq(R.promote)}>
        <Footage src="showcase/promote.mp4" eyebrow="Roles & permissions" title="Promote members to admin" dur={R.promote} />
      </Sequence>
      {/* real */}
      <Sequence {...seq(R.slash)}>
        <Footage src="showcase/slash.mp4" eyebrow="Slash commands" title="Type / for ayahs, tafsīr & blocks" dur={R.slash} />
      </Sequence>
      {/* built — text-mode live sync */}
      <Sequence {...seq(A.sync)}><SSync /></Sequence>
      {/* real */}
      <Sequence {...seq(R.annotate)}>
        <Footage src="showcase/annotate_single.mp4" eyebrow="Annotate the Mushaf" title="Ink directly on the page" dur={R.annotate} />
      </Sequence>
      {/* real */}
      <Sequence {...seq(R.wordnotes)}>
        <Footage src="showcase/wordnotes_single.mp4" eyebrow="Notes inside words" title="Tap a word to attach a note" dur={R.wordnotes} />
      </Sequence>
      {/* built */}
      <Sequence {...seq(A.channels)}><SChannels /></Sequence>
      {/* built */}
      <Sequence {...seq(A.end)}><SEnd /></Sequence>

      <Progress />
    </AbsoluteFill>
  );
};
