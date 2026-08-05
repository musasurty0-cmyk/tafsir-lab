import React from "react";
import { Composition } from "remotion";
import { TafsirTrailer } from "./TafsirTrailer";
import { LinkReel, REEL_FRAMES } from "./reel/LinkReel";
import { TestReel, TEST_FRAMES } from "./reel/TestReel";
import { LinkTrailer, TRAILER_FRAMES } from "./reel/LinkTrailer";
import { SurahStudy, STUDY_FRAMES } from "./reel/SurahStudy";
import { ToolsReel, TOOLS_FRAMES } from "./reel/ToolsReel";
import { StrokeReel, STROKE_FRAMES } from "./reel/StrokeReel";
import { SearchReel, SEARCH_FRAMES } from "./reel/SearchReel";

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
        durationInFrames={TRAILER_FRAMES}
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
