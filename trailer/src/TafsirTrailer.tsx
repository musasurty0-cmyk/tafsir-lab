import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Scene1Opening } from "./scenes/Scene1Opening";
import { Scene2AppShell } from "./scenes/Scene2AppShell";
import { Scene3CanvasHero } from "./scenes/Scene3CanvasHero";
import { Scene3bDrawing } from "./scenes/Scene3bDrawing";
import { Scene4Editor } from "./scenes/Scene4Editor";
import { Scene5Tafsir } from "./scenes/Scene5Tafsir";
import { Scene6Collaboration } from "./scenes/Scene6Collaboration";
import { Scene7Closing } from "./scenes/Scene7Closing";


/* ── Sound ─────────────────────────────────────────────────────────────────
   The trailer shipped with an AAC track containing digital silence (-91 dB)
   and no <Audio> anywhere in the tree, so the site's showcase had nothing to
   play even once unmuted.

   A NASHEED BED, NOT A SCORE. There is no speech to duck under here, so the
   bed carries the whole piece rather than hiding beneath one. It sits at 0.30
   — loud enough to be the thing you hear, quiet enough that the cues below
   land on top of it rather than fight it. The reels run this same recording
   at 0.032 under speech and 0.22 in the clear; with nothing to compete with,
   a little above the latter is right.

   CUES ON SCENE BOUNDARIES, NOT ON A GRID. Every entry below is the frame a
   scene actually starts on in the assembly above, so a retimed scene drags its
   sound with it. Same rule the reels settled on after their cues drifted 84
   frames from the pictures they were meant to cause.                        */

const Score: React.FC = () => {
  const f = useCurrentFrame();
  /* Up over the first second and a half, held, then down across the closing
     card so the piece ends rather than stops. */
  const bed = interpolate(
    f,
    [0, 45, 1800, 2040, 2100],
    [0, 0.30, 0.30, 0.20, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <>
      <Audio src={staticFile("nasheed.mp3")} volume={() => bed} />

      {/* 210 — the app shell arrives over the logo */}
      <Sequence from={210} durationInFrames={40}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.26} />
      </Sequence>

      {/* 420 — the canvas opens: the widest move in the piece */}
      <Sequence from={418} durationInFrames={40}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.30} />
      </Sequence>
      <Sequence from={438} durationInFrames={40}>
        <Audio src={staticFile("sfx/land.mp3")} volume={0.34} />
      </Sequence>

      {/* 870 — ink on the Mushaf. granular reads as a nib, not a click. */}
      <Sequence from={872} durationInFrames={60}>
        <Audio src={staticFile("sfx/granular.mp3")} volume={0.30} />
      </Sequence>
      <Sequence from={950} durationInFrames={60}>
        <Audio src={staticFile("sfx/granular-select.mp3")} volume={0.24} />
      </Sequence>

      {/* 1110 — the editor. The typing sample is 8s and the scene is 10s. */}
      <Sequence from={1118} durationInFrames={150}>
        <Audio src={staticFile("sfx/typing.mp3")} volume={0.22} />
      </Sequence>
      {/* the slash command being taken */}
      <Sequence from={1272} durationInFrames={30}>
        <Audio src={staticFile("sfx/click.mp3")} volume={0.34} />
      </Sequence>

      {/* 1350 — the tafsir drawer comes in from the side */}
      <Sequence from={1352} durationInFrames={45}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.24} />
      </Sequence>

      {/* 1530 — collaborators arrive. magnetic is 0.10s: a tick, one each. */}
      <Sequence from={1536} durationInFrames={20}>
        <Audio src={staticFile("sfx/magnetic.mp3")} volume={0.30} />
      </Sequence>
      <Sequence from={1560} durationInFrames={20}>
        <Audio src={staticFile("sfx/magnetic.mp3")} volume={0.26} />
      </Sequence>
      <Sequence from={1584} durationInFrames={20}>
        <Audio src={staticFile("sfx/magnetic.mp3")} volume={0.22} />
      </Sequence>

      {/* 1800 — the closing card settles. The loudest single cue, and the last:
          §12.1 in MOTION-STUDY, the landing carries more than the launch. */}
      <Sequence from={1802} durationInFrames={80}>
        <Audio src={staticFile("sfx/land.mp3")} volume={0.38} />
      </Sequence>
    </>
  );
};

// ~70 seconds @ 30fps = 2100 frames
// Scene 3b (drawing) inserted after canvas hero; all later scenes shifted +270 frames
export const TafsirTrailer: React.FC = () => {
  return (
    <AbsoluteFill>
      <Score />

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
