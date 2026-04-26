import React from "react";
import { Composition } from "remotion";
import { TafsirTrailer } from "./TafsirTrailer";

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
    </>
  );
};
