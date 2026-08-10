import React from "react";
import { Composition } from "remotion";
import { TafsirTrailer } from "./TafsirTrailer";
import { LinkReel, REEL_FRAMES } from "./reel/LinkReel";
import { TestReel, TEST_FRAMES } from "./reel/TestReel";
import { LinkTrailer, TOTAL_FRAMES } from "./reel/LinkTrailer";
import { SurahStudy, STUDY_FRAMES } from "./reel/SurahStudy";
import { ToolsReel, TOOLS_FRAMES } from "./reel/ToolsReel";
import { StrokeReel, STROKE_FRAMES } from "./reel/StrokeReel";
import { SearchReel, SEARCH_FRAMES } from "./reel/SearchReel";
import { DosariReel, REEL_FRAMES as DOSARI_FRAMES } from "./reel/DosariReel";
import { LectureClip } from "./reel/LectureClip";
import { WordsNotNumber, WORDS_FRAMES } from "./reel/WordsNotNumber";
import { ReturnToTheAyah, RETURN_FRAMES } from "./reel/ReturnToTheAyah";
import { NoEffect, NOEFFECT_FRAMES } from "./reel/NoEffect";
import CLIP1 from "./reel/tafsir-clip1.json";
import CLIP2 from "./reel/tafsir-clip2.json";
import DGLAD from "./reel/dosari-glad.json";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TafsirTrailer"
        component={TafsirTrailer}
        durationInFrames={2100}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />

      {/* Reel — a subtitled clip of Shaykh Yasser al-Dosari, closing on the
          argument he is already making. 30fps to match the source footage. */}
      <Composition
        id="DosariReel"
        component={DosariReel}
        durationInFrames={DOSARI_FRAMES}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      {/* Two cuts from Ustadh AbdulRahman Hassan on what tafsir is and why
          learning it is obligatory. Same card geometry as DosariReel, no
          nasheed — these are continuous speech with no silence to fill. */}
      <Composition
        id="TafsirWhatItIs"
        component={LectureClip}
        durationInFrames={Math.round((CLIP1.clipSeconds + CLIP1.outroSeconds) * 25)}
        fps={25}
        width={1080}
        height={1920}
        defaultProps={CLIP1}
      />
      <Composition
        id="TafsirJustWords"
        component={LectureClip}
        durationInFrames={Math.round((CLIP2.clipSeconds + CLIP2.outroSeconds) * 25)}
        fps={25}
        width={1080}
        height={1920}
        defaultProps={CLIP2}
      />

      {/* Flagship v2 — physics, not states. Every flying object runs the
          tracked arc from searchCurves. */}
      <Composition
        id="NoEffect"
        component={NoEffect}
        durationInFrames={NOEFFECT_FRAMES}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      {/* One container, seven surfaces, and it comes back to the geometry it
          started in — the loop closes rather than replaying. */}
      <Composition
        id="ReturnToTheAyah"
        component={ReturnToTheAyah}
        durationInFrames={RETURN_FRAMES}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      {/* Reel 08 — you remember the wording, never the reference. Built on
          the app's own .qs-panel metrics and .qs-mark highlight. */}
      <Composition
        id="WordsNotNumber"
        component={WordsNotNumber}
        durationInFrames={WORDS_FRAMES}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      {/* Dosari 24:54-25:29 — the first glad tiding. Same bed as the first
          Dosari reel; 30fps to match the lecture. */}
      <Composition
        id="DosariGladTiding"
        component={LectureClip}
        durationInFrames={Math.round((DGLAD.clipSeconds + DGLAD.outroSeconds) * 30)}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DGLAD}
      />

      {/* Instagram Reel — 9:16, the /link feature end to end. */}
      <Composition
        id="LinkReel"
        component={LinkReel}
        durationInFrames={REEL_FRAMES}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      {/* Search, then the panels — browser bar, then a strip of them. */}
      <Composition
        id="SearchReel"
        component={SearchReel}
        durationInFrames={SEARCH_FRAMES}
        fps={60}
        width={1920}
        height={1080}
        defaultProps={{}}
      />

      {/* Eight strokes rearranged — no cuts, no fades, one continuous morph. */}
      <Composition
        id="StrokeReel"
        component={StrokeReel}
        durationInFrames={STROKE_FRAMES}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      {/* Every tool, glimpsed — icon, open, minimise, next. */}
      <Composition
        id="ToolsReel"
        component={ToolsReel}
        durationInFrames={TOOLS_FRAMES}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      {/* Studying a sūrah end to end, from the dock to the annotated muṣḥaf. */}
      <Composition
        id="SurahStudy"
        component={SurahStudy}
        durationInFrames={STUDY_FRAMES}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      {/* The Connections trailer — title, explanation, mode drop, end card. */}
      <Composition
        id="LinkTrailer"
        component={LinkTrailer}
        durationInFrames={TOTAL_FRAMES}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      {/* Technique test: one container morphing through every state. */}
      <Composition
        id="TestReel"
        component={TestReel}
        durationInFrames={TEST_FRAMES}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
    </>
  );
};
