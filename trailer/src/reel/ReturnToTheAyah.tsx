import React from "react";
import {
  AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import {
  FRAME_W, FRAME_H, Stage, Card, Words, Rise, Say, Focus, rack,
  SmearCursor, morphAt, themeAt, ThemeProvide, useTheme,
  type MState, type Leg,
} from "./morph";

/* ── "Everything returns to the āyah" ──────────────────────────────────────
   The flagship. One container, seven surfaces, and it comes back to the exact
   geometry it started in — so the last frame is compositionally identical to
   frame 0 and the loop is real rather than implied (MOTION-STUDY §7).

   The argument the structure makes: a line of Qur'an on its own is just words
   on a page. Everything TafsirLab does grows out of that line and returns to
   it. Nothing here is a feature tour; it is one object changing state, which
   is the single strongest thing the reference reels do (§6) — ClickUp gets
   seven "screens" out of one rounded rectangle without a single cut.

   Two things this does that the references do not:

   · IT RETURNS. Theirs loop by replaying; this one closes. The final state is
     the opening state, so the piece argues that you end where you began having
     understood it, which is what tafsir actually is.

   · THE THEME IS THE ARC. Light while the line is closed, drifting dark as it
     opens into study, back to light as it folds shut. The mode change carries
     meaning instead of being a mode change.

   Pacing follows §7 — a visible state change every 1.3-2.0s — but the CONTAINER
   morphs at roughly 4s. The cadence is carried by content changing inside a
   stately object, which is how the references stay calm and quick at once.  */

const FPS = 60;
export const RETURN_FRAMES = 28 * FPS;      // 1680

const AYAH    = "أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ";
const AYAH_EN = "Do they not reflect upon the Qur'ān?";
const AYAH_REF = "Muḥammad 47:24";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/* ── The seven states ──────────────────────────────────────────────────────
   `dir` alternates so the swaps use the frame's width AND height while the
   subject itself never leaves centre (§1: the object is looked at, it does not
   wander). `via: reflow` on the note because the block does not become a
   different surface there — the page grows around it, and blurring a document
   away to bring it back 400px taller is a transition with no cause.        */
const S: MState[] = [
  { key: "ayah",   at: 0,    morph: 24, w: 820, h: 250, r: 22, ease: "glide" },
  { key: "search", at: 250,  morph: 32, w: 870, h: 520, r: 26, dir: "up",    ease: "smooth" },
  { key: "block",  at: 500,  morph: 32, w: 890, h: 440, r: 24, dir: "left",  ease: "back"  },
  { key: "note",   at: 730,  morph: 26, w: 910, h: 940, r: 26, via: "reflow", ease: "glide" },
  { key: "tafsir", at: 960,  morph: 40, w: 950, h: 1060, r: 28, dir: "left", ease: "smooth" },
  { key: "map",    at: 1190, morph: 40, w: 985, h: 1150, r: 30, dir: "up",   ease: "smooth" },
  { key: "ayah2",  at: 1430, morph: 40, w: 820, h: 250, r: 22, dir: "down",  ease: "glide", exit: "fall" },
];

/* Light → dark as the line opens, back to light as it closes. */
/** themeAt() hands back a Theme, so the 0..1 position is computed separately —
 *  the cursor needs the scalar to know which stroke colour to draw. */
const themeT = (f: number) => {
  const K = THEME_KEYS;
  let a = K[0];
  for (const k of K) if (k.at <= f) a = k;
  const b = K[K.indexOf(a) + 1];
  if (!b) return a.t;
  const t = Math.max(0, Math.min(1, (f - a.at) / (b.at - a.at)));
  return a.t + (b.t - a.t) * t;
};

const THEME_KEYS = [
  { at: 0, t: 0 }, { at: 860, t: 0 }, { at: 1080, t: 1 },
  { at: 1330, t: 1 }, { at: 1520, t: 0 },
];

/* The cursor is never parked — it drifts through every hold and its smear
   scales with speed (§4). These legs are the shape of a hand working, not a
   pointer being teleported to the next button. */
const LEGS: Leg[] = [
  { at: 0,    to: { x: 760, y: 1180 } },
  { at: 250,  to: { x: 505, y: 880 } },
  { at: 330,  to: { x: 505, y: 880 }, click: true },
  { at: 470,  to: { x: 600, y: 1010 } },
  { at: 520,  to: { x: 600, y: 1010 }, click: true },
  { at: 700,  to: { x: 420, y: 1240 } },
  { at: 950,  to: { x: 800, y: 700 } },
  { at: 1000, to: { x: 800, y: 700 }, click: true },
  { at: 1180, to: { x: 540, y: 1420 } },
  { at: 1400, to: { x: 900, y: 1600 } },
];

// ── Content per surface ────────────────────────────────────────────────────

const Ar: React.FC<{ f: number; start: number; size: number }> = ({ f, start, size }) => {
  const th = useTheme();
  return (
    <div style={{ direction: "rtl", textAlign: "center" }}>
      {/* dx NEGATIVE: the catch-up has to trail the reading flow, and Arabic
          runs right to left, so the default +38 would slide each word over the
          one before it. */}
      <Words f={f} start={start} text={AYAH} dx={-34} step={9} travel={24}
             style={{
               fontFamily: R.fontArabic, fontSize: size, lineHeight: 1.9,
               color: th.ink,
             }} />
    </div>
  );
};

const Label: React.FC<{ children: React.ReactNode; mt?: number }> = ({ children, mt = 0 }) => {
  const th = useTheme();
  return (
    <div style={{
      fontFamily: R.fontMono, fontSize: 19, letterSpacing: "0.12em",
      textTransform: "uppercase", color: th.ink3, marginTop: mt,
    }}>{children}</div>
  );
};

const Surface: React.FC<{ k: string; f: number; start: number }> = ({ k, f, start }) => {
  const th = useTheme();
  const pad = 44;

  if (k === "ayah" || k === "ayah2") {
    return (
      <div style={{ padding: pad, display: "grid", placeItems: "center", height: "100%" }}>
        <Ar f={f} start={start} size={62} />
      </div>
    );
  }

  if (k === "search") {
    /* The content changes on the reference's own cadence — a new row every
       ~1.5s — while the container holds still. */
    const rows = f < start + 70 ? 1 : f < start + 150 ? 2 : 3;
    return (
      <div style={{ padding: 34, height: "100%" }}>
        <div style={{
          borderBottom: `1px solid ${th.line}`, paddingBottom: 22, marginBottom: 20,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{ fontSize: 30, color: th.ink4 }}>⌕</span>
          <span style={{
            fontFamily: R.fontArabic, fontSize: 36, color: th.ink, direction: "rtl",
          }}>يتدبرون</span>
        </div>
        {["أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ", "أَفَلَا يَتَدَبَّرُونَ الْقَوْلَ", "كِتَابٌ أَنْزَلْنَاهُ مُبَارَكٌ"]
          .slice(0, rows).map((t, i) => (
          <Rise key={t} f={f} start={start + 26 + i * 78} i={0} style={{
            display: "flex", alignItems: "baseline", gap: 16,
            padding: "16px 14px", borderRadius: 10,
            background: i === 0 ? th.panel : "transparent",
          }}>
            <span style={{ fontFamily: R.fontMono, fontSize: 19, color: th.ink4 }}>
              {["47:24", "23:68", "38:29"][i]}
            </span>
            <span style={{
              fontFamily: R.fontArabic, fontSize: 31, color: th.ink,
              direction: "rtl", lineHeight: 1.9,
            }}>{t}</span>
          </Rise>
        ))}
      </div>
    );
  }

  if (k === "block") {
    return (
      <div style={{ padding: pad, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Rise f={f} start={start} i={0}><Label>{AYAH_REF}</Label></Rise>
        <div style={{ marginTop: 26 }}><Ar f={f} start={start + 10} size={54} /></div>
        <Rise f={f} start={start + 34} i={0} style={{ marginTop: 26 }}>
          <div style={{
            fontFamily: R.fontSerif, fontSize: 30, color: th.ink2, textAlign: "center",
          }}>{AYAH_EN}</div>
        </Rise>
      </div>
    );
  }

  if (k === "note") {
    /* reflow: the block above stays exactly where it is and the page grows
       around it. Only the new lines animate. */
    return (
      <div style={{ padding: pad, height: "100%" }}>
        <Label>{AYAH_REF}</Label>
        <div style={{ marginTop: 22 }}><Ar f={f} start={start - 200} size={50} /></div>
        <div style={{
          fontFamily: R.fontSerif, fontSize: 27, color: th.ink2,
          textAlign: "center", marginTop: 20, marginBottom: 34,
        }}>{AYAH_EN}</div>
        <div style={{ height: 1, background: th.line, marginBottom: 30 }} />
        {[
          "The question is not rhetorical.",
          "It is put to people who have the Book.",
          "Reciting it was never the difficulty.",
        ].map((t, i) => (
          <Rise key={t} f={f} start={start + 20 + i * 84} i={0} style={{
            fontFamily: R.fontSans, fontSize: 30, lineHeight: 1.62,
            color: th.ink2, marginBottom: 20,
          }}>{t}</Rise>
        ))}
      </div>
    );
  }

  if (k === "tafsir") {
    const sources = ["Ibn Kathīr", "aṭ-Ṭabarī", "as-Saʿdī"];
    const active = f < start + 90 ? 0 : f < start + 170 ? 1 : 2;
    return (
      <div style={{ padding: pad, height: "100%" }}>
        <Label>Tafsīr</Label>
        <div style={{ display: "flex", gap: 12, marginTop: 22, marginBottom: 30 }}>
          {sources.map((s, i) => (
            <div key={s} style={{
              fontFamily: R.fontSans, fontSize: 24, padding: "11px 20px",
              borderRadius: 999, transition: "none",
              background: i === active ? th.ink : "transparent",
              color: i === active ? th.card : th.ink3,
              border: `1px solid ${i === active ? th.ink : th.line}`,
            }}>{s}</div>
          ))}
        </div>
        {/* Rack focus is the pointing device (§5) — the paragraph being read is
            sharp and the rest is held soft, so blur says "look here" rather
            than covering a cut. */}
        {[0, 1, 2].map((i) => (
          <Focus key={i} on={i === active ? rack(f, start + i * 80, 20) : 0.0}
                 style={{ marginBottom: 26 }}>
            <div style={{
              fontFamily: R.fontSerif, fontSize: 28, lineHeight: 1.66, color: th.ink2,
            }}>
              {[
                "He rebukes them for turning away from a Book whose meanings were meant to be looked into.",
                "The locks are on the hearts, not on the words — the words were made plain.",
                "Reflection is the purpose for which it came down, not an optional excellence.",
              ][i]}
            </div>
          </Focus>
        ))}
      </div>
    );
  }

  // map
  const nodes = [
    { x: 0.5,  y: 0.30, r: 62, label: "47:24" },
    { x: 0.22, y: 0.55, r: 40, label: "38:29" },
    { x: 0.78, y: 0.54, r: 40, label: "23:68" },
    { x: 0.36, y: 0.80, r: 34, label: "4:82"  },
    { x: 0.68, y: 0.82, r: 34, label: "17:41" },
  ];
  return (
    <div style={{ padding: 30, height: "100%", position: "relative" }}>
      <Label>Connections</Label>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
      }}>
        {nodes.slice(1).map((n, i) => {
          const t = ease(interpolate(f, [start + 18 + i * 22, start + 60 + i * 22], [0, 1], clamp));
          return (
            <line key={i}
              x1={50} y1={30} x2={50 + (n.x * 100 - 50) * t} y2={30 + (n.y * 100 - 30) * t}
              stroke={th.line} strokeWidth={0.35} />
          );
        })}
      </svg>
      {nodes.map((n, i) => {
        const t = ease(interpolate(f, [start + 10 + i * 22, start + 46 + i * 22], [0, 1], clamp));
        return (
          <div key={n.label} style={{
            position: "absolute", left: `${n.x * 100}%`, top: `${n.y * 100}%`,
            width: n.r * 2, height: n.r * 2, marginLeft: -n.r, marginTop: -n.r,
            borderRadius: "50%",
            border: `1.5px solid ${i === 0 ? R.accent : th.lineStrong}`,
            background: i === 0 ? R.accentSoft : "transparent",
            display: "grid", placeItems: "center",
            fontFamily: R.fontMono, fontSize: i === 0 ? 21 : 17,
            color: i === 0 ? R.accent : th.ink3,
            opacity: t, transform: `scale(${0.7 + t * 0.3})`,
          }}>{n.label}</div>
        );
      })}
    </div>
  );
};

// ── The piece ──────────────────────────────────────────────────────────────

const Body: React.FC = () => {
  const f = useCurrentFrame();
  const m = morphAt(f, S);
  const th = useTheme();

  /* A hold gets DRIFTED, not tilted — at this perspective a 1.3° lean moves
     the near edge about a pixel, which over four seconds is not motion. */
  const dx = Math.sin(f / 96) * 7;
  const dy = Math.cos(f / 118) * 5;

  return (
    <Stage theme={th}>
      <Card m={m} dx={dx} dy={dy}>
        {m.old && (
          <div style={{
            position: "absolute", inset: 0,
            opacity: m.old.opacity,
            transform: `translate(${m.old.x}px, ${m.old.y}px) rotate(${m.old.rot}deg)`,
            filter: m.old.blur > 0.05 ? `blur(${m.old.blur}px)` : undefined,
          }}>
            <Surface k={m.old.key} f={f} start={m.contentStart} />
          </div>
        )}
        <div style={{
          position: "absolute", inset: 0,
          opacity: m.now.opacity,
          transform: `translate(${m.now.x}px, ${m.now.y}px)`,
        }}>
          <Surface k={m.now.key} f={f} start={m.contentStart} />
        </div>
      </Card>

      {/* Stage text — always on the stage, never over the container, so the
          words describing the UI never sit on top of it. */}
      <Say f={f} from={70}   to={230}  top={620} text="One line." />
      <Say f={f} from={300}  to={470}  top={430} size={44} text="Find it by the words you remember." />
      <Say f={f} from={560}  to={700}  top={520} text="Keep it whole." />
      <Say f={f} from={790}  to={930}  top={250} text="Write around it." />
      <Say f={f} from={1010} to={1160} top={200} size={44} text="Read what was said about it." />
      <Say f={f} from={1240} to={1400} top={180} text="See what it holds." />

      <SmearCursor f={f} legs={LEGS} dark={themeT(f) > 0.5} />
    </Stage>
  );
};

/* The close. The outro bloom is a radial about three times the wordmark's own
   width — measured off the references (§8), not guessed. */
const Close: React.FC = () => {
  const f = useCurrentFrame();
  const at = 1500;
  const a = ease(interpolate(f, [at, at + 34], [0, 1], clamp));
  const bloom = interpolate(f, [at, at + 90], [0.3, 1], clamp);
  if (f < at) return null;
  return (
    <AbsoluteFill style={{ display: "grid", placeItems: "center", pointerEvents: "none" }}>
      <div style={{
        position: "absolute", width: 1180, height: 1180, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(68,128,97,${0.13 * a}) 0%, rgba(68,128,97,0) 62%)`,
        transform: `scale(${bloom})`,
      }} />
      <div style={{
        position: "absolute", bottom: 300, left: 0, right: 0, textAlign: "center",
        opacity: a, transform: `translateY(${(1 - a) * 14}px)`,
      }}>
        <div style={{
          fontFamily: R.fontSerif, fontSize: 46, color: R.ink,
          letterSpacing: "-0.01em",
        }}>Everything returns to the āyah.</div>
        <div style={{
          fontFamily: R.fontSans, fontSize: 25, color: R.accent, marginTop: 22,
          letterSpacing: "0.18em", textTransform: "uppercase",
        }}>TafsirLab</div>
      </div>
    </AbsoluteFill>
  );
};

export const ReturnToTheAyah: React.FC = () => {
  const f = useCurrentFrame();
  const theme = themeAt(f, THEME_KEYS);
  return (
    <ThemeProvide value={theme}>
      <AbsoluteFill style={{ background: theme.stage }}>
        <Body />
        <Close />

        {/* Sound sits on actions only. Levels are set so the transients (click,
            land) peak above the sustained textures rather than being mixed by
            eye — a sustained bed matched by peak reads far louder than a click
            matched the same way. */}
        {[250, 500, 730, 960, 1190, 1430].map((at, i) => (
          <Sequence key={at} from={at - 6} durationInFrames={40}>
            <Audio src={staticFile("sfx/whoosh.mp3")} volume={i % 2 === 0 ? 0.20 : 0.16} />
          </Sequence>
        ))}
        {LEGS.filter((l) => l.click).map((l) => (
          <Sequence key={l.at} from={l.at} durationInFrames={26}>
            <Audio src={staticFile("sfx/click.mp3")} volume={0.34} />
          </Sequence>
        ))}
        <Sequence from={262} durationInFrames={120}>
          <Audio src={staticFile("sfx/typing.mp3")} volume={0.20} />
        </Sequence>
        <Sequence from={1190} durationInFrames={90}>
          <Audio src={staticFile("sfx/magnetic.mp3")} volume={0.22} />
        </Sequence>
        <Sequence from={1430} durationInFrames={80}>
          <Audio src={staticFile("sfx/land.mp3")} volume={0.30} />
        </Sequence>
      </AbsoluteFill>
    </ThemeProvide>
  );
};
