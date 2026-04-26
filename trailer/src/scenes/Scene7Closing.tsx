import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { T } from "../tokens";

const IslamicStar: React.FC<{ x: number; y: number; size: number; opacity: number }> = ({
  x, y, size, opacity,
}) => {
  // 8-pointed star
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const outerAngle = (i * Math.PI) / 4 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 8;
    const outer = size;
    const inner = size * 0.42;
    pts.push(`${x + outer * Math.cos(outerAngle)},${y + outer * Math.sin(outerAngle)}`);
    pts.push(`${x + inner * Math.cos(innerAngle)},${y + inner * Math.sin(innerAngle)}`);
  }
  return (
    <polygon
      points={pts.join(" ")}
      fill="none"
      stroke={T.line}
      strokeWidth="0.8"
      opacity={opacity}
    />
  );
};

const BackgroundPattern: React.FC<{ progress: number }> = ({ progress }) => {
  const stars = [];
  const spacing = 110;
  const cols = Math.ceil(1920 / spacing) + 1;
  const rows = Math.ceil(1080 / spacing) + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      stars.push(
        <IslamicStar
          key={`${r}-${c}`}
          x={c * spacing + (r % 2 === 0 ? 0 : spacing / 2)}
          y={r * spacing}
          size={28}
          opacity={progress * 0.6}
        />
      );
    }
  }
  return (
    <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
      {stars}
    </svg>
  );
};

const FeaturePill: React.FC<{ label: string; delay: number }> = ({ label, delay }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
  const y  = interpolate(frame, [delay, delay + 20], [6, 0], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        opacity: op,
        transform: `translateY(${y}px)`,
        padding: "6px 14px",
        borderRadius: 100,
        border: `1px solid ${T.lineStrong}`,
        background: T.bgElev,
        fontFamily: T.fontSans,
        fontSize: 13,
        color: T.ink2,
        boxShadow: T.shadowSm,
      }}
    >
      {label}
    </div>
  );
};

export const Scene7Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const patternProgress = interpolate(frame, [20, 80], [0, 1], { extrapolateRight: "clamp" });

  const logoSpring = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 110 } });
  const logoOpacity = interpolate(frame, [15, 40], [0, 1], { extrapolateRight: "clamp" });

  const titleOpacity = interpolate(frame, [50, 80], [0, 1], { extrapolateRight: "clamp" });
  const titleY       = interpolate(frame, [50, 80], [12, 0], { extrapolateRight: "clamp" });

  const taglineOpacity = interpolate(frame, [80, 110], [0, 1], { extrapolateRight: "clamp" });
  const taglineY       = interpolate(frame, [80, 110], [8, 0], { extrapolateRight: "clamp" });

  const ctaSpring = spring({ frame: frame - 115, fps, config: { damping: 16, stiffness: 120 } });
  const ctaOpacity = interpolate(frame, [115, 140], [0, 1], { extrapolateRight: "clamp" });

  const accentWidth = interpolate(frame, [90, 150], [0, 120], { extrapolateRight: "clamp" });

  const bismillahOpacity = interpolate(frame, [30, 90], [0, 0.055], { extrapolateRight: "clamp" });

  // Final fade to white
  const endFade = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeIn * endFade,
        overflow: "hidden",
      }}
    >
      <BackgroundPattern progress={patternProgress} />

      {/* Bismillah watermark */}
      <div
        style={{
          position: "absolute",
          fontFamily: T.fontArabic,
          fontSize: 160,
          color: T.ink,
          opacity: bismillahOpacity,
          whiteSpace: "nowrap",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
      </div>

      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoSpring})`,
          opacity: logoOpacity,
          marginBottom: 28,
          width: 80,
          height: 80,
          borderRadius: 20,
          background: T.ink,
          color: T.bg,
          display: "grid",
          placeItems: "center",
          fontFamily: T.fontSerif,
          fontWeight: 600,
          fontSize: 38,
          letterSpacing: "-0.02em",
          boxShadow: T.shadowLg,
        }}
      >
        T
      </div>

      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontFamily: T.fontSerif,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          color: T.ink,
          lineHeight: 1,
          marginBottom: 18,
        }}
      >
        TafsirLab
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          fontFamily: T.fontSerif,
          fontStyle: "italic",
          fontSize: 22,
          color: T.ink3,
          marginBottom: 36,
          textAlign: "center",
        }}
      >
        Deepen your understanding. Together.
      </div>

      {/* Accent line */}
      <div
        style={{
          width: accentWidth,
          height: 2,
          background: T.accent,
          borderRadius: 2,
          marginBottom: 44,
        }}
      />

      {/* CTA button */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaSpring})`,
          marginBottom: 52,
          padding: "14px 32px",
          borderRadius: 8,
          background: T.accent,
          color: "white",
          fontFamily: T.fontSans,
          fontSize: 16,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: `0 4px 20px ${T.accentSoft}`,
        }}
      >
        Begin your journey
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10M9 5l4 3-4 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Feature pills */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: 600,
          opacity: interpolate(frame, [145, 170], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <FeaturePill label="Mushaf Canvas" delay={148} />
        <FeaturePill label="Rich Text Editor" delay={158} />
        <FeaturePill label="Tafsir Integration" delay={168} />
        <FeaturePill label="Group Workspaces" delay={178} />
        <FeaturePill label="Progress Tracking" delay={188} />
      </div>
    </div>
  );
};
