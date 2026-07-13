/**
 * TafsirLab — feature trailer.
 *
 * Eight scenes, 72 s @ 30 fps, 1920×1080. Every visual is rebuilt from the
 * app's real design system (see theme.ts) rather than screen capture, so the
 * trailer stays crisp at any resolution.
 *
 *   1. Title          — bismillah, wordmark, tagline
 *   2. The Editor     — typing, slash menu, ayah block
 *   3. Scholars       — /saadi 2:255 → instant commentary
 *   4. The Library    — 67 tafāsīr, EN/AR filter
 *   5. The Mushaf     — ink, highlighter, ayah layers, eraser
 *   6. Collaboration  — live cursors, movable containers
 *   7. Workspaces     — personal / halaqa / classroom
 *   8. CTA            — free forever
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, FONTS } from "./theme";

export const TRAILER_FPS = 30;

// Scene lengths (frames)
const LEN = {
  title:      150,
  editor:     330,
  scholars:   300,
  library:    240,
  mushaf:     420,
  collab:     300,
  workspaces: 210,
  cta:        210,
};
export const TRAILER_DURATION =
  LEN.title + LEN.editor + LEN.scholars + LEN.library +
  LEN.mushaf + LEN.collab + LEN.workspaces + LEN.cta;

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ── Small helpers ──────────────────────────────────────────────────────────

/** Characters typed so far (typewriter). */
const typed = (text: string, frame: number, start: number, cpf = 0.9) =>
  text.slice(0, Math.max(0, Math.floor((frame - start) * cpf)));

const done = (text: string, frame: number, start: number, cpf = 0.9) =>
  frame - start >= text.length / cpf;

/** Blinking caret. */
const Caret: React.FC<{ color?: string; h?: number }> = ({ color = C.accent, h = 30 }) => {
  const frame = useCurrentFrame();
  return (
    <span
      style={{
        display: "inline-block",
        width: 2.5,
        height: h,
        marginLeft: 2,
        verticalAlign: "text-bottom",
        background: color,
        opacity: Math.floor(frame / 16) % 2 === 0 ? 1 : 0,
      }}
    />
  );
};

/** Scene shell: fade in/out + background. */
const Scene: React.FC<{
  dur: number;
  bg?: string;
  children: React.ReactNode;
}> = ({ dur, bg = C.bg, children }) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    interpolate(frame, [0, 14], [0, 1], CLAMP),
    interpolate(frame, [dur - 14, dur], [1, 0], CLAMP),
  );
  return (
    <AbsoluteFill style={{ background: bg, opacity, fontFamily: FONTS.sans, color: C.ink }}>
      {/* paper grain glow */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(1100px 700px at 82% -8%, rgba(201,138,45,0.06), transparent 60%)," +
            "radial-gradient(900px 620px at -6% 24%, rgba(62,142,110,0.055), transparent 60%)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

/** Mono uppercase eyebrow. */
const Eyebrow: React.FC<{ children: React.ReactNode; light?: boolean }> = ({ children, light }) => (
  <div
    style={{
      fontFamily: FONTS.mono,
      fontSize: 22,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: light ? "rgba(250,248,242,0.65)" : C.ink3,
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}
  >
    <span
      style={{
        width: 10, height: 10, borderRadius: 99,
        background: C.accent, boxShadow: `0 0 0 7px ${C.accentSoft}`,
      }}
    />
    {children}
  </div>
);

/** Window chrome. */
const Chrome: React.FC<{ tab: string; children: React.ReactNode; w: number }> = ({ tab, children, w }) => (
  <div
    style={{
      width: w,
      background: C.bgElev,
      borderRadius: 18,
      border: `1px solid ${C.line2}`,
      boxShadow: "0 40px 90px rgba(34,31,26,0.16), 0 12px 30px rgba(34,31,26,0.10)",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 20px",
        borderBottom: `1px solid ${C.line}`,
        background: C.panel,
      }}
    >
      {["#E1655B", "#E5B95B", "#79BA7E"].map((c) => (
        <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c }} />
      ))}
      <span style={{ fontFamily: FONTS.mono, fontSize: 17, color: C.ink3, marginLeft: 12 }}>{tab}</span>
    </div>
    {children}
  </div>
);

const Pip: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <span
    style={{
      width: size, height: size, borderRadius: 99, background: color,
      border: "2.5px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
      display: "inline-block",
    }}
  />
);

/** Named live cursor. */
const LiveCursor: React.FC<{ x: number; y: number; name: string; color: string; opacity?: number }> = ({
  x, y, name, color, opacity = 1,
}) => (
  <div style={{ position: "absolute", left: x, top: y, opacity, zIndex: 40 }}>
    <svg width="26" height="30" viewBox="0 0 26 30">
      <path d="M2 2 L2 24 L8.5 18.5 L13 28 L17 26 L12.5 17 L21 16.5 Z" fill={color} stroke="#fff" strokeWidth="1.6" />
    </svg>
    <div
      style={{
        marginTop: 2, marginLeft: 14,
        background: color, color: "#fff",
        fontSize: 17, fontWeight: 600, fontFamily: FONTS.sans,
        padding: "4px 12px", borderRadius: 8,
        whiteSpace: "nowrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      }}
    >
      {name}
    </div>
  </div>
);

// ═══════════════════ 1 · TITLE ═══════════════════

const STitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 26, fps, config: { damping: 14, mass: 0.7 } });
  const bism = interpolate(frame, [4, 34], [0, 1], CLAMP);
  const tag  = interpolate(frame, [58, 82], [0, 1], CLAMP);
  const sub  = interpolate(frame, [82, 106], [0, 1], CLAMP);

  return (
    <Scene dur={LEN.title}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: FONTS.arabic, fontSize: 54, color: C.ink2,
            opacity: bism, direction: "rtl", marginBottom: 46,
          }}
        >
          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
        </div>

        <div
          style={{
            display: "flex", alignItems: "center", gap: 30,
            transform: `scale(${0.9 + pop * 0.1})`, opacity: pop,
          }}
        >
          <div
            style={{
              width: 110, height: 110, borderRadius: 26,
              background: C.ink, color: C.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: FONTS.serif, fontSize: 64, fontWeight: 700,
              boxShadow: "0 24px 60px rgba(34,31,26,0.25)",
            }}
          >
            T
          </div>
          <div style={{ fontFamily: FONTS.serif, fontSize: 120, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Tafsir<span style={{ fontStyle: "italic", fontWeight: 400, color: C.ink2 }}>Lab</span>
          </div>
        </div>

        <div
          style={{
            fontFamily: FONTS.serif, fontSize: 44, color: C.ink2,
            marginTop: 44, opacity: tag,
          }}
        >
          A study desk for the Qurʾān.
        </div>
        <div
          style={{
            fontFamily: FONTS.mono, fontSize: 22, letterSpacing: "0.1em",
            textTransform: "uppercase", color: C.ink3, marginTop: 26, opacity: sub,
          }}
        >
          live collaboration · real ink · 67 classical tafāsīr
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ═══════════════════ 2 · THE EDITOR ═══════════════════

const SLASH_ITEMS = [
  { i: "📖", t: "Ayah block",    d: "Embed a Qurʾānic verse" },
  { i: "📚", t: "Tafsir block",  d: "67 English & Arabic sources" },
  { i: "H₁", t: "Heading 1",     d: "Large section heading" },
  { i: "•",  t: "Bullet list",   d: "Unordered list" },
  { i: "☑",  t: "Task list",     d: "Checklist with tickable items" },
];

const SEditor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const para = "Praise in this verse is definite and total — not merely thanks for what is given, but praise for what He is.";
  const TYPE_START = 40;
  const paraDone = done(para, frame, TYPE_START);

  const slashAt   = 168;
  const slashOn   = frame >= slashAt && frame < 236;
  const slashPop  = spring({ frame: frame - slashAt, fps, config: { damping: 15 } });
  const blockAt   = 240;
  const blockPop  = spring({ frame: frame - blockAt, fps, config: { damping: 13, mass: 0.8 } });

  return (
    <Scene dur={LEN.editor}>
      <div style={{ position: "absolute", left: 110, top: 92 }}>
        <Eyebrow>01 · The Editor</Eyebrow>
        <div style={{ fontFamily: FONTS.serif, fontSize: 62, fontWeight: 500, marginTop: 20, letterSpacing: "-0.015em" }}>
          Write tafsir like it&apos;s paper.
        </div>
      </div>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
        <Chrome tab="Al-Fātiḥa · Tafsir 101" w={1360}>
          <div style={{ padding: "44px 64px 56px", minHeight: 600 }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: 17, letterSpacing: "0.08em", color: C.ink3 }}>
              SURAH AL-FĀTIḤA · 1:2
            </div>
            <div style={{ fontFamily: FONTS.serif, fontSize: 44, fontWeight: 600, margin: "14px 0 30px" }}>
              On praise as the opening posture
            </div>

            <div style={{ fontFamily: FONTS.serif, fontSize: 27, lineHeight: 1.7, color: C.ink, maxWidth: 1100 }}>
              {typed(para, frame, TYPE_START)}
              {!paraDone && <Caret />}
              {paraDone && frame < blockAt && (
                <>
                  {" "}
                  <span style={{ color: C.accentInk, fontFamily: FONTS.mono, fontSize: 24 }}>
                    {typed("/ayah 1:2", frame, slashAt - 14, 0.55)}
                  </span>
                  <Caret />
                </>
              )}
            </div>

            {/* Slash palette */}
            {slashOn && (
              <div
                style={{
                  position: "absolute", left: 420, top: 330,
                  width: 440, background: C.bgElev,
                  border: `1px solid ${C.line2}`, borderRadius: 14,
                  boxShadow: "0 22px 50px rgba(34,31,26,0.18)",
                  padding: 10, zIndex: 20,
                  opacity: slashPop,
                  transform: `translateY(${(1 - slashPop) * 14}px)`,
                }}
              >
                {SLASH_ITEMS.map((s, i) => (
                  <div
                    key={s.t}
                    style={{
                      display: "flex", alignItems: "center", gap: 16,
                      padding: "11px 14px", borderRadius: 9,
                      background: i === 0 ? C.accentSoft : "transparent",
                    }}
                  >
                    <span style={{ fontSize: 24, width: 36, textAlign: "center" }}>{s.i}</span>
                    <span>
                      <div style={{ fontSize: 21, fontWeight: 600 }}>{s.t}</div>
                      <div style={{ fontSize: 17, color: C.ink3 }}>{s.d}</div>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Ayah block */}
            {frame >= blockAt && (
              <div
                style={{
                  marginTop: 34,
                  border: `1px solid ${C.line2}`,
                  borderInlineStart: `4px solid ${C.accent}`,
                  borderRadius: 12,
                  background: C.panel,
                  padding: "30px 40px",
                  opacity: blockPop,
                  transform: `translateY(${(1 - blockPop) * 26}px) scale(${0.97 + blockPop * 0.03})`,
                }}
              >
                <div style={{ fontFamily: FONTS.mono, fontSize: 16, color: C.accentInk, letterSpacing: "0.08em" }}>
                  ● AL-FĀTIḤA · 1:2
                </div>
                <div
                  style={{
                    fontFamily: FONTS.arabic, fontSize: 52, direction: "rtl",
                    textAlign: "right", margin: "18px 0 12px", lineHeight: 1.9,
                  }}
                >
                  ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ
                </div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 24, color: C.ink2 }}>
                  <sup style={{ fontFamily: FONTS.mono, fontSize: 15, color: C.ink4 }}>2 </sup>
                  All praise is due to Allah, Lord of all the worlds.
                </div>
              </div>
            )}
          </div>
        </Chrome>
      </AbsoluteFill>
    </Scene>
  );
};

// ═══════════════════ 3 · SCHOLAR SHORTCUTS ═══════════════════

const SCHOLAR_CHIPS = [
  "/kathir", "/tabari", "/qurtubi", "/razi", "/jalalayn",
  "/baghawi", "/muyassar", "/shawkani", "/uthaymeen", "/kashshaf",
];

const SScholars: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cmd = "/saadi 2:255";
  const TYPE_START = 34;
  const cmdDone = done(cmd, frame, TYPE_START, 0.45);
  const blockAt = 110;
  const blockPop = spring({ frame: frame - blockAt, fps, config: { damping: 13 } });
  const textIn = interpolate(frame, [blockAt + 16, blockAt + 44], [0, 1], CLAMP);

  return (
    <Scene dur={LEN.scholars}>
      <div style={{ position: "absolute", left: 110, top: 92 }}>
        <Eyebrow>02 · Scholar shortcuts</Eyebrow>
        <div style={{ fontFamily: FONTS.serif, fontSize: 62, fontWeight: 500, marginTop: 20 }}>
          Call any scholar by name.
        </div>
      </div>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 100 }}>
        <Chrome tab="Al-Baqara · Āyat al-Kursī" w={1240}>
          <div style={{ padding: "44px 60px 52px", minHeight: 560 }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: 26, color: C.accentInk }}>
              {typed(cmd, frame, TYPE_START, 0.45)}
              {!cmdDone && <Caret h={26} />}
            </div>

            {frame >= blockAt && (
              <div
                style={{
                  marginTop: 30,
                  border: `1px solid ${C.line2}`,
                  borderRadius: 14,
                  background: C.bgElev,
                  padding: "28px 38px",
                  opacity: blockPop,
                  transform: `translateY(${(1 - blockPop) * 24}px)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }}>
                  <div
                    style={{
                      width: 58, height: 58, borderRadius: 14,
                      background: "rgba(201,138,45,0.16)", color: "#8F6220",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: FONTS.arabic, fontSize: 30, fontWeight: 700,
                    }}
                  >
                    س
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 26, fontWeight: 600 }}>Tafsīr al-Saʿdī</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 16, color: C.ink3, marginTop: 3 }}>
                      2:255 · d. 1376 AH
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: FONTS.mono, fontSize: 16, fontWeight: 600,
                      background: "rgba(201,138,45,0.15)", color: "#8F6220",
                      padding: "5px 14px", borderRadius: 8,
                    }}
                  >
                    AR
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: FONTS.arabic, fontSize: 32, direction: "rtl",
                    textAlign: "right", lineHeight: 2.05, color: C.ink2,
                    opacity: textIn,
                  }}
                >
                  ﴿اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ﴾ أخبر تعالى عن نفسه الكريمة
                  أنه لا إله إلا هو، أي: لا معبود بحق سواه…
                </div>
              </div>
            )}

            {/* Floating scholar chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 34 }}>
              {SCHOLAR_CHIPS.map((c, i) => {
                const p = spring({ frame: frame - (168 + i * 6), fps, config: { damping: 14 } });
                return (
                  <span
                    key={c}
                    style={{
                      fontFamily: FONTS.mono, fontSize: 20,
                      border: `1px solid ${C.line2}`, borderRadius: 99,
                      padding: "8px 20px", color: C.accentInk, background: C.bgElev,
                      opacity: p, transform: `translateY(${(1 - p) * 16}px)`,
                    }}
                  >
                    {c}
                  </span>
                );
              })}
            </div>
          </div>
        </Chrome>
      </AbsoluteFill>
    </Scene>
  );
};

// ═══════════════════ 4 · THE LIBRARY ═══════════════════

const LIB_CHIPS = [
  ["AR", "al-Ṭabarī"], ["AR", "al-Qurṭubī"], ["EN", "Ibn Kathīr"], ["AR", "Ibn Kathīr"],
  ["AR", "al-Rāzī"], ["AR", "al-Saʿdī"], ["AR", "al-Baghawī"], ["EN", "Al-Jalālayn"],
  ["AR", "Ibn ʿĀshūr"], ["AR", "al-Shawkānī"], ["AR", "al-Zamakhsharī"], ["AR", "al-Bayḍāwī"],
  ["AR", "al-Ālūsī"], ["AR", "Ibn al-Qayyim"], ["AR", "Ibn ʿUthaymīn"], ["EN", "Al-Mukhtaṣar"],
  ["EN", "Maʿārif al-Qurʾān"], ["EN", "Asbāb al-Nuzūl"], ["AR", "al-Māwardī"], ["AR", "Ibn al-Jawzī"],
] as const;

const SLibrary: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const count = Math.round(interpolate(frame, [16, 66], [0, 67], { ...CLAMP, easing: (t) => 1 - Math.pow(1 - t, 3) }));
  const filterAt = 150; // "AR" chip activates → EN chips dim

  return (
    <Scene dur={LEN.library}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Eyebrow>03 · The Library</Eyebrow>
        <div style={{ display: "flex", alignItems: "baseline", gap: 26, marginTop: 26 }}>
          <span style={{ fontFamily: FONTS.serif, fontSize: 190, fontWeight: 600, fontStyle: "italic", color: C.accentInk, lineHeight: 1 }}>
            {count}
          </span>
          <span style={{ fontFamily: FONTS.serif, fontSize: 66, fontWeight: 500 }}>
            tafāsīr on the shelf
          </span>
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 24, letterSpacing: "0.1em", textTransform: "uppercase", color: C.ink3, margin: "18px 0 40px" }}>
          12 English · 55 Arabic — indexed to the āyah
        </div>

        {/* Language filter */}
        <div style={{ display: "flex", gap: 12, marginBottom: 40 }}>
          {(["All", "EN · 12", "AR · 55"] as const).map((l, i) => {
            const active = frame < filterAt ? i === 0 : i === 2;
            return (
              <span
                key={l}
                style={{
                  fontFamily: FONTS.mono, fontSize: 21,
                  padding: "9px 26px", borderRadius: 99,
                  border: `1.5px solid ${active ? C.ink : C.line2}`,
                  background: active ? C.ink : "transparent",
                  color: active ? C.bg : C.ink3,
                }}
              >
                {l}
              </span>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", maxWidth: 1420 }}>
          {LIB_CHIPS.map(([lang, name], i) => {
            const p = spring({ frame: frame - (46 + i * 3), fps, config: { damping: 15 } });
            const dimmed = frame >= filterAt + 8 && lang === "EN";
            return (
              <span
                key={name + i}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 12,
                  fontSize: 23, color: C.ink2,
                  padding: "11px 24px",
                  border: `1px solid ${C.line}`, borderRadius: 99, background: C.bgElev,
                  opacity: p * (dimmed ? 0.22 : 1),
                  transform: `translateY(${(1 - p) * 18}px)`,
                  transition: "opacity 0.2s",
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.mono, fontSize: 14, fontWeight: 600, letterSpacing: "0.06em",
                    padding: "3px 9px", borderRadius: 6,
                    background: lang === "EN" ? C.accentSoft : "rgba(201,138,45,0.15)",
                    color: lang === "EN" ? C.accentInk : "#8F6220",
                  }}
                >
                  {lang}
                </span>
                {name}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ═══════════════════ 5 · THE MUSHAF (ink) ═══════════════════

const MUSHAF_LINES = [
  "قَالُوا۟ سُبْحَـٰنَكَ لَا عِلْمَ لَنَآ إِلَّا مَا عَلَّمْتَنَآ ۖ إِنَّكَ أَنتَ ٱلْعَلِيمُ ٱلْحَكِيمُ ۝",
  "قَالَ يَـٰٓـَٔادَمُ أَنۢبِئْهُم بِأَسْمَآئِهِمْ ۖ فَلَمَّآ أَنۢبَأَهُم بِأَسْمَآئِهِمْ ۝",
  "وَإِذْ قُلْنَا لِلْمَلَـٰٓئِكَةِ ٱسْجُدُوا۟ لِـَٔادَمَ فَسَجَدُوٓا۟ إِلَّآ إِبْلِيسَ ۝",
  "وَقُلْنَا يَـٰٓـَٔادَمُ ٱسْكُنْ أَنتَ وَزَوْجُكَ ٱلْجَنَّةَ وَكُلَا مِنْهَا رَغَدًا ۝",
  "فَأَزَلَّهُمَا ٱلشَّيْطَـٰنُ عَنْهَا فَأَخْرَجَهُمَا مِمَّا كَانَا فِيهِ ۝",
];

// phases (local frames)
const P_PEN = 40, P_HL = 130, P_WASH = 210, P_ERASE = 300;

const SMushaf: React.FC = () => {
  const frame = useCurrentFrame();

  const penDraw   = interpolate(frame, [P_PEN, P_PEN + 40], [100, 0], CLAMP);
  const hlSweep   = interpolate(frame, [P_HL, P_HL + 34], [0, 100], CLAMP);
  const wash      = interpolate(frame, [P_WASH, P_WASH + 26], [0, 1], CLAMP);
  const squiggle  = interpolate(frame, [P_PEN + 46, P_PEN + 76], [100, 0], CLAMP);
  const eraseX    = interpolate(frame, [P_ERASE, P_ERASE + 70], [0, 560], CLAMP);
  const eraseOn   = frame >= P_ERASE - 14 && frame <= P_ERASE + 84;

  const caption =
    frame < P_HL    ? "Pressure-sensitive ink — bound to the verse, not the page" :
    frame < P_WASH  ? "Highlight, circle, scribble — like real paper" :
    frame < P_ERASE ? "Note inside an ayah → the whole ayah lights up" :
                      "And an eraser that behaves like one";

  const tools: { icon: string; active: boolean }[] = [
    { icon: "✋", active: false },
    { icon: "✒️", active: frame < P_HL },
    { icon: "🖍", active: frame >= P_HL && frame < P_WASH },
    { icon: "▢", active: frame >= P_WASH && frame < P_ERASE },
    { icon: "◯", active: frame >= P_ERASE },
  ];

  return (
    <Scene dur={LEN.mushaf} bg={C.dark}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(800px 520px at 30% 34%, rgba(62,142,110,0.14), transparent 65%)," +
            "radial-gradient(640px 460px at 86% 82%, rgba(201,138,45,0.10), transparent 60%)",
        }}
      />
      <div style={{ position: "absolute", left: 120, top: 92 }}>
        <Eyebrow light>04 · The Mushaf</Eyebrow>
        <div style={{ fontFamily: FONTS.serif, fontSize: 62, fontWeight: 500, marginTop: 20, color: "#F6F4EE" }}>
          Ink that doesn&apos;t belong to the device.
        </div>
      </div>

      {/* Tool rail */}
      <div
        style={{
          position: "absolute", left: 150, top: 400,
          display: "flex", flexDirection: "column", gap: 12,
          background: "#242833", borderRadius: 18, padding: 14,
          border: "1px solid rgba(250,248,242,0.12)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.4)",
        }}
      >
        {tools.map((t, i) => (
          <div
            key={i}
            style={{
              width: 62, height: 62, borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28,
              background: t.active ? "rgba(62,142,110,0.32)" : "transparent",
              border: t.active ? `1.5px solid ${C.accent}` : "1.5px solid transparent",
            }}
          >
            {t.icon}
          </div>
        ))}
      </div>

      {/* Mushaf page */}
      <div
        style={{
          position: "absolute", left: 330, top: 250,
          width: 900, background: C.paper,
          borderRadius: 10, padding: "44px 56px 40px",
          boxShadow: "0 50px 110px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            textAlign: "center", fontFamily: FONTS.arabic, fontSize: 30,
            border: "1px double rgba(150,110,45,0.55)", borderRadius: 6,
            padding: "10px 0 14px", marginBottom: 30, color: "#6E5320",
          }}
        >
          سُورَةُ ٱلْبَقَرَةِ
        </div>

        {MUSHAF_LINES.map((line, i) => {
          const isPenLine  = i === 2;
          const isWashLine = i === 0;
          const isHlLine   = i === 3;
          return (
            <div
              key={i}
              style={{
                position: "relative",
                fontFamily: FONTS.arabic, fontSize: 33, lineHeight: 2.15,
                direction: "rtl", textAlign: "center",
                color: isPenLine ? C.accentInk : "#26221C",
                background: isWashLine ? `rgba(112,146,224,${0.42 * wash})` : "transparent",
                borderRadius: 6,
              }}
            >
              {isHlLine ? (
                <span
                  style={{
                    backgroundImage: "linear-gradient(100deg, rgba(244,208,80,0.55), rgba(244,208,80,0.42))",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: `${hlSweep}% 78%`,
                    backgroundPosition: "right center",
                    borderRadius: 8,
                  }}
                >
                  {line}
                </span>
              ) : (
                line
              )}
              {isPenLine && (
                <svg
                  style={{ position: "absolute", bottom: 2, left: "4%", width: "92%", height: 16, pointerEvents: "none" }}
                  viewBox="0 0 200 14" preserveAspectRatio="none"
                >
                  <path
                    d="M3 8 C 30 3.5, 62 11, 96 7 C 128 3, 162 10, 197 6"
                    fill="none" stroke={C.accent} strokeWidth={2.4} strokeLinecap="round"
                    pathLength={100} strokeDasharray={100} strokeDashoffset={penDraw}
                  />
                </svg>
              )}
            </div>
          );
        })}

        {/* margin scribble that gets erased */}
        <div style={{ position: "relative", height: 70, marginTop: 8 }}>
          <svg style={{ position: "absolute", left: 120, top: 4, width: 560, height: 48 }} viewBox="0 0 560 48">
            <path
              d="M6 30 C 60 6, 110 44, 168 22 C 226 2, 280 46, 340 24 C 398 4, 452 42, 552 18"
              fill="none" stroke={C.violet} strokeWidth={3.4} strokeLinecap="round"
              pathLength={100} strokeDasharray={100} strokeDashoffset={squiggle}
            />
            {/* eraser wipe — paper-coloured rect follows the ring */}
            <rect x={0} y={0} width={eraseX} height={48} fill={C.paper} />
          </svg>
          {eraseOn && (
            <div
              style={{
                position: "absolute", left: 100 + eraseX, top: 14,
                width: 56, height: 56, borderRadius: 99,
                border: "2.5px solid rgba(60,55,48,0.65)",
                background: "rgba(255,255,255,0.6)",
                boxShadow: "0 3px 12px rgba(0,0,0,0.25), inset 0 0 0 3px rgba(255,255,255,0.7)",
                transform: "translate(-50%, -50%)",
              }}
            />
          )}
          <span
            style={{
              position: "absolute", right: 30, top: 18,
              fontFamily: FONTS.hand, fontSize: 27, fontWeight: 600, color: C.accentInk,
              transform: "rotate(-2deg)",
              opacity: interpolate(frame, [P_HL + 20, P_HL + 44], [0, 1], CLAMP),
            }}
          >
            cf. al-Ṭabarī here
          </span>
        </div>
      </div>

      {/* caption */}
      <div
        style={{
          position: "absolute", right: 130, bottom: 120, width: 480,
          fontFamily: FONTS.serif, fontSize: 36, lineHeight: 1.45,
          color: "rgba(246,244,238,0.92)",
        }}
      >
        {caption}
      </div>

      {/* presence */}
      <div
        style={{
          position: "absolute", left: 330, bottom: 96,
          fontFamily: FONTS.mono, fontSize: 20, color: "rgba(246,244,238,0.72)",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <Pip color={C.warm} size={16} /> Ismail is annotating page ٣
      </div>
    </Scene>
  );
};

// ═══════════════════ 6 · COLLABORATION ═══════════════════

const SCollab: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // container drag path
  const drag = spring({ frame: frame - 70, fps, config: { damping: 16, mass: 1.1 } });
  const boxX = 180 + drag * 420;
  const boxY = 330 - drag * 60;

  // cursors wander
  const c1x = 900 + Math.sin(frame / 26) * 130 + interpolate(frame, [0, 300], [0, 120], CLAMP);
  const c1y = 430 + Math.cos(frame / 32) * 60;
  const c2x = 640 + Math.cos(frame / 30) * 90;
  const c2y = 640 + Math.sin(frame / 24) * 44;

  const liveText = "The lām here is the lām of istiḥqāq — entitlement…";

  return (
    <Scene dur={LEN.collab}>
      <div style={{ position: "absolute", left: 110, top: 92 }}>
        <Eyebrow>05 · Together</Eyebrow>
        <div style={{ fontFamily: FONTS.serif, fontSize: 62, fontWeight: 500, marginTop: 20 }}>
          Live, multiplayer, everywhere.
        </div>
      </div>

      {/* presence bar */}
      <div style={{ position: "absolute", right: 150, top: 110, display: "flex", alignItems: "center", gap: 8 }}>
        <Pip color={C.warm} size={30} />
        <Pip color={C.accent} size={30} />
        <Pip color={C.violet} size={30} />
        <span style={{ fontFamily: FONTS.mono, fontSize: 20, color: C.ink3, marginLeft: 8 }}>+2 online</span>
      </div>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 110 }}>
        <Chrome tab="Tuesday Halaqa · Al-Baqara" w={1400}>
          <div style={{ position: "relative", minHeight: 620, padding: 40 }}>
            {/* main doc */}
            <div style={{ maxWidth: 760, marginLeft: 60 }}>
              <div style={{ fontFamily: FONTS.serif, fontSize: 38, fontWeight: 600, marginBottom: 18 }}>
                The throne that holds the worlds
              </div>
              <div style={{ fontFamily: FONTS.serif, fontSize: 25, lineHeight: 1.75, color: C.ink2 }}>
                {typed(liveText, frame, 40, 0.5)}
                <Caret color={C.accent} h={24} />
              </div>
            </div>

            {/* draggable container */}
            <div
              style={{
                position: "absolute", left: boxX, top: boxY,
                width: 400,
                background: "rgba(254,254,252,0.9)",
                border: `1px solid ${C.line2}`,
                boxShadow: drag > 0.05 && drag < 0.95 ? "0 24px 50px rgba(34,31,26,0.2)" : "0 6px 18px rgba(34,31,26,0.08)",
              }}
            >
              <div
                style={{
                  height: 26, background: C.panel, borderBottom: `1px solid ${C.line}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: FONTS.mono, fontSize: 13, color: C.ink4, letterSpacing: "0.3em",
                }}
              >
                ⋯⋯
              </div>
              <div style={{ padding: "16px 22px 20px", fontFamily: FONTS.serif, fontSize: 22, lineHeight: 1.6 }}>
                <b>Kursī vs ʿArsh</b> — Ibn ʿAbbās: the kursī is the place of the two feet…
              </div>
            </div>

            <LiveCursor x={c1x} y={c1y} name="Yusuf" color={C.warm} />
            <LiveCursor x={c2x} y={c2y} name="Yahya" color={C.accent} />
          </div>
        </Chrome>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute", bottom: 84, left: 0, right: 0, textAlign: "center",
          fontFamily: FONTS.mono, fontSize: 21, letterSpacing: "0.08em", color: C.ink3,
        }}
      >
        live cursors · movable containers · every edit syncs in real time
      </div>
    </Scene>
  );
};

// ═══════════════════ 7 · WORKSPACES ═══════════════════

const WS_CARDS = [
  { init: "Y",  name: "Yahya · Personal",    sub: "Private · 1 member",  line: "23 surahs · 412 notes",        grad: ["#3E8E6E", "#2E6B53"] },
  { init: "TH", name: "Tuesday Halaqa",      sub: "Shared · 14 members", line: "Studying — Al-Mulk · 3 online", grad: ["#C98A2D", "#9C6A20"] },
  { init: "QS", name: "Qalam Seminary 2026", sub: "Class · 87 members",  line: "Module 4 — Sūrat Yūsuf",        grad: ["#6D5FB8", "#54488F"] },
];

const SWorkspaces: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <Scene dur={LEN.workspaces}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Eyebrow>06 · Workspaces</Eyebrow>
        <div style={{ fontFamily: FONTS.serif, fontSize: 64, fontWeight: 500, margin: "22px 0 50px" }}>
          Private notebooks. Shared halaqas. Classrooms.
        </div>

        <div style={{ display: "flex", gap: 26 }}>
          {WS_CARDS.map((w, i) => {
            const p = spring({ frame: frame - (26 + i * 12), fps, config: { damping: 14 } });
            return (
              <div
                key={w.name}
                style={{
                  width: 420, background: C.bgElev,
                  border: `1px solid ${C.line}`, borderRadius: 20,
                  padding: "30px 30px 26px",
                  boxShadow: "0 18px 46px rgba(34,31,26,0.09)",
                  opacity: p, transform: `translateY(${(1 - p) * 40}px)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
                  <div
                    style={{
                      width: 62, height: 62, borderRadius: 15,
                      background: `linear-gradient(135deg, ${w.grad[0]}, ${w.grad[1]})`,
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: FONTS.serif, fontSize: 24, fontWeight: 600,
                    }}
                  >
                    {w.init}
                  </div>
                  <div>
                    <div style={{ fontSize: 25, fontWeight: 600 }}>{w.name}</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 16, color: C.ink3, marginTop: 4 }}>{w.sub}</div>
                  </div>
                </div>
                <div style={{ fontSize: 22, color: C.ink2 }}>{w.line}</div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 52, fontFamily: FONTS.mono, fontSize: 21,
            letterSpacing: "0.08em", color: C.ink3,
            opacity: interpolate(frame, [92, 116], [0, 1], CLAMP),
          }}
        >
          admins manage the structure · members write · you choose the rules
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ═══════════════════ 8 · CTA ═══════════════════

const SCta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 20, fps, config: { damping: 14 } });
  const btn = spring({ frame: frame - 66, fps, config: { damping: 13 } });

  return (
    <Scene dur={LEN.cta}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: FONTS.arabic, fontSize: 40, color: C.ink3,
            marginBottom: 40, direction: "rtl",
            opacity: interpolate(frame, [2, 26], [0, 1], CLAMP),
          }}
        >
          ٱقْرَأْ وَرَبُّكَ ٱلْأَكْرَمُ
        </div>
        <div
          style={{
            fontFamily: FONTS.serif, fontSize: 108, fontWeight: 500, textAlign: "center",
            lineHeight: 1.06, letterSpacing: "-0.02em",
            opacity: pop, transform: `scale(${0.94 + pop * 0.06})`,
          }}
        >
          Open the lab.
          <br />
          <span style={{ fontStyle: "italic", fontWeight: 400, color: C.accentInk }}>Begin the work.</span>
        </div>

        <div
          style={{
            marginTop: 60,
            background: C.ink, color: C.bg,
            fontFamily: FONTS.sans, fontSize: 30, fontWeight: 600,
            padding: "22px 52px", borderRadius: 18,
            boxShadow: "0 26px 60px rgba(34,31,26,0.28)",
            opacity: btn, transform: `translateY(${(1 - btn) * 24}px)`,
          }}
        >
          Start a workspace — free forever →
        </div>

        <div
          style={{
            marginTop: 44, fontFamily: FONTS.mono, fontSize: 21,
            letterSpacing: "0.1em", color: C.ink3, textTransform: "uppercase",
            opacity: interpolate(frame, [96, 120], [0, 1], CLAMP),
          }}
        >
          tafsirlab · no card · no paid tier
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ═══════════════════ COMPOSITION ═══════════════════

export const Trailer: React.FC = () => {
  let at = 0;
  const seq = (len: number) => {
    const from = at;
    at += len;
    return { from, durationInFrames: len };
  };

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence {...seq(LEN.title)}><STitle /></Sequence>
      <Sequence {...seq(LEN.editor)}><SEditor /></Sequence>
      <Sequence {...seq(LEN.scholars)}><SScholars /></Sequence>
      <Sequence {...seq(LEN.library)}><SLibrary /></Sequence>
      <Sequence {...seq(LEN.mushaf)}><SMushaf /></Sequence>
      <Sequence {...seq(LEN.collab)}><SCollab /></Sequence>
      <Sequence {...seq(LEN.workspaces)}><SWorkspaces /></Sequence>
      <Sequence {...seq(LEN.cta)}><SCta /></Sequence>
    </AbsoluteFill>
  );
};
