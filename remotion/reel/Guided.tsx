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
import { AppShell, EditorDoc, CanvasDoc, TafsirDrawerReal, APP_W, APP_H, P } from "./app";
import { Cursor, At } from "./ui";
import { AppCard, ScatterArrows, Headline, VerdictPill } from "./declutter";

loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"], ignoreTooManyRequestsWarning: true });
loadAmiri("normal", { weights: ["400", "700"], subsets: ["arabic"], ignoreTooManyRequestsWarning: true });
loadGaramond("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"], ignoreTooManyRequestsWarning: true });
loadCaveat("normal", { weights: ["400", "600"], subsets: ["latin"], ignoreTooManyRequestsWarning: true });

export const GUIDED_FPS = 30;
export const GUIDED_DURATION = 1420; // 47.3s

/* The app sits at world origin. Its own coordinates run
   x −820…820, y −515…515, so a point (ax, ay) inside the app maps to
   world (ax − APP_W/2, ay − APP_H/2). */
const wx = (ax: number) => ax - APP_W / 2;
const wy = (ay: number) => ay - APP_H / 2;

/* Camera. Never wider than 0.62 — below that the UI stops being readable,
   which is the one thing this film must never do. */
const CAM: Pose[] = [
  // Hold on the question, then settle over the scatter — wide enough to hold
  // all six cards (~1420px across), and completely still while they land.
  { f: 0,        x: 0, y: -3040, scale: 1.00 },
  { f: s(2.60),  x: 0, y: -3040, scale: 1.00 },
  { f: s(3.70),  x: 0, y: -1670, scale: 0.74 },
  { f: s(7.30),  x: 0, y: -1650, scale: 0.75 },
  { f: s(9.20),  x: 0, y: -1580, scale: 0.82 },
  // Into the app. Scales stay >=1.1 for every working beat: a 16:10 desktop in
  // a 9:16 frame only fills the screen when we frame a REGION of it, and the
  // brief's hard rule is that the UI must always be readable.
  { f: s(10.40),   x: wx(880), y: wy(520), scale: 1.16, ease: EASE_OUT },
  { f: s(13.40),  x: wx(880), y: wy(560), scale: 1.26 },
  // Editor — the notes column
  { f: s(15.00),  x: wx(660), y: wy(360), scale: 1.24 },
  { f: s(18.20),  x: wx(640), y: wy(520), scale: 1.38 },
  { f: s(20.10),  x: wx(660), y: wy(470), scale: 1.28 },
  // Canvas — colour laid onto the ayat
  { f: s(21.60),  x: wx(880), y: wy(500), scale: 1.18 },
  { f: s(24.80),  x: wx(900), y: wy(540), scale: 1.28 },
  // Handwriting — closest we get
  // Wide enough to hold the circle, the arrow AND the margin sentence in one
  // frame — the annotation has to be watched being made as a whole.
  { f: s(26.60),  x: wx(900), y: wy(500), scale: 1.06 },
  { f: s(30.00),  x: wx(860), y: wy(560), scale: 1.14 },
  // Tafsir drawer (app x 1080..1640)
  { f: s(31.60),  x: wx(1300), y: wy(460), scale: 1.22 },
  { f: s(36.20),  x: wx(1300), y: wy(560), scale: 1.30 },
  // The word, then its note
  { f: s(38.00),  x: wx(1010), y: wy(560), scale: 1.55 },
  { f: s(41.20),  x: wx(1000), y: wy(690), scale: 1.34 },
  // The only wide shot in the film — and only to say "one workspace".
  { f: s(43.60),  x: 0, y: 0, scale: 0.64 },
  { f: s(47.20),  x: 0, y: 0, scale: 0.64 },
];

/* The six places a person's Qur'an study actually lives today. */
const FRAGMENTS = [
  { kind: "notes",   label: "Notes",      x: -520, y: -1770, w: 300, d: 0 },
  { kind: "quran",   label: "Qur’an App", x: 470, y: -1810, w: 320, d: 5 },
  { kind: "search",  label: "Search",     x:  -40, y: -1610, w: 330, d: 10 },
  { kind: "pdf",     label: "PDF",        x: -520, y: -1430, w: 310, d: 15 },
  { kind: "onenote", label: "OneNote",    x:   30, y: -1300, w: 320, d: 20 },
  { kind: "notion",  label: "Notion",     x:  505, y: -1380, w: 300, d: 25 },
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
  const appIn = ramp(frame, s(6.4), s(9.60), EASE_OUT);

  /* mode is driven by the cursor clicking a tab */
  const mode: "editor" | "canvas" =
    frame < s(13.80) ? "canvas" : frame < s(20.40) ? "editor" : "canvas";
  const sidebar = mode === "editor" ? 1 : 0;

  /* Editor beats */
  const edScroll = interpolate(frame, [s(15.00), s(17.60)], [0, 300],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SOFT });
  const edSelect = ramp(frame, s(17.80), s(18.20));
  const edTyped = ramp(frame, s(18.40), s(20.10), EASE_SOFT);

  /* Canvas beats */
  const hl = ramp(frame, s(21.20), s(24.60), EASE_SOFT);
  const ink = ramp(frame, s(25.60), s(30.00), EASE_SOFT);

  /* Tafsīr */
  const drawer = spring({ frame: frame - s(30.60), fps, config: { damping: 200, stiffness: 62, mass: 1.1 } });
  const tLang = frame >= s(35.20) ? 2 : 1;              // English → Arabic
  const tTab = frame >= s(35.20) && frame < s(36.60) ? 0 : frame >= s(36.60) ? 1 : 0; // → Word-by-word
  const drawerClose = 1 - ramp(frame, s(36.80), s(37.60), EASE_SOFT);

  /* The word and its note */
  const wordGlow = ramp(frame, s(37.80), s(38.40));
  /* no invented note card: the word-note beat is carried by the real
     selection ring on the glyph plus the Tafsir word-by-word tab. */

  /* Guides */
  const g1 = pulse(frame, s(10.80), s(11.40), s(13.00), s(13.50));    // Study every ayah.
  const g2 = pulse(frame, s(15.40), s(16.00), s(17.40), s(17.90));  // Write what you understand.
  const g3 = pulse(frame, s(22.00), s(22.60), s(24.40), s(24.90));  // Think visually.
  const g4 = pulse(frame, s(32.00), s(32.60), s(34.60), s(35.10));  // Read classical tafsir.
  const g5 = pulse(frame, s(38.80), s(39.40), s(41.00), s(41.50));  // Understand every word.

  /* Ending */
  const worldOut = 1 - ramp(frame, s(44.40), s(45.10), EASE_SOFT);
  const evr = pulse(frame, s(42.40), s(42.90), s(44.20), s(44.60));
  const one = pulse(frame, s(43.20), s(43.70), s(44.20), s(44.60));
  const logoIn = ramp(frame, s(45.20), s(45.90), EASE_OUT);
  const endIn = ramp(frame, s(45.90), s(46.50), EASE_OUT);

  /* Cursor path — every state change above is caused by it. */
  const cursorAt = (pts: [number, number, number][]) => {
    const fs = pts.map((p) => p[0]);
    return {
      x: interpolate(frame, fs, pts.map((p) => p[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SOFT }),
      y: interpolate(frame, fs, pts.map((p) => p[2]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SOFT }),
    };
  };
  const cur = cursorAt([
    [s(13.20), wx(1100), wy(560)],
    [s(13.70), wx(560),  wy(93)],   // Editor tab
    [s(17.60), wx(560),  wy(93)],
    [s(18.00), wx(430),  wy(300)],  // select the sentence
    [s(20.10), wx(700),  wy(430)],
    [s(20.30), wx(690),  wy(93)],   // Canvas tab
    [s(24.80), wx(690),  wy(93)],
    [s(25.40), wx(980),  wy(470)],  // pen strokes
    [s(29.80), wx(520),  wy(690)],
    [s(30.40), wx(1400), wy(93)],   // Tafsīr
    [s(36.60), wx(1400), wy(93)],
    [s(37.60), wx(1080), wy(560)],  // the word
    [s(38.60), wx(1080), wy(560)],
    [s(41.40), wx(1080), wy(620)],
  ]);
  const curVis = pulse(frame, s(12.80), s(13.20), s(41.60), s(42.10));
  const press = Math.max(
    pulse(frame, s(13.68), s(13.75), s(13.82), s(13.95)),
    pulse(frame, s(20.28), s(20.35), s(20.42), s(20.55)),
    pulse(frame, s(30.38), s(30.45), s(30.52), s(30.65)),
    pulse(frame, s(37.68), s(37.75), s(37.82), s(37.95)),
  );

  return (
    <AbsoluteFill style={{ background: "#FFFFFF", overflow: "hidden" }}>
      <AbsoluteFill style={{ perspective: 2600, opacity: worldOut }}>
        <div style={{
          position: "absolute", left: 0, top: 0, width: 0, height: 0,
          transform: camTransform(cam), transformOrigin: "0 0", transformStyle: "preserve-3d",
        }}>
          {/* ── Act I · the question ── */}
          <At x={0} y={-3080} z={40} opacity={line1}>
            <div style={{
              width: 940, textAlign: "center", fontFamily: FONT.sans, fontSize: 74,
              fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.18, color: C.ink,
            whiteSpace: "nowrap" }}>Have you ever wanted<br />to study the Qur’an…</div>
          </At>
          <At x={0} y={-2930} z={40} opacity={line2}>
            <div style={{
              fontFamily: FONT.sans, fontSize: 74, fontWeight: 600,
              letterSpacing: "-0.03em", color: C.ink,
            }}>…truly?</div>
          </At>

          {/* ── Act I · the six places study currently lives ── */}
          {FRAGMENTS.map((f, i) => {
            const inS = spring({ frame: frame - s(3.30) - f.d, fps, config: { damping: 190, stiffness: 80, mass: 1 } });
            // They are not deleted — they are drawn INTO the workspace.
            const pull = ramp(frame, s(7.60), s(8.90), EASE_SOFT);
            return (
              <At key={f.kind}
                  x={interpolate(pull, [0, 1], [f.x, 220])}
                  y={interpolate(pull, [0, 1], [f.y, -1520])}
                  z={10 + i}
                  opacity={inS * (1 - ramp(frame, s(8.40), s(9.05), EASE_SOFT))}
                  scale={(0.94 + 0.06 * inS) * interpolate(pull, [0, 1], [1, 0.34])}>
                <AppCard kind={f.kind} label={f.label} w={f.w} />
              </At>
            );
          })}
          <At x={-30} y={-1555} z={9} opacity={pulse(frame, s(4.20), s(4.80), s(7.40), s(7.90))}>
            <ScatterArrows draw={ramp(frame, s(4.30), s(6.40), EASE_SOFT)} />
          </At>
          <At x={0} y={-1085} z={40}>
            <VerdictPill o={pulse(frame, s(5.90), s(6.50), s(7.40), s(7.90))} />
          </At>
          <At x={0} y={-2140} z={41}>
            <Headline eyebrow="But studying the Qur’an" line1="often feels like"
                      line2="juggling too much."
                      o={pulse(frame, s(3.10), s(3.80), s(7.30), s(7.80))} />
          </At>
          <At x={0} y={-2140} z={41}>
            <Headline eyebrow="There should be" line1="one place for everything."
                      line2="Connected. Focused."
                      o={pulse(frame, s(8.20), s(8.80), s(10.70), s(11.20))} />
          </At>

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
                : <CanvasDoc hl={hl} ink={ink} wordGlow={wordGlow} tool={frame >= s(25.20) ? 1 : 0} />}
            </AppShell>
          </At>


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
