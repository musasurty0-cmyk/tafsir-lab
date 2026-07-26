/**
 * Guided.tsx — TafsirLab launch film · 1080x1920 · 30fps · 45.0s
 *
 * One uninterrupted study session, watched in real time. The app is a single
 * object at world origin; the camera moves *within* it and every change of
 * state happens because the cursor did something — never because the timeline
 * reached a frame number.
 *
 * Beat map (seconds):
 *   0.0–3.5   white · "Have you ever wanted to study the Qur'an…" / "…truly?"
 *   3.5–7.0   five windows; the cursor closes them; they resolve into one app
 *   7.0–11.5  the Mushaf                      · "Study every ayah."
 *  11.5–18.0  Editor: real Al-Fātiḥah notes   · "Write what you understand."
 *  18.0–23.0  Canvas: ayah highlights         · "Think visually."
 *  23.0–28.0  handwriting, drawn by the pen
 *  28.0–34.5  Tafsīr: English → Arabic → word · "Read classical tafsir."
 *  34.5–39.5  a word's own note opens in place· "Understand every word."
 *  39.5–42.5  pull back — one workspace
 *  42.5–45.0  white · logo · closing line
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadAmiri } from "@remotion/google-fonts/Amiri";
import { loadFont as loadGaramond } from "@remotion/google-fonts/EBGaramond";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { C, FONT, s, cameraAt, camTransform, ramp, pulse, EASE_OUT, EASE_SOFT, Pose } from "./theme";
import { AppShell, EditorDoc, CanvasDoc, TafsirDrawerReal, WordNote, APP_W, APP_H, P } from "./app";
import { AppWindow, Cursor, At } from "./ui";

loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"], ignoreTooManyRequestsWarning: true });
loadAmiri("normal", { weights: ["400", "700"], subsets: ["arabic"], ignoreTooManyRequestsWarning: true });
loadGaramond("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"], ignoreTooManyRequestsWarning: true });
loadCaveat("normal", { weights: ["400", "600"], subsets: ["latin"], ignoreTooManyRequestsWarning: true });

export const GUIDED_FPS = 30;
export const GUIDED_DURATION = 1350; // 45.0s

/* The app sits at world origin. Its own coordinates run
   x −820…820, y −515…515, so a point (ax, ay) inside the app maps to
   world (ax − APP_W/2, ay − APP_H/2). */
const wx = (ax: number) => ax - APP_W / 2;
const wy = (ay: number) => ay - APP_H / 2;

/* Camera. Never wider than 0.62 — below that the UI stops being readable,
   which is the one thing this film must never do. */
const CAM: Pose[] = [
  { f: 0,        x: 0, y: -1500, scale: 1.0 },
  { f: s(3.2),   x: 0, y: -1500, scale: 1.0 },
  { f: s(4.2),   x: -30, y: -1470, scale: 0.86, ry: -4, rx: 2 },
  { f: s(6.0),   x: 40,  y: -1510, scale: 0.82, ry: 5, rx: -1.5 },
  { f: s(7.0),   x: 0,   y: -1500, scale: 1.02 },
  // Into the app. Scales stay >=1.1 for every working beat: a 16:10 desktop in
  // a 9:16 frame only fills the screen when we frame a REGION of it, and the
  // brief's hard rule is that the UI must always be readable.
  { f: s(8.2),   x: wx(880), y: wy(520), scale: 1.16, ease: EASE_OUT },
  { f: s(11.2),  x: wx(880), y: wy(560), scale: 1.26 },
  // Editor — the notes column
  { f: s(12.8),  x: wx(660), y: wy(360), scale: 1.24 },
  { f: s(16.0),  x: wx(640), y: wy(520), scale: 1.38 },
  { f: s(17.9),  x: wx(660), y: wy(470), scale: 1.28 },
  // Canvas — colour laid onto the ayat
  { f: s(19.4),  x: wx(880), y: wy(500), scale: 1.18 },
  { f: s(22.6),  x: wx(900), y: wy(540), scale: 1.28 },
  // Handwriting — closest we get
  // Wide enough to hold the circle, the arrow AND the margin sentence in one
  // frame — the annotation has to be watched being made as a whole.
  { f: s(24.4),  x: wx(900), y: wy(500), scale: 1.06, ry: 3 },
  { f: s(27.8),  x: wx(860), y: wy(560), scale: 1.14, ry: -2 },
  // Tafsir drawer (app x 1080..1640)
  { f: s(29.4),  x: wx(1300), y: wy(460), scale: 1.22 },
  { f: s(34.0),  x: wx(1300), y: wy(560), scale: 1.30 },
  // The word, then its note
  { f: s(35.8),  x: wx(1010), y: wy(560), scale: 1.55, ry: 2 },
  { f: s(39.0),  x: wx(1000), y: wy(690), scale: 1.34 },
  // The only wide shot in the film — and only to say "one workspace".
  { f: s(41.4),  x: 0, y: 0, scale: 0.64 },
  { f: s(45.0),  x: 0, y: 0, scale: 0.64 },
];

const CHAOS = [
  { t: "Quran.com",  a: "#4F9A7A", x: -330, y: -1800, r: -6, w: 430, h: 300, k: "web"  as const, d: 0,  close: 4.30 },
  { t: "Notes",      a: "#F0C24B", x:  320, y: -1740, r:  5, w: 380, h: 270, k: "text" as const, d: 5,  close: 4.62 },
  { t: "OneNote",    a: "#8B5CF6", x: -240, y: -1320, r:  4, w: 400, h: 280, k: "text" as const, d: 10, close: 4.94 },
  { t: "tafsir.pdf", a: "#E5563F", x:  340, y: -1270, r: -5, w: 360, h: 300, k: "pdf"  as const, d: 15, close: 5.26 },
  { t: "Safari",     a: "#5B9BD5", x:  -60, y: -1060, r:  3, w: 420, h: 250, k: "web"  as const, d: 20, close: 5.58 },
];

/** Guiding typography — present, never narrating. */
const Guide: React.FC<{ text: string; o: number }> = ({ text, o }) => (
  <div style={{
    position: "absolute", left: 0, right: 0, bottom: 0, height: 520,
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "flex-end", gap: 14, paddingBottom: 210,
    background: "linear-gradient(to top, rgba(255,255,255,0.97) 34%, rgba(255,255,255,0.86) 58%, rgba(255,255,255,0) 100%)",
    opacity: o, transform: `translateY(${(1 - o) * 12}px)`, pointerEvents: "none",
  }}>
    <div style={{ width: 28, height: 2, background: "#DCD9D4", borderRadius: 2 }} />
    <div style={{
      fontFamily: FONT.sans, fontSize: 46, fontWeight: 600,
      letterSpacing: "-0.024em", color: C.ink, textAlign: "center",
    }}>{text}</div>
  </div>
);

export const Guided: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = cameraAt(CAM, frame);

  /* ── Act I ── */
  const line1 = pulse(frame, s(0.6), s(1.5), s(3.0), s(3.5));
  const line2 = pulse(frame, s(2.0), s(2.7), s(3.0), s(3.5));

  /* ── The app itself ── */
  const appIn = ramp(frame, s(6.4), s(7.4), EASE_OUT);

  /* mode is driven by the cursor clicking a tab */
  const mode: "editor" | "canvas" =
    frame < s(11.6) ? "canvas" : frame < s(18.2) ? "editor" : "canvas";
  const sidebar = mode === "editor" ? 1 : 0;

  /* Editor beats */
  const edScroll = interpolate(frame, [s(12.8), s(15.4)], [0, 300],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SOFT });
  const edSelect = ramp(frame, s(15.6), s(16.0));
  const edTyped = ramp(frame, s(16.2), s(17.9), EASE_SOFT);

  /* Canvas beats */
  const hl = ramp(frame, s(19.0), s(22.4), EASE_SOFT);
  const ink = ramp(frame, s(23.4), s(27.8), EASE_SOFT);

  /* Tafsīr */
  const drawer = spring({ frame: frame - s(28.4), fps, config: { damping: 200, stiffness: 62, mass: 1.1 } });
  const tLang = frame >= s(33.0) ? 2 : 1;              // English → Arabic
  const tTab = frame >= s(33.0) && frame < s(34.4) ? 0 : frame >= s(34.4) ? 1 : 0; // → Word-by-word
  const drawerClose = 1 - ramp(frame, s(34.6), s(35.4), EASE_SOFT);

  /* The word and its note */
  const wordGlow = ramp(frame, s(35.6), s(36.2));
  const noteOpen = spring({ frame: frame - s(36.4), fps, config: { damping: 200, stiffness: 88, mass: 0.9 } });
  const noteInk = ramp(frame, s(37.2), s(39.2), EASE_SOFT);

  /* Guides */
  const g1 = pulse(frame, s(8.6), s(9.2), s(10.8), s(11.3));    // Study every ayah.
  const g2 = pulse(frame, s(13.2), s(13.8), s(15.2), s(15.7));  // Write what you understand.
  const g3 = pulse(frame, s(19.8), s(20.4), s(22.2), s(22.7));  // Think visually.
  const g4 = pulse(frame, s(29.8), s(30.4), s(32.4), s(32.9));  // Read classical tafsir.
  const g5 = pulse(frame, s(36.6), s(37.2), s(38.8), s(39.3));  // Understand every word.

  /* Ending */
  const worldOut = 1 - ramp(frame, s(42.2), s(42.9), EASE_SOFT);
  const evr = pulse(frame, s(40.2), s(40.7), s(42.0), s(42.4));
  const one = pulse(frame, s(41.0), s(41.5), s(42.0), s(42.4));
  const logoIn = ramp(frame, s(43.0), s(43.7), EASE_OUT);
  const endIn = ramp(frame, s(43.7), s(44.3), EASE_OUT);

  /* Cursor path — every state change above is caused by it. */
  const cursorAt = (pts: [number, number, number][]) => {
    const fs = pts.map((p) => p[0]);
    return {
      x: interpolate(frame, fs, pts.map((p) => p[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SOFT }),
      y: interpolate(frame, fs, pts.map((p) => p[2]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SOFT }),
    };
  };
  const cur = cursorAt([
    [s(11.0), wx(1100), wy(560)],
    [s(11.5), wx(560),  wy(93)],   // Editor tab
    [s(15.4), wx(560),  wy(93)],
    [s(15.8), wx(430),  wy(300)],  // select the sentence
    [s(17.9), wx(700),  wy(430)],
    [s(18.1), wx(690),  wy(93)],   // Canvas tab
    [s(22.6), wx(690),  wy(93)],
    [s(23.2), wx(980),  wy(470)],  // pen strokes
    [s(27.6), wx(520),  wy(690)],
    [s(28.2), wx(1400), wy(93)],   // Tafsīr
    [s(34.4), wx(1400), wy(93)],
    [s(35.4), wx(1080), wy(560)],  // the word
    [s(36.4), wx(1080), wy(560)],
    [s(39.2), wx(1080), wy(620)],
  ]);
  const curVis = pulse(frame, s(10.6), s(11.0), s(39.4), s(39.9));
  const press = Math.max(
    pulse(frame, s(11.48), s(11.55), s(11.62), s(11.75)),
    pulse(frame, s(18.08), s(18.15), s(18.22), s(18.35)),
    pulse(frame, s(28.18), s(28.25), s(28.32), s(28.45)),
    pulse(frame, s(35.48), s(35.55), s(35.62), s(35.75)),
  );

  return (
    <AbsoluteFill style={{ background: "#FFFFFF", overflow: "hidden" }}>
      <AbsoluteFill style={{ perspective: 2600, opacity: worldOut }}>
        <div style={{
          position: "absolute", left: 0, top: 0, width: 0, height: 0,
          transform: camTransform(cam), transformOrigin: "0 0", transformStyle: "preserve-3d",
        }}>
          {/* ── Act I · the question ── */}
          <At x={0} y={-1560} z={40} opacity={line1}>
            <div style={{
              width: 940, textAlign: "center", fontFamily: FONT.sans, fontSize: 74,
              fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.18, color: C.ink,
            }}>Have you ever wanted<br />to study the Qur’an…</div>
          </At>
          <At x={0} y={-1400} z={40} opacity={line2}>
            <div style={{
              fontFamily: FONT.sans, fontSize: 74, fontWeight: 600,
              letterSpacing: "-0.03em", color: C.ink,
            }}>…truly?</div>
          </At>

          {/* ── Act I · the fragmented way we study now ── */}
          {CHAOS.map((w, i) => {
            const inS = spring({ frame: frame - s(3.7) - w.d, fps, config: { damping: 150, stiffness: 88, mass: 0.9 } });
            const gone = ramp(frame, s(w.close), s(w.close + 0.30), EASE_SOFT);
            return (
              <At key={w.t} x={w.x} y={w.y} z={10 + i}
                  opacity={inS * (1 - gone)} rotate={w.r * (1 - gone)}
                  scale={(0.88 + 0.12 * inS) * (1 - gone * 0.14)}>
                <AppWindow title={w.t} accent={w.a} w={w.w} h={w.h} kind={w.k} />
              </At>
            );
          })}

          {/* ── The application ── */}
          <At x={0} y={0} z={30} opacity={appIn}
              scale={interpolate(appIn, [0, 1], [0.9, 1])}>
            <AppShell
              mode={mode}
              sidebar={sidebar}
              crumb={["Study Group", "Al-Fatihah", "A"]}
              drawerOpen={drawer * drawerClose}
              drawer={<TafsirDrawerReal lang={tLang} tab={tTab} />}
            >
              {mode === "editor"
                ? <EditorDoc scroll={edScroll} typed={edTyped} selection={edSelect} />
                : <CanvasDoc hl={hl} ink={ink} wordGlow={wordGlow} tool={frame >= s(23.0) ? 1 : 0} />}
            </AppShell>
          </At>

          {/* the word's own note, opened in place on the canvas */}
          {noteOpen > 0.02 && (
            <At x={wx(1010)} y={wy(700)} z={60} opacity={Math.min(1, noteOpen * 2)}>
              <WordNote open={noteOpen} ink={noteInk} />
            </At>
          )}

          {/* cursor — the cause of every state change above */}
          <At x={cur.x} y={cur.y} z={95} opacity={curVis}>
            <Cursor press={press} />
          </At>
        </div>
      </AbsoluteFill>

      {/* ── Guiding typography (screen space, always legible) ── */}
      <Guide text="Study every ayah."        o={g1} />
      <Guide text="Write what you understand." o={g2} />
      <Guide text="Think visually."          o={g3} />
      <Guide text="Read classical tafsir."   o={g4} />
      <Guide text="Understand every word."   o={g5} />

      {/* ── Resolve ── */}
      <AbsoluteFill style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 26, pointerEvents: "none",
      }}>
        <div style={{
          position: "absolute", fontFamily: FONT.sans, fontSize: 62, fontWeight: 600,
          letterSpacing: "-0.028em", color: C.ink, opacity: evr,
          transform: `translateY(${-40 + (1 - evr) * 10}px)`,
        }}>Everything.</div>
        <div style={{
          position: "absolute", fontFamily: FONT.sans, fontSize: 62, fontWeight: 600,
          letterSpacing: "-0.028em", color: C.ink, opacity: one,
          transform: `translateY(${46 + (1 - one) * 10}px)`,
        }}>One workspace.</div>

        <div style={{
          opacity: logoIn, transform: `translateY(${(1 - logoIn) * 16}px)`,
          display: "flex", alignItems: "center", gap: 20,
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: 22, background: C.ink, color: "#fff",
            fontFamily: FONT.sans, fontSize: 52, fontWeight: 700, letterSpacing: "-0.05em",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>T</div>
          <div style={{
            fontFamily: FONT.sans, fontSize: 68, fontWeight: 600,
            letterSpacing: "-0.035em", color: C.ink,
          }}>TafsirLab</div>
        </div>
        <div style={{
          opacity: endIn, transform: `translateY(${(1 - endIn) * 12}px)`,
          fontFamily: FONT.sans, fontSize: 34, fontWeight: 450,
          letterSpacing: "-0.008em", color: "#8A8A8A", textAlign: "center",
        }}>Finally, a workspace built for the Qur’an.</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
