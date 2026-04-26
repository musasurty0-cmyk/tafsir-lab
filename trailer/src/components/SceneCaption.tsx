import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { T } from "../tokens";

interface SceneCaptionProps {
  tag: string;       // e.g. "Mode B · Mushaf Canvas"
  headline: string;  // e.g. "Annotate directly on the Quranic text"
  body?: string;     // optional extra description
  appearAt?: number; // frame to fade in (default 20)
  disappearAt?: number; // frame to fade out (default parentDuration - 30)
  position?: "bottom" | "top";
}

export const SceneCaption: React.FC<SceneCaptionProps> = ({
  tag,
  headline,
  body,
  appearAt = 20,
  disappearAt = 9999,
  position = "bottom",
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [appearAt, appearAt + 25, disappearAt, disappearAt + 20],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const y = interpolate(frame, [appearAt, appearAt + 25], [14, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        [position === "bottom" ? "bottom" : "top"]: 48,
        left: "50%",
        transform: `translateX(-50%) translateY(${position === "bottom" ? y : -y}px)`,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
        zIndex: 100,
        textAlign: "center",
        maxWidth: 680,
        padding: "0 40px",
      }}
    >
      {/* Tag pill */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: 100,
          background: T.bgElev,
          border: `1px solid ${T.lineStrong}`,
          boxShadow: T.shadowSm,
          fontFamily: T.fontMono,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: T.accentInk,
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: T.accent,
            flexShrink: 0,
          }}
        />
        {tag}
      </div>

      {/* Headline */}
      <div
        style={{
          fontFamily: T.fontSerif,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: T.ink,
          lineHeight: 1.25,
          padding: "8px 18px",
          background: `rgba(250,250,248,0.92)`,
          backdropFilter: "blur(10px)",
          borderRadius: T.radiusLg,
          border: `1px solid ${T.line}`,
          boxShadow: T.shadowMd,
        }}
      >
        {headline}
      </div>

      {/* Body */}
      {body && (
        <div
          style={{
            fontFamily: T.fontSans,
            fontSize: 14,
            color: T.ink3,
            lineHeight: 1.5,
            padding: "6px 14px",
            background: `rgba(250,250,248,0.82)`,
            backdropFilter: "blur(8px)",
            borderRadius: T.radius,
            border: `1px solid ${T.line}`,
          }}
        >
          {body}
        </div>
      )}
    </div>
  );
};
