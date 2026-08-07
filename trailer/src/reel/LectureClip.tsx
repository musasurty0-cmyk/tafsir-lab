import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile,
  useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";

/* ── Lecture clips: Ustadh AbdulRahman Hassan ──────────────────────────────
   Two cuts from "Unlocking The Secrets of The Qur'an", both on what tafsir IS
   and why learning it is obligatory.

   Shares DosariReel's geometry — inset card on a dark ground — because that
   reads as a card once the side margins carry real weight (36px did not; 100
   does). Two things differ:

   NO NASHEED. The Dosari reel needed a bed under a four-and-a-half second
   silence. These cuts are continuous English speech, and a bed under speech
   you can already follow is just something else to duck.

   25 FPS, matching the source. The lecture is 25fps and resampling a talking
   head to 30 or 60 invents frames on a face for nothing.                */

const FPS = 25;
const W = 1080, H = 1920;

const GROUND = "#0E0E0D";
const CREAM  = "#F6F0E2";
const ACCENT = "#86B49A";
const MUTED  = "#8A857C";
const BRAND  = "#BAB4A8";

const CARD_INSET = 100;
const CARD_W = W - CARD_INSET * 2;      // 880
/* Source is 1920x1080, so a card 1080 tall places the video at 1:1 — no
   rescaling of his face at all. Same geometry as DosariReel, which is already
   proven on a phone: 100px side margins are what make the card read as a card
   rather than a full-bleed band. */
const CARD_H = 1080;
const CARD_TOP = 390;
const SRC_W = 1920, SRC_H = 1080;
const SCALE = CARD_H / SRC_H;           // 1 — native
const VIDEO_W = SRC_W * SCALE;          // 1920
/* Derived, so changing the inset cannot silently push him off-centre. */
const VIDEO_LEFT = -(VIDEO_W - CARD_W) / 2;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** `ar` is present only where he actually recites/quotes Arabic. The rest of
 *  the time he is explaining in English and a second line would be invented. */
export interface Caption { s: number; e: number; en: string; ar?: string }

export interface LectureClipProps {
  src: string;
  captions: Caption[];
  clipSeconds: number;
  outroSeconds: number;
  /** The line the closing card leaves them on. */
  closing: string;
  /* Remotion types a Composition's props as Record<string, unknown>, so the
     props interface has to be assignable to it. */
  [key: string]: unknown;
}

// ── The clip ───────────────────────────────────────────────────────────────

const Clip: React.FC<{ src: string; captions: Caption[] }> = ({ src, captions }) => {
  const f = useCurrentFrame();
  const sec = f / FPS;
  const i = captions.findIndex((c) => sec >= c.s && sec < c.e);
  const cur = i >= 0 ? captions[i] : null;

  const since = cur ? sec - cur.s : 0;
  const t = Math.max(0, Math.min(1, since / 0.18));
  const e = 1 - Math.pow(1 - t, 3);

  return (
    <AbsoluteFill style={{ background: GROUND }}>
      <div style={{
        position: "absolute", top: CARD_TOP, left: CARD_INSET,
        width: CARD_W, height: CARD_H,
        overflow: "hidden", borderRadius: 40, background: "#000",
      }}>
        {/* muted: OffthreadVideo plays its own audio track, and the speech is
            mounted separately below. Both together is his voice twice, a few
            samples apart, which reads as a room fault rather than an error. */}
        <OffthreadVideo
          muted
          src={staticFile(src)}
          style={{
            position: "absolute", left: VIDEO_LEFT, top: 0,
            width: VIDEO_W, height: CARD_H,
            /* Barely graded. His set is already warm and low-contrast — the
               Dosari clip needed pulling down because a white backdrop and a
               bright thawb gave cream captions nothing to sit on. This does
               not have that problem. */
            filter: "brightness(0.94) saturate(0.97) contrast(1.02)",
          }}
        />

        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: 420,
          background: "linear-gradient(to bottom, rgba(6,6,6,0) 0%, rgba(6,6,6,0.5) 55%, rgba(6,6,6,0.8) 100%)",
          pointerEvents: "none",
        }} />

        {cur && (
          <div key={i} style={{
            position: "absolute", left: 34, right: 34, bottom: 84,
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 13,
            opacity: e, transform: `translateY(${(1 - e) * 8}px)`,
          }}>
            {/* Arabic leads where he is actually reciting it — the English
                under it is the meaning, not a competing line. */}
            {cur.ar && (
              <div style={{
                fontFamily: R.fontArabic, fontSize: 50, lineHeight: 1.7,
                color: CREAM, direction: "rtl", textAlign: "center",
                textWrap: "balance",
                textShadow: "0 2px 14px rgba(0,0,0,0.85), 0 0 34px rgba(0,0,0,0.6)",
              }}>
                {cur.ar}
              </div>
            )}
            <div style={{
              fontFamily: R.fontSerif,
              fontSize: cur.ar ? 27 : 33,
              lineHeight: 1.42,
              color: cur.ar ? "rgba(246,240,226,0.82)" : CREAM,
              textAlign: "center", textWrap: "balance", maxWidth: 790,
              textShadow: "0 2px 13px rgba(0,0,0,0.9)",
            }}>
              {cur.en}
            </div>
          </div>
        )}
      </div>

      {/* Brand lockup, in the empty band above the picture. */}
      <div style={{
        position: "absolute", top: 168, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 15,
      }}>
        <div style={{
          width: 43, height: 43, borderRadius: 12,
          border: `2px solid ${BRAND}`, color: BRAND,
          display: "grid", placeItems: "center",
          fontFamily: R.fontSans, fontSize: 22, fontWeight: 700,
        }}>T</div>
        <div style={{
          fontFamily: R.fontSerif, fontSize: 33, color: BRAND,
          letterSpacing: "-0.01em",
        }}>
          TafsirLab
        </div>
      </div>

      {/* Speaker. Sits just under the card, well clear of the band Instagram
          fills with the username and caption. */}
      <div style={{
        position: "absolute", top: CARD_TOP + CARD_H + 46, left: 0, right: 0,
        textAlign: "center", fontFamily: R.fontSans, fontSize: 30, color: MUTED,
        letterSpacing: "0.01em",
      }}>
        Ustadh AbdulRahman Hassan
      </div>
    </AbsoluteFill>
  );
};

// ── The close ──────────────────────────────────────────────────────────────

const Outro: React.FC<{ closing: string }> = ({ closing }) => {
  const f = useCurrentFrame();
  const line = (at: number) => {
    const t = interpolate(f, [at, at + 8], [0, 1], clamp);
    const e = 1 - Math.pow(1 - t, 3);
    return { opacity: e, transform: `translateY(${(1 - e) * 12}px)` };
  };
  const rule = interpolate(f, [30, 62], [0, 280], clamp);

  return (
    <AbsoluteFill style={{
      background: GROUND, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "0 96px",
    }}>
      <div style={{
        ...line(2),
        fontFamily: R.fontSerif, fontSize: 54, lineHeight: 1.34, color: CREAM,
        textAlign: "center", letterSpacing: "-0.02em", textWrap: "balance",
      }}>
        {closing}
      </div>

      <div style={{ width: rule, height: 2, background: ACCENT, borderRadius: 2, marginTop: 52 }} />

      <div style={{
        ...line(66), marginTop: 50,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
      }}>
        <div style={{
          fontFamily: R.fontSans, fontSize: 34, lineHeight: 1.5,
          color: CREAM, textAlign: "center",
        }}>
          Start studying with TafsirLab today.
        </div>
        <div style={{
          fontFamily: R.fontSans, fontSize: 25, color: ACCENT,
          letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 6,
        }}>
          tafsir-lab.com
        </div>
      </div>

      {/* Credit carried onto the close as well, so the attribution is present
          in any frame someone screenshots. */}
      <div style={{
        position: "absolute", bottom: 150, left: 0, right: 0, textAlign: "center",
        fontFamily: R.fontSans, fontSize: 25, color: MUTED,
      }}>
        Ustadh AbdulRahman Hassan
      </div>
    </AbsoluteFill>
  );
};

// ── Assembly ───────────────────────────────────────────────────────────────

export const LectureClip: React.FC<LectureClipProps> = ({
  src, captions, clipSeconds, outroSeconds, closing,
}) => {
  const f = useCurrentFrame();
  const clipFrames  = Math.round(clipSeconds * FPS);
  const outroFrames = Math.round(outroSeconds * FPS);

  /* Faded rather than cut at the boundary, so the handover has no edge. */
  const speech = interpolate(f, [clipFrames - 20, clipFrames], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ background: GROUND }}>
      <Sequence durationInFrames={clipFrames}>
        <Clip src={src} captions={captions} />
      </Sequence>
      <Sequence from={clipFrames} durationInFrames={outroFrames}>
        <Outro closing={closing} />
      </Sequence>

      <Sequence durationInFrames={clipFrames}>
        <Audio src={staticFile(src)} volume={() => speech} />
      </Sequence>
    </AbsoluteFill>
  );
};
