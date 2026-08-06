import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile,
  useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import CAPS from "./dosari-captions.json";

/* ── Reel: "everything gathers into one āyah" ──────────────────────────────
   A 34s clip of Shaykh Yasser al-Dosari, captioned, closing on the argument
   he is already making rather than switching to a pitch.

   Captions are PHRASE-length and cut from word-level timings, not from
   whisper's segment boundaries. Segments run five to eight seconds and cannot
   see a pause: he stops speaking at 19.0s and does not start again until
   23.56s, so a segment-timed caption sat on screen through four and a half
   seconds of silence. That is what "the captions don't line up" looks like.
   Thirteen short cards tracked to when he actually says the words fixes it.

   30fps, matching the source — resampling a talking head to 60 invents frames
   on a face and gains nothing.                                              */

const FPS = 30;
export const CLIP_FRAMES  = 34 * FPS;   // 1020, the cut is exactly 34.0s
export const OUTRO_FRAMES = 7 * FPS;    // 210
export const REEL_FRAMES  = CLIP_FRAMES + OUTRO_FRAMES;

const W = 1080, H = 1920;

/* Dark ground with the picture inset, following the reference. The captions
   are cream rather than white — pure white on this footage vibrates against
   his thawb, and the warm tint sits with the brand's paper. */
const GROUND = "#0E0E0D";
const CREAM  = "#F6F0E2";
const ACCENT = "#86B49A";
const MUTED  = "#8A857C";
/* The brand lockup sits above MUTED on purpose. At the muted tone it read
   fainter than the shaykh's credit at the bottom, which is the wrong
   hierarchy — the credit is an obligation, the mark is the whole reason the
   reel exists. Still well under the captions' cream, so it stays a bug in the
   corner of the eye rather than a thing you read. */
const BRAND  = "#BAB4A8";

/* Source is 1920x1080 and he sits dead centre, so the square crop takes
   x 420..1500 at 1:1 — no scaling, no softening of the face. */
const VIDEO_NATIVE_W = 1920;
const CROP_X = -420;

/* The inset card. Rounded, held off the edges, so the reel reads as something
   presented rather than something posted. */
const CARD_TOP = 300, CARD_H = 1080, CARD_INSET = 36;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ── Part A: the clip ───────────────────────────────────────────────────────

const Clip: React.FC = () => {
  const f = useCurrentFrame();
  const sec = f / FPS;
  const i = CAPS.findIndex((c) => sec >= c.s && sec < c.e);
  const cur = i >= 0 ? CAPS[i] : null;

  /* Each card gets its own short lift. Measured from the card's own start so
     a long caption does not keep animating after it has landed. */
  const since = cur ? sec - cur.s : 0;
  const t = Math.max(0, Math.min(1, since / 0.18));
  const e = 1 - Math.pow(1 - t, 3);

  return (
    <AbsoluteFill style={{ background: GROUND }}>
      <div style={{
        position: "absolute", top: CARD_TOP, left: CARD_INSET,
        width: W - CARD_INSET * 2, height: CARD_H,
        overflow: "hidden", borderRadius: 28, background: "#000",
      }}>
        {/* MUTED. OffthreadVideo plays the file's audio by default, and the
            speech is mounted separately below so it can be ducked against the
            nasheed — leaving both plays his voice twice, a few samples apart,
            which reads as phasing rather than as an error. */}
        {/* Graded down, like the reference. The source is a white backdrop and
            a bright thawb, and cream text on that washes out however much
            shadow you put behind it — a halo cannot add contrast that the
            picture does not have. Pulling brightness and saturation gives the
            captions something to sit on and matches the muted look. */}
        <OffthreadVideo
          muted
          src={staticFile("dosari-clip.mp4")}
          style={{
            position: "absolute", left: CROP_X - CARD_INSET, top: 0,
            width: VIDEO_NATIVE_W, height: CARD_H,
            filter: "brightness(0.82) saturate(0.88) contrast(1.04)",
          }}
        />

        {/* …and a scrim only where the words are, so his face keeps its
            exposure while the caption zone goes properly dark. */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: 460,
          background: "linear-gradient(to bottom, rgba(6,6,6,0) 0%, rgba(6,6,6,0.52) 55%, rgba(6,6,6,0.78) 100%)",
          pointerEvents: "none",
        }} />

        {/* Captions sit ON the picture, low, where the reference puts them.
            The scrim is only under the text so his face stays untouched. */}
        {cur && (
          <div key={i} style={{
            position: "absolute", left: 40, right: 40, bottom: 108,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            opacity: e, transform: `translateY(${(1 - e) * 8}px)`,
          }}>
            <div style={{
              fontFamily: R.fontArabic, fontSize: 52, lineHeight: 1.7,
              color: CREAM, direction: "rtl", textAlign: "center",
              textWrap: "balance",
              /* A soft dark halo rather than a box: legible over a bright
                 thawb and a white backdrop without boxing the picture in. */
              textShadow: "0 2px 14px rgba(0,0,0,0.85), 0 0 34px rgba(0,0,0,0.6)",
            }}>
              {cur.ar}
            </div>
            <div style={{
              fontFamily: R.fontSerif, fontSize: 28, lineHeight: 1.45,
              color: "rgba(246,240,226,0.82)", textAlign: "center",
              textWrap: "balance", maxWidth: 860,
              textShadow: "0 2px 12px rgba(0,0,0,0.9)",
            }}>
              {cur.en}
            </div>
          </div>
        )}
      </div>

      {/* Brand lockup. It lives in the empty band ABOVE the picture, which
          costs nothing — no caption, no face, no gesture is ever there — so it
          can stay up for the whole reel without being in the way. Outlined
          rather than filled, and at the muted tone: a filled mark on this dark
          ground reads as a bright chip in the corner of the eye, which is the
          opposite of subtle. */}
      <div style={{
        position: "absolute", top: 148, left: 0, right: 0,
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

      {/* Attribution. Quiet, and present for the whole clip. */}
      <div style={{
        position: "absolute", bottom: 92, left: 0, right: 0, textAlign: "center",
        fontFamily: R.fontArabic, fontSize: 26, color: MUTED, direction: "rtl",
      }}>
        الشيخ الدكتور ياسر الدوسري
      </div>
    </AbsoluteFill>
  );
};

// ── Part B: the close ──────────────────────────────────────────────────────

const Outro: React.FC = () => {
  const f = useCurrentFrame();

  const line = (at: number) => {
    const t = interpolate(f, [at, at + 8], [0, 1], clamp);
    const e = 1 - Math.pow(1 - t, 3);
    return { opacity: e, transform: `translateY(${(1 - e) * 12}px)` };
  };
  const rule = interpolate(f, [44, 78], [0, 280], clamp);

  return (
    <AbsoluteFill style={{
      background: GROUND,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "0 96px",
    }}>
      <div style={{
        ...line(2),
        fontFamily: R.fontSerif, fontSize: 56, lineHeight: 1.32, color: CREAM,
        textAlign: "center", letterSpacing: "-0.02em", textWrap: "balance",
      }}>
        The whole Qurʾān, gathered<br />into one sūrah.
      </div>

      <div style={{
        ...line(26),
        fontFamily: R.fontSerif, fontSize: 56, lineHeight: 1.32, color: CREAM,
        textAlign: "center", letterSpacing: "-0.02em", marginTop: 24,
        textWrap: "balance",
      }}>
        That sūrah, into one āyah.
      </div>

      <div style={{ width: rule, height: 2, background: ACCENT, borderRadius: 2, marginTop: 56 }} />

      <div style={{
        ...line(80),
        marginTop: 54, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 16,
      }}>
        <div style={{
          fontFamily: R.fontSans, fontSize: 34, lineHeight: 1.5, color: CREAM,
          textAlign: "center",
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
    </AbsoluteFill>
  );
};

// ── Assembly ───────────────────────────────────────────────────────────────

export const DosariReel: React.FC = () => {
  const f = useCurrentFrame();

  /* The nasheed runs the whole way, but DUCKED hard under the clip — it is
     a vocal track, and two voices at the same level is not a bed, it is a
     fight. Levels measured off the render rather than reasoned about: at 0.20
     the bed sat 1.6dB under his voice and competed with every word; 0.032 puts
     it about fifteen down, which is audible in his pauses — including the
     four-and-a-half-second one at 19s — and never in his way. It lifts to
     0.30 once the picture leaves, roughly five decibels over the speech, so
     the close arrives rather than interrupts. */
  const nasheed = interpolate(
    f,
    [0, 40, CLIP_FRAMES - 40, CLIP_FRAMES + 20, REEL_FRAMES - 45, REEL_FRAMES],
    [0, 0.032, 0.032, 0.22, 0.22, 0], clamp,
  );

  /* His voice, faded rather than cut at the boundary so the handover has no
     edge on it. */
  const speech = interpolate(f, [CLIP_FRAMES - 26, CLIP_FRAMES], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ background: GROUND }}>
      <Sequence durationInFrames={CLIP_FRAMES}><Clip /></Sequence>
      <Sequence from={CLIP_FRAMES} durationInFrames={OUTRO_FRAMES}><Outro /></Sequence>

      <Sequence durationInFrames={CLIP_FRAMES}>
        <Audio src={staticFile("dosari-clip.mp4")} volume={() => speech} />
      </Sequence>

      <Audio src={staticFile("nasheed.mp3")} volume={() => nasheed} />
    </AbsoluteFill>
  );
};
