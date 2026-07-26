import React from "react";
import { Composition } from "remotion";
import { Trailer, TRAILER_DURATION, TRAILER_FPS } from "./Trailer";
import { Showcase, SHOW_DURATION, SHOW_FPS } from "./Showcase";
import { AppTrailer, APP_DURATION, APP_FPS } from "./AppTrailer";
import { MasterTrailer, MASTER_DURATION, MASTER_FPS } from "./MasterTrailer";
import { Walkthrough, WALK_DURATION, WALK_FPS } from "./Walkthrough";
import { TafsirLabReel, REEL_DURATION, REEL_FPS } from "./reel/TafsirLabReel";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Instagram Reel #1 — vertical, white, one continuous camera. */}
      <Composition
        id="TafsirLabReel"
        component={TafsirLabReel}
        durationInFrames={REEL_DURATION}
        fps={REEL_FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Trailer"
        component={Trailer}
        durationInFrames={TRAILER_DURATION}
        fps={TRAILER_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Showcase"
        component={Showcase}
        durationInFrames={SHOW_DURATION}
        fps={SHOW_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="AppTrailer"
        component={AppTrailer}
        durationInFrames={APP_DURATION}
        fps={APP_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="MasterTrailer"
        component={MasterTrailer}
        durationInFrames={MASTER_DURATION}
        fps={MASTER_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Walkthrough"
        component={Walkthrough}
        durationInFrames={WALK_DURATION}
        fps={WALK_FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
