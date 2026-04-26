import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { T } from "../tokens";
import { Rail, Sidebar, Topbar } from "../components/UIShell";
import { SceneCaption } from "../components/SceneCaption";

export const Scene2AppShell: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const railX = interpolate(frame, [0, 40], [-T.rail, 0], { extrapolateRight: "clamp" });
  const sidebarX = interpolate(frame, [15, 55], [-T.sidebar, 0], { extrapolateRight: "clamp" });
  const canvasOpacity = interpolate(frame, [40, 80], [0, 1], { extrapolateRight: "clamp" });

  // Staggered tree rows
  const rowDelay = 8;
  const numRows = 6;
  const rowOpacities = Array.from({ length: numRows }, (_, i) =>
    interpolate(frame, [60 + i * rowDelay, 85 + i * rowDelay], [0, 1], { extrapolateRight: "clamp" })
  );

  const canvasContentOpacity = interpolate(frame, [90, 130], [0, 1], { extrapolateRight: "clamp" });
  const canvasContentY = interpolate(frame, [90, 130], [20, 0], { extrapolateRight: "clamp" });

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
      {/* Rail */}
      <div style={{ transform: `translateX(${railX}px)` }}>
        <Rail />
      </div>

      {/* Sidebar */}
      <div style={{ transform: `translateX(${sidebarX}px)`, opacity: interpolate(frame, [10, 50], [0, 1], { extrapolateRight: "clamp" }) }}>
        <Sidebar />
      </div>

      {/* Canvas area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          opacity: canvasOpacity,
          background: T.bg,
          overflow: "hidden",
        }}
      >
        <Topbar />

        {/* Content preview */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            padding: "0 48px",
            overflowY: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 740,
              paddingTop: 72,
              opacity: canvasContentOpacity,
              transform: `translateY(${canvasContentY}px)`,
            }}
          >
            {/* Doc cover */}
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  color: T.ink3,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Al-Baqarah · Verse 255
              </div>
              <h1
                style={{
                  fontFamily: T.fontSerif,
                  fontSize: 40,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  color: T.ink,
                  margin: 0,
                }}
              >
                Ayat al-Kursi
              </h1>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 12.5,
                  color: T.ink3,
                  marginTop: 12,
                  fontFamily: T.fontSans,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${T.accent}, ${T.accentInk})`,
                      color: "white",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 9.5,
                      fontWeight: 600,
                    }}
                  >
                    M
                  </div>
                  Musas
                </div>
                <span>·</span>
                <span>12 notes</span>
                <span>·</span>
                <span>In progress</span>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: T.line, marginBottom: 28 }} />

            {/* Verse block preview */}
            <div
              style={{
                margin: "18px 0",
                padding: "22px 26px",
                background: T.bgElev,
                border: `1px solid ${T.line}`,
                borderRadius: T.radiusLg,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  color: T.ink3,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent }}
                  />
                  2:255 · Al-Baqarah
                </div>
              </div>
              <div
                style={{
                  fontFamily: T.fontArabic,
                  fontSize: 28,
                  lineHeight: 2.1,
                  direction: "rtl",
                  textAlign: "right",
                  color: T.ink,
                }}
              >
                ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ
              </div>
              <div
                style={{
                  fontFamily: T.fontSerif,
                  fontSize: 16,
                  lineHeight: 1.55,
                  color: T.ink,
                }}
              >
                Allah — there is no deity except Him, the Ever-Living, the Sustainer of existence.
              </div>
            </div>
          </div>
        </div>
      </div>

      <SceneCaption
        tag="Workspace"
        headline="Organise your research into workspaces, surahs, and study pages"
        body="A clean sidebar keeps every chapter and page one click away"
        appearAt={85}
        disappearAt={durationInFrames - 35}
      />
    </div>
  );
};
