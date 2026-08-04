import React from "react";
import { Composition } from "remotion";
import { TafsirTrailer } from "./TafsirTrailer";
import { LinkReel, REEL_FRAMES } from "./reel/LinkReel";
import { TestReel, TEST_FRAMES } from "./reel/TestReel";
import { LinkTrailer, TRAILER_FRAMES } from "./reel/LinkTrailer";

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
