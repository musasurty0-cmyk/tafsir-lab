import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene1Opening } from "./scenes/Scene1Opening";
import { Scene2AppShell } from "./scenes/Scene2AppShell";
import { Scene3CanvasHero } from "./scenes/Scene3CanvasHero";
import { Scene3bDrawing } from "./scenes/Scene3bDrawing";
import { Scene4Editor } from "./scenes/Scene4Editor";
import { Scene5Tafsir } from "./scenes/Scene5Tafsir";
import { Scene6Collaboration } from "./scenes/Scene6Collaboration";
import { Scene7Closing } from "./scenes/Scene7Closing";

// ~70 seconds @ 30fps = 2100 frames
// Scene 3b (drawing) inserted after canvas hero; all later scenes shifted +270 frames
export const TafsirTrailer: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Scene 1: Opening logo      0–240   (8s) */}
      <Sequence from={0} durationInFrames={240}>
        <Scene1Opening />
      </Sequence>

      {/* Scene 2: App Shell         210–480  (8s, 30f crossfade) */}
      <Sequence from={210} durationInFrames={270}>
        <Scene2AppShell />
      </Sequence>

      {/* Scene 3: Canvas Hero       420–900  (16s) */}
      <Sequence from={420} durationInFrames={480}>
        <Scene3CanvasHero />
      </Sequence>

      {/* Scene 3b: Drawing/handwriting  870–1140  (9s, 30f crossfade) */}
      <Sequence from={870} durationInFrames={300}>
        <Scene3bDrawing />
      </Sequence>

      {/* Scene 4: Editor            1110–1380  (9s) */}
      <Sequence from={1110} durationInFrames={300}>
        <Scene4Editor />
      </Sequence>

      {/* Scene 5: Tafsir            1350–1560  (7s) */}
      <Sequence from={1350} durationInFrames={240}>
        <Scene5Tafsir />
      </Sequence>

      {/* Scene 6: Collaboration     1530–1830  (10s) */}
      <Sequence from={1530} durationInFrames={330}>
        <Scene6Collaboration />
      </Sequence>

      {/* Scene 7: Closing           1800–2100  (10s) */}
      <Sequence from={1800} durationInFrames={300}>
        <Scene7Closing />
      </Sequence>
    </AbsoluteFill>
  );
};
