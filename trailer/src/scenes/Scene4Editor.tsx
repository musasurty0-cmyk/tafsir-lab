import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { T } from "../tokens";
import { Rail, Sidebar, Topbar } from "../components/UIShell";
import { SceneCaption } from "../components/SceneCaption";

const typeText = (fullText: string, frame: number, startFrame: number, speed = 1.5) => {
  const chars = Math.floor(Math.max(0, (frame - startFrame) * speed));
  return fullText.slice(0, chars);
};

const SlashMenu: React.FC<{ opacity: number; y: number }> = ({ opacity, y }) => (
  <div
    style={{
      position: "absolute",
      top: y,
      left: 0,
      background: T.bgElev,
      border: `1px solid ${T.lineStrong}`,
      borderRadius: T.radiusLg,
      boxShadow: T.shadowLg,
      padding: 6,
      width: 280,
      zIndex: 50,
      opacity,
    }}
  >
    <div style={{ padding: "6px 8px 2px", fontFamily: T.fontSans, fontSize: 10.5, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: T.ink4 }}>
      Verse
    </div>
    {[
      { icon: "📖", name: "/ayah", desc: "Embed a Quranic verse block", kbd: "↵" },
      { icon: "🔤", name: "/word", desc: "Insert word-by-word analysis", kbd: "" },
    ].map((item, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 8px",
          borderRadius: 6,
          background: i === 0 ? T.panel : "transparent",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 32, height: 32, borderRadius: 6,
            border: `1px solid ${T.line}`,
            background: T.bg,
            display: "grid", placeItems: "center",
            fontSize: 14, flexShrink: 0,
          }}
        >
          {item.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 500, color: T.ink }}>{item.name}</div>
          <div style={{ fontFamily: T.fontSans, fontSize: 11.5, color: T.ink3, marginTop: 1 }}>{item.desc}</div>
        </div>
        {item.kbd && (
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink4 }}>{item.kbd}</span>
        )}
      </div>
    ))}
    <div style={{ padding: "6px 8px 2px", fontFamily: T.fontSans, fontSize: 10.5, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: T.ink4, marginTop: 4 }}>
      Content
    </div>
    {[
      { icon: "📝", name: "/heading", desc: "Large section heading" },
      { icon: "💬", name: "/callout", desc: "Highlighted callout block" },
      { icon: "—",  name: "/divider", desc: "Horizontal rule" },
    ].map((item, i) => (
      <div
        key={i}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 6 }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${T.line}`, background: T.bg, display: "grid", placeItems: "center", fontSize: 14, flexShrink: 0 }}>
          {item.icon}
        </div>
        <div>
          <div style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 500, color: T.ink }}>{item.name}</div>
          <div style={{ fontFamily: T.fontSans, fontSize: 11.5, color: T.ink3 }}>{item.desc}</div>
        </div>
      </div>
    ))}
  </div>
);

export const Scene4Editor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = Math.min(fadeIn, fadeOut);

  const PARA1 = "In this study page, we examine the profound significance of Ayat al-Kursi — the Throne Verse — from Surah Al-Baqarah.";
  const PARA2 = "The verse opens with the declaration of Allah's oneness and two of His most encompassing names.";
  const SLASH = "/ayah 2:255";

  const para1Text = typeText(PARA1, frame, 20, 1.8);
  const para2Text = typeText(PARA2, frame, 85, 1.8);
  const slashText = typeText(SLASH, frame, 155, 2.2);

  const showSlashMenu = frame > 155 && frame < 215;
  const slashMenuOpacity = interpolate(frame, [162, 175], [0, 1], { extrapolateRight: "clamp" });
  const menuDismiss = interpolate(frame, [205, 215], [1, 0], { extrapolateRight: "clamp" });

  // Verse block embeds after slash command
  const verseBlockOpacity = interpolate(frame, [218, 238], [0, 1], { extrapolateRight: "clamp" });
  const verseBlockScale = spring({ frame: frame - 218, fps, config: { damping: 16, stiffness: 130 } });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: T.bg,
        display: "flex",
        opacity: sceneOpacity,
        overflow: "hidden",
      }}
    >
      <Rail />
      <Sidebar />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar title="Ayat al-Kursi · Notes" />

        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 48px", overflowY: "hidden" }}>
          <div style={{ width: "100%", maxWidth: 740, paddingTop: 60, position: "relative" }}>

            {/* Mode A badge */}
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink3, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
              Mode A · Free Editor
            </div>

            {/* Heading */}
            <h1 style={{ fontFamily: T.fontSerif, fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", color: T.ink, margin: "0 0 8px 0" }}>
              Study Notes
            </h1>

            <div style={{ height: 1, background: T.line, margin: "20px 0" }} />

            {/* Paragraph 1 */}
            <p style={{ fontFamily: T.fontSerif, fontSize: 16.5, lineHeight: 1.65, margin: "0 0 20px 0", color: T.ink, minHeight: "1.65em" }}>
              {para1Text}
              {frame > 20 && frame < 85 && (
                <span style={{ borderRight: `2px solid ${T.ink}`, animation: "none", opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0 }}>
                  &nbsp;
                </span>
              )}
            </p>

            {/* Paragraph 2 */}
            {frame > 80 && (
              <p style={{ fontFamily: T.fontSerif, fontSize: 16.5, lineHeight: 1.65, margin: "0 0 20px 0", color: T.ink, minHeight: "1.65em" }}>
                {para2Text}
                {frame > 85 && frame < 155 && (
                  <span style={{ borderRight: `2px solid ${T.ink}`, opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0 }}>
                    &nbsp;
                  </span>
                )}
              </p>
            )}

            {/* Slash command line */}
            {frame > 148 && (
              <div style={{ position: "relative" }}>
                <p style={{ fontFamily: T.fontSerif, fontSize: 16.5, lineHeight: 1.65, margin: "0 0 20px 0", color: T.accent, minHeight: "1.65em", display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      fontFamily: T.fontMono,
                      fontSize: 14,
                      background: T.accentSoft,
                      padding: "2px 8px",
                      borderRadius: 5,
                      color: T.accentInk,
                    }}
                  >
                    {slashText}
                  </span>
                  {frame > 155 && frame < 220 && (
                    <span style={{ borderRight: `2px solid ${T.accent}`, opacity: Math.sin(frame * 0.4) > 0 ? 1 : 0 }}>
                      &nbsp;
                    </span>
                  )}
                </p>

                {/* Slash menu */}
                {showSlashMenu && (
                  <SlashMenu
                    opacity={slashMenuOpacity * menuDismiss}
                    y={30}
                  />
                )}
              </div>
            )}

            {/* Embedded verse block after slash command */}
            {frame >= 218 && (
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
                  opacity: verseBlockOpacity,
                  transform: `scale(${verseBlockScale})`,
                  transformOrigin: "top left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: T.fontMono, fontSize: 11, color: T.ink3, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent }} />
                  2:255 · Al-Baqarah
                </div>
                <div style={{ fontFamily: T.fontArabic, fontSize: 28, lineHeight: 2.1, direction: "rtl", textAlign: "right", color: T.ink }}>
                  ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ
                </div>
                <div style={{ fontFamily: T.fontSerif, fontSize: 15.5, lineHeight: 1.55, color: T.ink }}>
                  Allah — there is no deity except Him, the Ever-Living, the Sustainer of existence.
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <SceneCaption
        tag="Mode A · Free Editor"
        headline="Write research notes and embed Quranic verses with a single slash command"
        body="Type /ayah followed by any verse reference — the block appears inline, ready to annotate"
        appearAt={15}
        disappearAt={durationInFrames - 35}
      />
    </div>
  );
};
