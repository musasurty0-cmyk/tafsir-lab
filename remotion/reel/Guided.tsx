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
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
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
export const GUIDED_DURATION = 1710; // 57.0s

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
  { f: s(3.70),  x: 0, y: -1620, scale: 0.80 },
  { f: s(7.30),  x: 0, y: -1600, scale: 0.81 },
  { f: s(9.20),  x: 0, y: -1520, scale: 0.90 },
  // Hold, completely still, on the name. This is the brand moment.
  { f: s(12.30), x: 0, y: -1520, scale: 0.90 },
  // Then the whole workspace — everything at once, so the viewer sees the
  // shape of the product before we go anywhere near a detail.
  { f: s(13.90), x: 0, y: 0, scale: 0.60, ease: EASE_OUT },
  { f: s(15.30), x: 0, y: 0, scale: 0.60 },
  // ...and only now push in to the Mushaf.
  { f: s(16.80), x: wx(880), y: wy(520), scale: 1.16 },
  { f: s(18.60), x: wx(880), y: wy(560), scale: 1.26 },
  // Editor — the notes column
  { f: s(19.20),  x: wx(660), y: wy(360), scale: 1.24 },
  { f: s(22.40),  x: wx(640), y: wy(520), scale: 1.38 },
  { f: s(24.30),  x: wx(660), y: wy(470), scale: 1.28 },
  // Canvas — colour laid onto the ayat
  { f: s(25.80),  x: wx(880), y: wy(500), scale: 1.18 },
  { f: s(29.00),  x: wx(900), y: wy(540), scale: 1.28 },
  // Handwriting — closest we get
  // Wide enough to hold the circle, the arrow AND the margin sentence in one
  // frame — the annotation has to be watched being made as a whole.
  { f: s(30.60),  x: wx(800), y: wy(520), scale: 0.98 },
  { f: s(35.00),  x: wx(800), y: wy(520), scale: 0.98 },  // locked off while writing
  // Tafsir drawer (app x 1080..1640)
  { f: s(35.80),  x: wx(1140), y: wy(470), scale: 0.96 },
  { f: s(40.40),  x: wx(1150), y: wy(520), scale: 1.00 },
  // The word — close, then ease back just enough to hold its own notes.
  { f: s(40.60), x: wx(1010), y: wy(551), scale: 1.50 },
  { f: s(43.40), x: wx(900),  y: wy(700), scale: 0.94 },
  { f: s(45.00), x: wx(900),  y: wy(700), scale: 0.94 },
  // Back out to the whole workspace, which then turns edge-on and away.
  { f: s(46.80), x: 0, y: 0, scale: 0.60, ease: EASE_OUT },
  { f: s(49.40), x: 0, y: 0, scale: 0.62 },
  { f: s(52.60), x: 0, y: 0, scale: 0.68 },
];

/* The six places a person's Qur'an study actually lives today. */
const FRAGMENTS = [
  { kind: "notes",   label: "Notes",      x: -312, y: -2020, w: 468, r: -3.4, d: 0 },
  { kind: "quran",   label: "Qur’an App", x:  296, y: -1908, w: 452, r:  2.6, d: 5 },
  { kind: "search",  label: "Search",     x: -348, y: -1566, w: 486, r:  1.8, d: 10 },
  { kind: "pdf",     label: "PDF",        x:  286, y: -1472, w: 444, r: -3.1, d: 15 },
  { kind: "onenote", label: "OneNote",    x: -262, y: -1094, w: 470, r:  3.2, d: 20 },
  { kind: "notion",  label: "Notion",     x:  334, y: -1188, w: 448, r: -2.2, d: 25 },
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
  const appIn = ramp(frame, s(12.40), s(13.40), EASE_OUT);

  /* mode is driven by the cursor clicking a tab */
  const mode: "editor" | "canvas" =
    frame < s(18.95) ? "canvas" : frame < s(24.60) ? "editor" : "canvas";
  const sidebar = mode === "editor" ? 1 : 0;

  /* Editor beats */
  const edScroll = interpolate(frame, [s(19.20), s(21.80)], [0, 300],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SOFT });
  const edSelect = ramp(frame, s(22.00), s(22.40));
  const edTyped = ramp(frame, s(19.60), s(21.60), EASE_SOFT);

  /* Canvas beats */
  /* The page arrives already annotated — prior study — and the later beat adds
     to it. A Mushaf that starts blank looks like a demo, not a workspace. */
  const inception = ramp(frame, s(13.40), s(14.40), EASE_SOFT);
  const hl = Math.max(inception * 0.55, ramp(frame, s(25.40), s(28.80), EASE_SOFT));
  const ink = Math.max(inception * 0.50, ramp(frame, s(29.80), s(34.20), EASE_SOFT));

  /* Tafsīr */
  const drawer = spring({ frame: frame - s(34.80), fps, config: { damping: 200, stiffness: 62, mass: 1.1 } });
  const tLang = frame >= s(39.40) ? 2 : 1;              // English → Arabic
  const tTab = frame >= s(39.40) && frame < s(40.80) ? 0 : frame >= s(40.80) ? 1 : 0; // → Word-by-word
  const drawerClose = 1 - ramp(frame, s(41.00), s(41.80), EASE_SOFT);

  /* The word and its note */
  /* Clicking the word clears the page-level annotations and opens that word's
     own space — no green box, an actual change of state. */
  const wordGlow = pulse(frame, s(42.05), s(42.35), s(43.60), s(44.10));
  const clearInk = ramp(frame, s(42.10), s(42.90), EASE_SOFT);
  const wordInk  = ramp(frame, s(43.00), s(46.40), EASE_SOFT);
  /* no invented note card: the word-note beat is carried by the real
     selection ring on the glyph plus the Tafsir word-by-word tab. */

  /* The name, revealed where the fragments converged. */
  const brand = pulse(frame, s(8.90), s(9.60), s(12.10), s(12.60));

  /* Editor slash command */
  const slash = pulse(frame, s(22.10), s(22.40), s(23.20), s(23.40));
  const embed = ramp(frame, s(23.30), s(23.90), EASE_SOFT);

  /* Establishing shot: the workspace as an object on a blank page. */
  const establish = pulse(frame, s(13.20), s(14.10), s(15.60), s(16.80));


  /* The workspace turns edge-on and is gone; the closing lines land on the
     white it leaves behind. backface-visibility removes it past 90deg, so no
     fade is needed to hide it. */
  const flip = ramp(frame, s(47.10), s(48.80), EASE_SOFT);   // 0→1 = 180°
  /* The turned-over panel holds, then leaves so the logo has a clean white. */
  const panelOut = ramp(frame, s(51.60), s(52.40), EASE_SOFT);

  /* Guides */
  const g1 = pulse(frame, s(15.00), s(15.60), s(17.20), s(17.70));    // Study every ayah.
  const g2 = pulse(frame, s(19.60), s(20.20), s(21.60), s(22.10));  // Write what you understand.
  const g3 = pulse(frame, s(26.20), s(26.80), s(28.60), s(29.10));  // Think visually.
  const g4 = pulse(frame, s(36.20), s(36.80), s(38.80), s(39.30));  // Read classical tafsir.
  const g5 = pulse(frame, s(43.00), s(43.60), s(45.20), s(45.70));  // Understand every word.

  /* Ending */
  const worldOut = 1 - ramp(frame, s(51.70), s(52.40), EASE_SOFT);
  const logoIn = ramp(frame, s(52.90), s(53.60), EASE_OUT);
  const endIn = ramp(frame, s(53.60), s(54.20), EASE_OUT);

  /* Cursor path — every state change above is caused by it. */
  const cursorAt = (pts: [number, number, number][]) => {
    const fs = pts.map((p) => p[0]);
    return {
      x: interpolate(frame, fs, pts.map((p) => p[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SOFT }),
      y: interpolate(frame, fs, pts.map((p) => p[2]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SOFT }),
    };
  };
  /* Measured control centres in app coordinates (see app.tsx layout):
       Editor tab (484,31) · Canvas tab (584,31) · Tafsīr (1241,31)
       Arabic source (1324,92) · Word-by-word tab (1272,138)
       the marked word إِيَّاكَ (1101,551)
     The cursor is ON the control at the frame it is pressed — the click is
     never mimed next to the thing it is supposed to be clicking. */
  const cur = cursorAt([
    [s(17.20), wx(980),  wy(560)],
    [s(18.70), wx(484),  wy(31)],    // travel to Editor tab
    [s(18.95), wx(484),  wy(31)],    // press
    [s(19.20), wx(620),  wy(300)],   // into the note body
    [s(22.00), wx(600),  wy(300)],   // onto the /ayah row in the slash menu
    [s(24.30), wx(584),  wy(31)],    // travel to Canvas tab
    [s(24.55), wx(584),  wy(31)],    // press
    [s(26.60), wx(980),  wy(470)],   // onto the ayah
    [s(29.80), wx(980),  wy(470)],
    [s(34.50), wx(1241), wy(31)],    // travel to Tafsīr
    [s(34.75), wx(1241), wy(31)],    // press
    [s(39.10), wx(1324), wy(92)],    // Arabic source
    [s(39.35), wx(1324), wy(92)],    // press
    [s(40.50), wx(1272), wy(138)],   // Word-by-word tab
    [s(40.75), wx(1272), wy(138)],   // press
    [s(41.80), wx(1101), wy(551)],   // the word itself
    [s(42.05), wx(1101), wy(551)],   // press
    [s(44.20), wx(1101), wy(600)],
  ]);
  const curVis = pulse(frame, s(17.00), s(17.40), s(45.80), s(46.30));
  const CLICKS = [18.95, 23.25, 24.55, 34.75, 39.35, 40.75, 42.05];
  const press = Math.max(...CLICKS.map((c) => pulse(frame, s(c) - 1, s(c), s(c) + 2, s(c) + 5)));

  return (
    <AbsoluteFill style={{ background: "#FFFFFF", overflow: "hidden" }}>
      <AbsoluteFill style={{ perspective: 2600, opacity: worldOut }}>
        <div style={{
          position: "absolute", left: 0, top: 0, width: 0, height: 0,
          transform: camTransform(cam), transformOrigin: "0 0", transformStyle: "preserve-3d",
        }}>
          {/* ── Act I · the question. Each line is its own nowrap block, so
                 the ellipsis always stays welded to "Qur’an". ── */}
          <At x={0} y={-3080} z={40} opacity={line1}>
            <div style={{
              fontFamily: FONT.sans, fontSize: 74, fontWeight: 600,
              letterSpacing: "-0.03em", lineHeight: 1.22, color: C.ink,
              textAlign: "center", whiteSpace: "nowrap",
            }}>
              <div>Have you ever wanted</div>
              <div>to study the Qur’an…</div>
            </div>
          </At>
          <At x={0} y={-2900} z={40} opacity={line2}>
            <div style={{
              fontFamily: FONT.sans, fontSize: 74, fontWeight: 600,
              letterSpacing: "-0.03em", color: C.ink, whiteSpace: "nowrap",
            }}>truly?</div>
          </At>

          {/* ── Act I · the six places study currently lives ── */}
          {FRAGMENTS.map((f, i) => {
            const inS = spring({ frame: frame - s(3.30) - f.d, fps, config: { damping: 190, stiffness: 80, mass: 1 } });
            // They are not deleted — they are drawn INTO the workspace.
            const pull = ramp(frame, s(7.60), s(8.90), EASE_SOFT);
            return (
              <At key={f.kind}
                  x={interpolate(pull, [0, 1], [f.x, 0])}
                  y={interpolate(pull, [0, 1], [f.y, -1520])}
                  z={10 + i}
                  opacity={inS * (1 - ramp(frame, s(8.40), s(9.05), EASE_SOFT))}
                  rotate={f.r * (1 - pull)}
                  scale={(0.94 + 0.06 * inS) * interpolate(pull, [0, 1], [1, 0.34])}>
                <AppCard kind={f.kind} label={f.label} w={f.w} />
              </At>
            );
          })}
          <At x={0} y={-1560} z={9} opacity={pulse(frame, s(4.20), s(4.80), s(7.40), s(7.90))}>
            <ScatterArrows draw={ramp(frame, s(4.30), s(6.40), EASE_SOFT)} />
          </At>
          <At x={0} y={-820} z={40}>
            <VerdictPill o={pulse(frame, s(5.90), s(6.50), s(7.40), s(7.90))} />
          </At>
          <At x={0} y={-2430} z={41}>
            <Headline eyebrow="But studying the Qur’an" line1="often feels like"
                      line2="juggling too much."
                      o={pulse(frame, s(3.10), s(3.80), s(7.30), s(7.80))} />
          </At>
          <At x={0} y={-2430} z={41}>
            <Headline eyebrow="There should be" line1="one place for everything."
                      line2="Connected. Focused."
                      o={pulse(frame, s(8.20), s(8.80), s(14.90), s(15.40))} />
          </At>

          {/* ── The panel's reverse face. Pre-rotated 180°, so back-face
                 culling keeps it hidden until the turn passes edge-on — then
                 it is simply what you are looking at. ── */}
          <At x={0} y={0} z={31} opacity={(1 - panelOut) * appIn}>
            <div style={{
              width: APP_W, height: APP_H, background: "#FFFFFF",
              borderRadius: 12,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 18,
              transform: `perspective(2200px) rotateY(${180 - flip * 180}deg)`,
              transformOrigin: "50% 50%",
              backfaceVisibility: "hidden",
            }}>
              <div style={{
                fontFamily: FONT.sans, fontSize: 190, fontWeight: 600,
                letterSpacing: "-0.035em", color: C.ink, whiteSpace: "nowrap",
                lineHeight: 1.05,
              }}>Everything.</div>
              <div style={{
                fontFamily: FONT.sans, fontSize: 190, fontWeight: 600,
                letterSpacing: "-0.035em", color: C.ink, whiteSpace: "nowrap",
                lineHeight: 1.05,
              }}>One workspace.</div>
            </div>
          </At>

          {/* ── The name, at the point the fragments converged ── */}
          <At x={0} y={-1520} z={44} opacity={brand}>
            <div style={{
              display: "flex", alignItems: "center", gap: 22,
              transform: `scale(${0.94 + 0.06 * brand})`,
            }}>
              <div style={{
                width: 88, height: 88, borderRadius: 22, background: C.ink, color: "#fff",
                fontFamily: FONT.sans, fontSize: 52, fontWeight: 700, letterSpacing: "-0.05em",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>T</div>
              <div style={{
                fontFamily: FONT.sans, fontSize: 72, fontWeight: 600,
                letterSpacing: "-0.035em", color: C.ink, whiteSpace: "nowrap",
              }}>TafsirLab</div>
            </div>
          </At>

          {/* ── The application ── */}
          <At x={0} y={0} z={30} opacity={appIn}
              scale={interpolate(appIn, [0, 1], [0.9, 1])}
              origin="50% 50%">
            <div style={{
              transform: `perspective(3200px) rotateX(${establish * 7}deg) rotateY(${establish * -9}deg)`,
              borderRadius: 18 + establish * 8,
              overflow: "hidden",
              boxShadow: establish > 0.01
                ? `0 ${40 + establish * 60}px ${90 + establish * 90}px rgba(20,20,20,${0.10 + establish * 0.10}), 0 8px 26px rgba(20,20,20,0.07)`
                : "0 30px 90px rgba(20,20,20,0.09)",
              transformStyle: "preserve-3d",
            }}>
            <AppShell
              mode={mode}
              sidebar={sidebar}
              crumb={["Study Group", "Al-Fatihah", "A"]}
              flip={flip}
              drawerOpen={drawer * drawerClose}
              drawer={<TafsirDrawerReal lang={tLang} tab={tTab} />}
            >
              {mode === "editor"
                ? <EditorDoc scroll={edScroll} typed={edTyped} selection={edSelect}
                              slash={slash} embed={embed} />
                : <CanvasDoc hl={hl} ink={ink} wordGlow={wordGlow}
                              clearInk={clearInk} wordInk={wordInk}
                              tool={frame >= s(29.40) ? 1 : 0} />}
            </AppShell>
            </div>
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


      {/* ── Sound design ────────────────────────────────────────────────
          Only diegetic interface sound: a click where a control is actually
          pressed, a shutter as each fragment card lands, a whoosh where a
          panel travels, and keyboard only for the exact span of typing.
          Everything sits low; silence is the default. */}
      {CLICKS.map((c, i) => (
        <Sequence key={`clk${i}`} from={Math.round(s(c))} durationInFrames={22}>
          <Audio src={staticFile("sfx/click.mp3")} volume={0.5} />
        </Sequence>
      ))}
      {FRAGMENTS.map((f, i) => (
        <Sequence key={`sh${i}`} from={Math.round(s(3.30) + f.d + 6)} durationInFrames={26}>
          <Audio src={staticFile("sfx/shutter.mp3")} volume={0.26} />
        </Sequence>
      ))}
      {/* the fragments being drawn into the workspace */}
      <Sequence from={Math.round(s(7.60))} durationInFrames={44}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.34} />
      </Sequence>
      <Sequence from={Math.round(s(47.10))} durationInFrames={44}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.30} />
      </Sequence>
      {/* the Tafsir drawer travelling in, and back out */}
      <Sequence from={Math.round(s(34.80))} durationInFrames={44}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.30} />
      </Sequence>
      <Sequence from={Math.round(s(41.00))} durationInFrames={40}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.22} />
      </Sequence>
      {/* keyboard runs ONLY while the sentence is actually being typed */}
      <Sequence from={Math.round(s(19.60))} durationInFrames={Math.round(s(21.60) - s(19.60))}>
        <Audio src={staticFile("sfx/typing.mp3")} volume={0.32} />
      </Sequence>

      {/* ── Resolve ── */}
      <AbsoluteFill style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 26, pointerEvents: "none",
      }}>

        <div style={{
          opacity: logoIn, transform: `translateY(${(1 - logoIn) * 16}px)`,
          display: "flex", alignItems: "center", gap: 20,
        }}>
          <div style={{
            width: 110, height: 110, borderRadius: 27, background: C.ink, color: "#fff",
            fontFamily: FONT.sans, fontSize: 66, fontWeight: 700, letterSpacing: "-0.05em",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>T</div>
          <div style={{
            fontFamily: FONT.sans, fontSize: 86, fontWeight: 600,
            letterSpacing: "-0.035em", color: C.ink,
          }}>TafsirLab</div>
        </div>
        <div style={{
          opacity: endIn, transform: `translateY(${(1 - endIn) * 12}px)`,
          fontFamily: FONT.sans, fontSize: 44, fontWeight: 450,
          letterSpacing: "-0.008em", color: "#8A8A8A", textAlign: "center",
        }}>Finally, a workspace built for the Qur’an.</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
