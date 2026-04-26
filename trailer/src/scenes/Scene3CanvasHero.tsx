import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { T } from "../tokens";
import { Rail, Sidebar, Topbar } from "../components/UIShell";
import { SceneCaption } from "../components/SceneCaption";

const NoteCard: React.FC<{
  type: "linguistic" | "thematic" | "callout";
  title: string;
  body: string;
  opacity: number;
  x: number;
  y: number;
  entryY: number;
}> = ({ type, title, body, opacity, x, y, entryY }) => {
  const colors: Record<string, { bg: string; border: string; dot: string; label: string }> = {
    linguistic: { bg: "#FFF8ED", border: "rgba(245,158,11,0.25)", dot: "#F59E0B", label: "#92400E" },
    thematic:   { bg: "#EDFAF4", border: "rgba(45,158,116,0.22)", dot: T.accent,  label: T.accentInk },
    callout:    { bg: T.panel,   border: T.lineStrong,             dot: T.ink3,    label: T.ink2 },
  };
  const c = colors[type];

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + entryY,
        width: 240,
        opacity,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: T.radiusLg,
        padding: "12px 14px",
        boxShadow: T.shadowMd,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
        <span style={{ fontFamily: T.fontMono, fontSize: 10, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: c.label }}>
          {title}
        </span>
      </div>
      <p style={{ fontFamily: T.fontSerif, fontSize: 13.5, lineHeight: 1.55, color: T.ink2, margin: 0 }}>
        {body}
      </p>
    </div>
  );
};

const DrawingLine: React.FC<{ progress: number; x1: number; y1: number; x2: number; y2: number }> = ({
  progress, x1, y1, x2, y2,
}) => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const drawn = len * progress;
  return (
    <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width="100%" height="100%">
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={T.accent}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={`${len}`}
        strokeDashoffset={`${len - drawn}`}
        opacity="0.5"
      />
      {progress > 0.9 && (
        <circle cx={x2} cy={y2} r="3" fill={T.accent} opacity="0.7" />
      )}
    </svg>
  );
};

export const Scene3CanvasHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn  = interpolate(frame, [0, 25],    [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Static content appearance — no continuous zoom (was causing text shake)
  const arabicOpacity      = interpolate(frame, [20, 60],   [0, 1], { extrapolateRight: "clamp" });
  const translationOpacity = interpolate(frame, [60, 90],   [0, 1], { extrapolateRight: "clamp" });

  // Note 1 — linguistic (amber)
  const note1Spring  = spring({ frame: frame - 110, fps, config: { damping: 22, stiffness: 110 } });
  const note1Opacity = interpolate(frame, [110, 135], [0, 1], { extrapolateRight: "clamp" });
  const note1Y       = interpolate(note1Spring, [0, 1], [20, 0]);

  // Note 2 — thematic (emerald)
  const note2Spring  = spring({ frame: frame - 165, fps, config: { damping: 22, stiffness: 110 } });
  const note2Opacity = interpolate(frame, [165, 190], [0, 1], { extrapolateRight: "clamp" });
  const note2Y       = interpolate(note2Spring, [0, 1], [20, 0]);

  // Drawing line
  const lineProgress = interpolate(frame, [220, 280], [0, 1], { extrapolateRight: "clamp" });

  // Second verse block
  const verse2Opacity = interpolate(frame, [270, 310], [0, 1], { extrapolateRight: "clamp" });
  const verse2Y       = interpolate(frame, [270, 310], [20, 0], { extrapolateRight: "clamp" });

  // Note 3 — cross-reference — use spring so it settles instead of drifting
  const note3Spring  = spring({ frame: frame - 310, fps, config: { damping: 22, stiffness: 110 } });
  const note3Opacity = interpolate(frame, [310, 340], [0, 1], { extrapolateRight: "clamp" });
  const note3Y       = interpolate(note3Spring, [0, 1], [20, 0]);

  // Caption swap: first show canvas intro, then swap to annotation focus
  const caption2Opacity = interpolate(frame, [160, 185], [0, 1], { extrapolateRight: "clamp" });
  const caption1Opacity = interpolate(frame, [145, 165], [1, 0], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: T.bg,
        display: "flex",
        opacity,
        overflow: "hidden",
      }}
    >
      <Rail />
      <Sidebar />

      {/* Canvas — NO zoom/scale transform to prevent text jitter */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: T.bg,
        }}
      >
        <Topbar title="Ayat al-Kursi (2:255)" />

        <div style={{ flex: 1, overflowY: "hidden", position: "relative", padding: "72px 48px 0" }}>
          <div style={{ maxWidth: 740, margin: "0 auto", position: "relative" }}>

            {/* Page cover */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink3, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
                Mode B · Mushaf Canvas
              </div>
              <h1 style={{ fontFamily: T.fontSerif, fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", color: T.ink, margin: 0 }}>
                Ayat al-Kursi
              </h1>
            </div>

            <div style={{ height: 1, background: T.line, marginBottom: 24 }} />

            {/* Primary verse block */}
            <div
              style={{
                margin: "18px 0",
                padding: "22px 26px",
                background: T.bgElev,
                border: `1px solid ${T.accent}`,
                borderRadius: T.radiusLg,
                boxShadow: `0 0 0 3px ${T.accentSoft}, ${T.shadowSm}`,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: T.fontMono, fontSize: 11, color: T.ink3, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent }} />
                  2:255 · Al-Baqarah
                </div>
              </div>

              <div
                style={{
                  fontFamily: T.fontArabic,
                  fontSize: 32,
                  lineHeight: 2.2,
                  direction: "rtl",
                  textAlign: "right",
                  color: T.ink,
                  opacity: arabicOpacity,
                }}
              >
                ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ
              </div>

              <div style={{ fontFamily: T.fontSerif, fontStyle: "italic", fontSize: 14.5, color: T.ink3, lineHeight: 1.5, opacity: translationOpacity }}>
                Allāhu lā ilāha illā huw, al-ḥayyu l-qayyūm…
              </div>

              <div style={{ fontFamily: T.fontSerif, fontSize: 16, lineHeight: 1.55, color: T.ink, opacity: translationOpacity }}>
                Allah — there is no deity except Him, the Ever-Living, the Sustainer of existence. Neither drowsiness overtakes Him nor sleep…
              </div>
            </div>

            {/* Second verse */}
            <div
              style={{
                margin: "18px 0",
                padding: "18px 22px",
                background: T.bgElev,
                border: `1px solid ${T.line}`,
                borderRadius: T.radiusLg,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                opacity: verse2Opacity,
                transform: `translateY(${verse2Y}px)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: T.fontMono, fontSize: 11, color: T.ink3, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.ink4 }} />
                2:256 · Al-Baqarah
              </div>
              <div style={{ fontFamily: T.fontArabic, fontSize: 26, lineHeight: 2.1, direction: "rtl", textAlign: "right", color: T.ink }}>
                لَآ إِكْرَاهَ فِى ٱلدِّينِ ۖ قَد تَّبَيَّنَ ٱلرُّشْدُ مِنَ ٱلْغَىِّ
              </div>
              <div style={{ fontFamily: T.fontSerif, fontSize: 15, lineHeight: 1.55, color: T.ink }}>
                There shall be no compulsion in religion. The right course has become clear from error.
              </div>
            </div>

            {/* Drawing annotation */}
            {lineProgress > 0 && (
              <DrawingLine progress={lineProgress} x1={480} y1={80} x2={630} y2={40} />
            )}

            {/* Note cards — all use spring so they settle to exact pixel position */}
            <NoteCard
              type="linguistic"
              title="Linguistic Note"
              body="'Al-Ḥayy' and 'Al-Qayyūm' form a pair — the Living and the Self-Subsisting. Ibn Taymiyyah considered this the greatest name of Allah."
              opacity={note1Opacity}
              x={620} y={120}
              entryY={note1Y}
            />
            <NoteCard
              type="thematic"
              title="Thematic"
              body="This verse encapsulates divine attributes: Hayy (alive), Qayyum (sustaining), omniscience, and absolute sovereignty."
              opacity={note2Opacity}
              x={620} y={310}
              entryY={note2Y}
            />
            <NoteCard
              type="callout"
              title="Cross-reference"
              body="See also 3:2 and 20:111 — both share 'Al-Ḥayy Al-Qayyūm' as attributes of Allah."
              opacity={note3Opacity}
              x={620} y={490}
              entryY={note3Y}
            />

          </div>
        </div>
      </div>

      {/* Caption overlays — explain what's on screen */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ opacity: caption1Opacity }}>
          <SceneCaption
            tag="Mode B · Mushaf Canvas"
            headline="Read the Quranic text exactly as it appears in the Mushaf"
            body="Verses are displayed in authentic Uthmanic script with transliteration and translation"
            appearAt={20}
            disappearAt={145}
          />
        </div>
        <div style={{ opacity: caption2Opacity }}>
          <SceneCaption
            tag="Annotations"
            headline="Anchor notes directly to verses — linguistic, thematic, or cross-references"
            body="Colour-coded note cards snap to the text and stay in context as you scroll"
            appearAt={0}
            disappearAt={durationInFrames - 35}
          />
        </div>
      </div>
    </div>
  );
};
