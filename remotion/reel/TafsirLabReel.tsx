/**
 * TafsirLabReel — Instagram Reel #1 · 1080x1920 · 30fps · 25.0s
 *
 * ONE white room, ONE camera. Every object below sits at a fixed world
 * coordinate; the camera is the only thing that travels. There are no scenes
 * to cut between and no per-scene backgrounds — which is precisely why this
 * cannot collapse back into a slideshow.
 *
 * Spine:  pain → chaos → collapse → one window → the magic (6s) → depth
 *         → the whole → devices → resolve
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, Easing, useVideoConfig } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadAmiri } from "@remotion/google-fonts/Amiri";
import {
  C, FONT, W, H, s, cameraAt, camTransform, ramp, pulse, EASE_OUT, EASE_SOFT, Pose,
} from "./theme";
import {
  MushafPage, NoteCard, TafsirPanel, WorkspaceChrome, AppWindow, DeviceFrame, Cursor, At,
} from "./ui";

// Load only what the reel actually sets — the default pulls 126 files and
// every one of them is a network request the renderer waits on per worker.
// Signature is loadFont(style, options) — the first arg is the style, not the
// options bag. Loading only what the reel sets keeps the renderer from waiting
// on ~126 font requests per worker.
loadInter("normal", {
  weights: ["400", "500", "600", "700"], subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
loadAmiri("normal", {
  weights: ["400", "700"], subsets: ["arabic"],
  ignoreTooManyRequestsWarning: true,
});

export const REEL_FPS = 30;
export const REEL_DURATION = 750;

/* ── World layout ──────────────────────────────────────────────────────────
   Fixed coordinates. The Mushaf page is the anchor at the origin; everything
   else is positioned relative to it so the camera can always find its way
   home. The hero word sits at roughly (60, -150) inside the page.          */

const PAGE = { x: 0, y: 0 };
const WORD = { x: 74, y: -172 };      // ٱلْكِتَـٰبُ within the page
const NOTE = { x: -30, y: 300 };      // hangs UNDER the word, overlapping the page
const NOTE2 = { x: 250, y: 720 };
const TAFSIR = { x: 0, y: 1010 };     // page lifts, tafsir arrives beneath
const DEVICES = { x: 380, y: 190 };

/* ── Camera path ───────────────────────────────────────────────────────────
   Not zoom-zoom-zoom. It slides, drifts on a small 3D tilt, pushes THROUGH
   the collapsed window, orbits gently around the note, then makes one long
   confident pull-back. Angles stay under 9deg — beyond that it reads gimmicky. */

const CAM: Pose[] = [
  // Act I — the mess. Slight roll + drift, never a flat zoom.
  { f: 0,       x: 0,   y: -1500, scale: 1.00 },
  { f: s(1.4),  x: 0,   y: -1500, scale: 1.00 },
  { f: s(2.2),  x: -40, y: -1460, scale: 0.86, ry: -6, rx: 3,  rz: -1.2 },
  { f: s(3.4),  x: 60,  y: -1520, scale: 0.80, ry: 7,  rx: -2, rz: 1.4 },
  { f: s(4.5),  x: 0,   y: -1500, scale: 1.05 },
  // Act II — push THROUGH the collapsed mark into the page.
  { f: s(5.4),  x: 0,   y: -1500, scale: 1.35 },
  { f: s(6.2),  x: 0,   y: -70,  scale: 0.76, ease: EASE_OUT },   // the page, whole
  { f: s(7.3),  x: 74,  y: -180, scale: 1.85, ry: 3 },            // in to the word
  { f: s(8.8),  x: 15,  y: 70,   scale: 0.95, ry: -4 },           // note hangs below; both framed
  { f: s(11.4), x: 40,  y: 150,  scale: 0.88, ry: 6, rx: 2 },     // slow orbit
  { f: s(13.8), x: 180, y: 470,  scale: 0.82, ry: -3 },           // drift to the second note
  // Act III — depth, then one long pull-back.
  { f: s(16.4), x: 60,  y: 690,  scale: 0.58, ry: 3 },            // tafsir beneath
  { f: s(19.2), x: 60,  y: 210,  scale: 0.33, ry: 0, rx: 0 },     // the whole workspace
  // Act IV — devices.
  { f: s(21.4), x: 520, y: 250, scale: 0.52 },
  { f: s(22.9), x: 540, y: 265, scale: 0.50 },
  { f: s(25.0), x: 540, y: 265, scale: 0.50 },
];

/* ── The distracting apps ─────────────────────────────────────────────── */
const CHAOS = [
  { t: "Quran.com",   a: "#4F9A7A", x: -300, y: -1810, r: -7,  w: 430, h: 300, k: "web"  as const, d: 0 },
  { t: "Notes",       a: "#F0C24B", x:  300, y: -1760, r:  6,  w: 380, h: 270, k: "text" as const, d: 4 },
  { t: "OneNote",     a: "#8B5CF6", x: -230, y: -1330, r:  5,  w: 400, h: 280, k: "text" as const, d: 8 },
  { t: "tafsir.pdf",  a: "#E5563F", x:  330, y: -1290, r: -6,  w: 360, h: 300, k: "pdf"  as const, d: 12 },
  { t: "Safari",      a: "#5B9BD5", x:  -80, y: -1080, r:  3,  w: 420, h: 250, k: "web"  as const, d: 16 },
  { t: "Notion",      a: "#111315", x:  120, y: -1980, r: -4,  w: 370, h: 260, k: "text" as const, d: 20 },
];

export const TafsirLabReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = cameraAt(CAM, frame);

  /* ── Act I timings ── */
  const painIn = ramp(frame, s(0.5), s(1.5));
  const painOut = 1 - ramp(frame, s(2.0), s(2.6));
  const chaosOut = 1 - ramp(frame, s(3.9), s(4.4));      // windows compress away
  const collapse = ramp(frame, s(3.9), s(4.6), EASE_SOFT); // 0→1 pull to centre
  const oneWindow = pulse(frame, s(4.3), s(4.8), s(5.5), s(5.9));

  /* ── Act II ── */
  const pageIn = ramp(frame, s(5.5), s(6.3), EASE_OUT);
  const highlight = ramp(frame, s(6.4), s(7.1));
  const focus = ramp(frame, s(6.6), s(7.6)) * (1 - ramp(frame, s(11.0), s(12.2)));
  const clickPress = pulse(frame, s(7.05), s(7.18), s(7.3), s(7.5));
  const noteUnfold = spring({ frame: frame - s(7.5), fps, config: { damping: 200, stiffness: 90, mass: 0.85 } });
  const noteContent = ramp(frame, s(7.9), s(9.4));
  const inkDraw = ramp(frame, s(9.6), s(10.8), EASE_SOFT);

  /* ── Act II-b: second container + its ink ── */
  const note2 = spring({ frame: frame - s(12.6), fps, config: { damping: 190, stiffness: 95, mass: 0.9 } });
  const note2Ink = ramp(frame, s(13.6), s(14.6), EASE_SOFT);

  /* ── Act III ── */
  const tafsirIn = spring({ frame: frame - s(15.2), fps, config: { damping: 200, stiffness: 80, mass: 1 } });
  const pageLift = interpolate(tafsirIn, [0, 1], [0, -210]); // page rises to make room below
  const tafsirSource = frame >= s(17.4) ? 1 : 0;
  const chromeIn = ramp(frame, s(17.6), s(19.0), EASE_SOFT);
  const chromeOut = 1 - ramp(frame, s(19.8), s(20.6), EASE_SOFT); // becomes the laptop

  /* ── Act IV: devices ── */
  const laptopIn = spring({ frame: frame - s(19.9), fps, config: { damping: 180, stiffness: 80, mass: 1 } });
  const tabletIn = spring({ frame: frame - s(20.9), fps, config: { damping: 170, stiffness: 85, mass: 0.95 } });
  const phoneIn  = spring({ frame: frame - s(21.7), fps, config: { damping: 170, stiffness: 90, mass: 0.9 } });
  const devicesOut = 1 - ramp(frame, s(22.7), s(23.4), EASE_SOFT);

  /* ── Act V ── */
  const logoIn = ramp(frame, s(23.5), s(24.1), EASE_OUT);
  const endLine = ramp(frame, s(24.0), s(24.6), EASE_OUT);

  /* The world dissolves to white for the resolve — never to black. */
  const worldFade = 1 - ramp(frame, s(22.9), s(23.5), EASE_SOFT);

  return (
    <AbsoluteFill style={{ background: C.white, overflow: "hidden" }}>
      {/* ── The room ── */}
      <AbsoluteFill style={{ perspective: 2400, opacity: worldFade }}>
        <div style={{
          position: "absolute", left: 0, top: 0, width: 0, height: 0,
          transform: camTransform(cam), transformOrigin: "0 0",
          transformStyle: "preserve-3d",
        }}>
          {/* ── Act I · the pain line ── */}
          <At x={0} y={-1500} z={40} opacity={painIn * painOut}>
            <div style={{
              width: 900, textAlign: "center", fontFamily: FONT.sans,
              fontSize: 76, fontWeight: 600, letterSpacing: "-0.032em",
              lineHeight: 1.15, color: C.ink,
              transform: `translateY(${(1 - painIn) * 26}px)`,
            }}>
              Studying the Qur’an<br />shouldn’t feel like this.
            </div>
          </At>

          {/* ── Act I · the scattered apps ──
              Each window flies in on its own spring, then every one of them is
              pulled toward the centre and compressed — the collapse IS the
              value proposition, stated without a word of explanation. */}
          {CHAOS.map((win, i) => {
            const inS = spring({
              frame: frame - s(1.6) - win.d, fps,
              config: { damping: 150, stiffness: 90, mass: 0.9 },
            });
            const cx = interpolate(collapse, [0, 1], [win.x, 0], { easing: EASE_SOFT });
            const cy = interpolate(collapse, [0, 1], [win.y, -1500], { easing: EASE_SOFT });
            const cs = interpolate(collapse, [0, 1], [1, 0.12], { easing: EASE_SOFT });
            const cr = interpolate(collapse, [0, 1], [win.r, 0], { easing: EASE_SOFT });
            return (
              <At
                key={win.t}
                x={cx} y={cy} z={10 + i}
                opacity={inS * chaosOut}
                rotate={cr}
                scale={(0.86 + 0.14 * inS) * cs}
              >
                <AppWindow title={win.t} accent={win.a} w={win.w} h={win.h} kind={win.k} />
              </At>
            );
          })}

          {/* ── Act I → II · the one elegant window the mess becomes ── */}
          <At x={0} y={-1500} z={60} opacity={oneWindow} scale={0.9 + 0.1 * oneWindow}>
            <div style={{
              width: 300, height: 300, borderRadius: 46, background: C.ink,
              color: C.white, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 14,
              boxShadow: "0 50px 130px rgba(10,10,10,0.22)",
              fontFamily: FONT.sans,
            }}>
              <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1 }}>T</div>
              <div style={{ fontSize: 26, fontWeight: 550, letterSpacing: "-0.01em", opacity: 0.85 }}>
                TafsirLab
              </div>
            </div>
          </At>

          {/* ── Act II+ · the workspace chrome, revealed only on the pull-back ── */}
          <At x={60} y={40} z={2} opacity={chromeIn * chromeOut}>
            <WorkspaceChrome width={1780} height={1180} reveal={1} />
          </At>

          {/* ── The Mushaf page — the anchor of the whole room ── */}
          <At x={PAGE.x} y={PAGE.y + pageLift} z={20} opacity={pageIn * chromeOut}>
            <MushafPage width={900} highlight={highlight} focus={focus} />
          </At>

          {/* ── The word's note — unfolds hinged from the word itself ── */}
          <At x={NOTE.x} y={NOTE.y + pageLift} z={30} opacity={(noteUnfold > 0.02 ? 1 : 0) * chromeOut}>
            <NoteCard width={560} unfold={noteUnfold} content={noteContent} inkDraw={inkDraw} />
          </At>

          {/* ── A second container, dropped and inked ── */}
          <At x={NOTE2.x} y={NOTE2.y + pageLift} z={30} opacity={(note2 > 0.02 ? 1 : 0) * chromeOut}
              scale={0.92 + 0.08 * note2}>
            <div style={{
              width: 420, background: C.paper, border: `1px solid ${C.hair2}`,
              borderRadius: 12, boxShadow: C.shadowLift, padding: "24px 26px",
              fontFamily: FONT.sans, transform: `translateY(${(1 - note2) * 26}px)`,
            }}>
              <div style={{
                fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase",
                color: C.blue, fontWeight: 650, marginBottom: 14,
              }}>Reflection</div>
              <div style={{ fontSize: 22, lineHeight: 1.5, color: C.ink }}>
                Guidance is <span style={{ background: C.amber, padding: "1px 5px", borderRadius: 3 }}>
                promised</span>, not merely offered.
              </div>
              <svg width={360} height={40} style={{ display: "block", marginTop: 12 }}>
                <path d="M4 26 C 60 6, 130 6, 190 22 S 300 40, 348 14"
                      fill="none" stroke={C.blue} strokeWidth={3} strokeLinecap="round"
                      strokeDasharray={420} strokeDashoffset={420 * (1 - note2Ink)} opacity={0.7} />
              </svg>
            </div>
          </At>

          {/* ── Tafsir — the page shifts to make room, it doesn't fly over ── */}
          <At x={TAFSIR.x} y={TAFSIR.y} z={28}
              opacity={tafsirIn * chromeOut} scale={0.94 + 0.06 * tafsirIn}>
            <TafsirPanel width={460} source={tafsirSource} reveal={1} />
          </At>

          {/* ── Cursor: motion is always caused by it ── */}
          <At
            x={interpolate(frame, [s(6.2), s(7.0), s(7.6), s(9.2), s(12.2), s(13.0)],
                 [WORD.x + 320, WORD.x + 30, WORD.x + 30, NOTE.x + 210, NOTE2.x - 30, NOTE2.x + 60],
                 { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SOFT })}
            y={interpolate(frame, [s(6.2), s(7.0), s(7.6), s(9.2), s(12.2), s(13.0)],
                 [WORD.y + 220, WORD.y + 26, WORD.y + 26, NOTE.y + 120, NOTE2.y - 120, NOTE2.y + 40],
                 { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SOFT })}
            z={90}
            opacity={pulse(frame, s(6.0), s(6.4), s(13.4), s(14.0))}
          >
            <Cursor press={clickPress} />
          </At>

          {/* ── Act IV · devices. No caption — the picture says it. ── */}
          <At x={60} y={120} z={70} opacity={laptopIn * devicesOut}
              scale={0.94 + 0.06 * laptopIn}>
            <div style={{ transform: `translateY(${(1 - laptopIn) * 60}px)` }}>
              <DeviceFrame kind="laptop" w={1120} h={720}>
                <div style={{ transform: "scale(0.56)", transformOrigin: "0 0", width: 2000, height: 1286 }}>
                  <WorkspaceChrome width={1960} height={1240}>
                    <div style={{ transform: "scale(0.72)", transformOrigin: "0 0", padding: 30 }}>
                      <MushafPage width={900} highlight={1} />
                    </div>
                  </WorkspaceChrome>
                </div>
              </DeviceFrame>
            </div>
          </At>

          <At x={980} y={280} z={72} opacity={tabletIn * devicesOut}
              scale={0.94 + 0.06 * tabletIn}>
            <div style={{ transform: `translate(${(1 - tabletIn) * 90}px, 0)` }}>
              <DeviceFrame kind="tablet" w={520} h={700}>
                <div style={{ transform: "scale(0.6)", transformOrigin: "0 0", width: 900 }}>
                  <MushafPage width={880} highlight={1} showHeader={false} />
                </div>
                {/* the tablet is where handwriting happens */}
                <svg width={520} height={700} style={{ position: "absolute", inset: 0 }}>
                  <path d="M90 300 C 170 250, 250 250, 330 300 S 450 360, 500 300"
                        fill="none" stroke={C.amberInk} strokeWidth={5} strokeLinecap="round"
                        strokeDasharray={620}
                        strokeDashoffset={620 * (1 - ramp(frame, s(21.4), s(22.6), EASE_SOFT))}
                        opacity={0.8} />
                </svg>
              </DeviceFrame>
            </div>
          </At>

          <At x={1420} y={400} z={74} opacity={phoneIn * devicesOut}
              scale={0.94 + 0.06 * phoneIn}>
            <div style={{ transform: `translate(${(1 - phoneIn) * 70}px, 0)` }}>
              <DeviceFrame kind="phone" w={286} h={600}>
                <div style={{ transform: "scale(0.44)", transformOrigin: "0 0", width: 700, padding: 14 }}>
                  <NoteCard width={620} unfold={1} content={1} inkDraw={1} />
                </div>
              </DeviceFrame>
            </div>
          </At>
        </div>
      </AbsoluteFill>

      {/* ── Act V · resolve. Screen-space, not world-space: the room is gone. ── */}
      <AbsoluteFill style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 34, pointerEvents: "none",
      }}>
        <div style={{
          opacity: logoIn,
          transform: `translateY(${(1 - logoIn) * 20}px) scale(${0.96 + 0.04 * logoIn})`,
          display: "flex", alignItems: "center", gap: 22,
        }}>
          <div style={{
            width: 96, height: 96, borderRadius: 24, background: C.ink, color: C.white,
            fontFamily: FONT.sans, fontSize: 58, fontWeight: 700, letterSpacing: "-0.05em",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>T</div>
          <div style={{
            fontFamily: FONT.sans, fontSize: 74, fontWeight: 600,
            letterSpacing: "-0.035em", color: C.ink,
          }}>TafsirLab</div>
        </div>
        <div style={{
          opacity: endLine,
          transform: `translateY(${(1 - endLine) * 16}px)`,
          fontFamily: FONT.sans, fontSize: 38, fontWeight: 450,
          letterSpacing: "-0.012em", color: C.grey, textAlign: "center",
        }}>
          Every ayah deserves more than a highlight.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
