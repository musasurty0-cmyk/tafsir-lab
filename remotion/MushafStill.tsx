/**
 * MushafStill — the marketing site's Mushaf hero image.
 *
 * Rendered from the product's real annotation surface rather than mocked up in
 * HTML, because the page can only be drawn correctly by the QCF v2 page font:
 * each word is a Private Use Area glyph whose metrics *are* the Madinah page
 * layout. Any web-safe Arabic face (Amiri, Scheherazade) reflows the lines and
 * the result stops looking like a Mushaf. Highlights are anchored to real
 * {āyah, word} pairs, so the marks sit exactly where the app would put them.
 *
 * `npm run mushaf:still` writes public/mushaf-annotations.png.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { CanvasDoc, APP_W, APP_H } from "./reel/app";

export const STILL_W = 1560;
export const STILL_H = 1100;

/* Reframing. In the app the canvas is 1640×1030 and the Mushaf only occupies
   the middle of it — correct in the product, where the surrounding space is
   pannable, but as a still it reads as a small page adrift in white. So the
   whole canvas is scaled and offset as one unit: every mark keeps its exact
   relationship to its word, and the page fills the frame.

   Content bounds inside the canvas: x 22 (tool rail) → 1120 (widest line),
   y 18 (page pill) → 880 (last margin note). */
export const MUSHAF_BOX = { x: 22, y: 18, w: 1098, h: 862 };
const BOX = MUSHAF_BOX;
const K = 1.2;
const TX = (STILL_W - BOX.w * K) / 2 - BOX.x * K;
const TY = (STILL_H - BOX.h * K) / 2 - BOX.y * K;

export const MushafStill: React.FC = () => (
  <AbsoluteFill style={{ background: "#fff", overflow: "hidden" }}>
    <div
      style={{
        position: "absolute", width: APP_W, height: APP_H,
        transform: `translate(${TX}px, ${TY}px) scale(${K})`,
        transformOrigin: "0 0",
      }}
    >
      {/* The finished state: margin notes written, phrases highlighted, one
          word selected. No word-focus overlay — that beat belongs to the film. */}
      <CanvasDoc tool={2} ink={1} hl={1} wordGlow={1} clearInk={0} wordInk={0} />
    </div>
  </AbsoluteFill>
);
