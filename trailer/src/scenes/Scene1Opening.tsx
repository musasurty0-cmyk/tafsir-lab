import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { T } from "../tokens";
import { SceneCaption } from "../components/SceneCaption";

const GeometricPattern: React.FC<{ opacity: number }> = ({ opacity }) => {
  const size = 60;
  const cols = Math.ceil(1920 / size) + 1;
  const rows = Math.ceil(1080 / size) + 1;

  return (
    <svg
      width="1920"
      height="1080"
      style={{ position: "absolute", inset: 0, opacity }}
      viewBox="0 0 1920 1080"
    >
      <defs>
        <pattern id="grid" width={size} height={size} patternUnits="userSpaceOnUse">
          <circle cx={size / 2} cy={size / 2} r="1.2" fill={T.ink4} />
          <line x1={size / 2} y1="0" x2={size / 2} y2={size} stroke={T.line} strokeWidth="0.5" />
          <line x1="0" y1={size / 2} x2={size} y2={size / 2} stroke={T.line} strokeWidth="0.5" />
        </pattern>
        {/* Islamic 8-star pattern */}
        <pattern id="star-grid" width={size * 2} height={size * 2} patternUnits="userSpaceOnUse">
          {/* Octagon */}
          <polygon
            points={`${size},${size * 0.3} ${size * 1.3},${size * 0.3} ${size * 1.7},${size * 0.7} ${size * 1.7},${size} ${size * 1.3},${size * 1.3} ${size},${size * 1.3} ${size * 0.7},${size} ${size * 0.7},${size * 0.7}`}
            fill="none"
            stroke={T.line}
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="1920" height="1080" fill="url(#grid)" />
    </svg>
  );
};

export const Scene1Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 14, stiffness: 120 }, delay: 10 });
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const titleOpacity = interpolate(frame, [35, 65], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [35, 65], [12, 0], { extrapolateRight: "clamp" });

  const taglineOpacity = interpolate(frame, [65, 95], [0, 1], { extrapolateRight: "clamp" });
  const taglineY = interpolate(frame, [65, 95], [10, 0], { extrapolateRight: "clamp" });

  const bismillahOpacity = interpolate(frame, [5, 50], [0, 0.07], { extrapolateRight: "clamp" });

  const patternOpacity = interpolate(frame, [0, 60], [0, 1], { extrapolateRight: "clamp" });

  // Fade out at end
  const sceneOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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
        opacity: sceneOpacity,
      }}
    >
      <GeometricPattern opacity={patternOpacity} />

      {/* Bismillah watermark */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: T.fontArabic,
          fontSize: 180,
          color: T.ink,
          opacity: bismillahOpacity,
          whiteSpace: "nowrap",
          letterSpacing: 0,
          userSelect: "none",
        }}
      >
        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
      </div>

      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          marginBottom: 32,
          width: 72,
          height: 72,
          borderRadius: 18,
          background: T.ink,
          color: T.bg,
          display: "grid",
          placeItems: "center",
          fontFamily: T.fontSerif,
          fontWeight: 600,
          fontSize: 34,
          letterSpacing: "-0.02em",
          boxShadow: T.shadowMd,
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
          fontSize: 64,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          color: T.ink,
          lineHeight: 1,
          marginBottom: 20,
        }}
      >
        TafsirLab
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          fontFamily: T.fontSans,
          fontSize: 20,
          color: T.ink3,
          letterSpacing: "0.01em",
          textAlign: "center",
        }}
      >
        A collaborative Quranic research workspace
      </div>

      <SceneCaption
        tag="TafsirLab"
        headline="A new way to study the Quran — deeply, collaboratively, and in context"
        appearAt={100}
        disappearAt={durationInFrames - 35}
        position="bottom"
      />

      {/* Accent line */}
      <div
        style={{
          opacity: taglineOpacity,
          marginTop: 32,
          width: interpolate(frame, [90, 140], [0, 80], { extrapolateRight: "clamp" }),
          height: 2,
          background: T.accent,
          borderRadius: 2,
        }}
      />
    </div>
  );
};
