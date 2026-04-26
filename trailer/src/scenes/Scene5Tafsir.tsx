import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { T } from "../tokens";
import { Rail, Sidebar, Topbar } from "../components/UIShell";
import { SceneCaption } from "../components/SceneCaption";

const WbwCell: React.FC<{ arabic: string; translit: string; meaning: string; delay: number }> = ({
  arabic, translit, meaning, delay,
}) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
  const y  = interpolate(frame, [delay, delay + 20], [8, 0],  { extrapolateRight: "clamp" });
  return (
    <div style={{ padding: 12, background: T.bgElev, border: `1px solid ${T.line}`, borderRadius: 8, textAlign: "center", opacity: op, transform: `translateY(${y}px)` }}>
      <div style={{ fontFamily: T.fontArabic, fontSize: 18, direction: "rtl", color: T.ink, marginBottom: 4 }}>{arabic}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink3, letterSpacing: "0.02em" }}>{translit}</div>
      <div style={{ fontFamily: T.fontSerif, fontSize: 12.5, color: T.ink, marginTop: 4 }}>{meaning}</div>
    </div>
  );
};

export const Scene5Tafsir: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn  = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = Math.min(fadeIn, fadeOut);

  const drawerSpring = spring({ frame: frame - 10, fps, config: { damping: 22, stiffness: 120 } });
  const drawerX = interpolate(drawerSpring, [0, 1], [T.drawer, 0]);

  const activeTab = frame > 120 ? 1 : 0;
  const tab2Opacity = interpolate(frame, [110, 130], [0, 1], { extrapolateRight: "clamp" });

  const commentaryOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: "clamp" });
  const commentaryY       = interpolate(frame, [30, 60], [10, 0], { extrapolateRight: "clamp" });

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

      {/* Main canvas (dimmed) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", opacity: 0.4, overflow: "hidden" }}>
        <Topbar />
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 48px" }}>
          <div style={{ width: "100%", maxWidth: 740, paddingTop: 60 }}>
            <h1 style={{ fontFamily: T.fontSerif, fontSize: 36, fontWeight: 600, color: T.ink, margin: "0 0 16px" }}>Ayat al-Kursi</h1>
            <div style={{ height: 1, background: T.line, marginBottom: 24 }} />
            <div style={{ fontFamily: T.fontArabic, fontSize: 30, direction: "rtl", textAlign: "right", color: T.ink, lineHeight: 2.2, marginBottom: 16 }}>
              ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ
            </div>
          </div>
        </div>
      </div>

      {/* Drawer */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: T.drawer,
          transform: `translateX(${drawerX}px)`,
          background: `rgba(254,254,254,0.88)`,
          backdropFilter: "blur(20px) saturate(140%)",
          borderLeft: `1px solid ${T.lineStrong}`,
          boxShadow: T.shadowLg,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drawer head */}
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.fontSans, fontSize: 13.5, fontWeight: 500, color: T.ink }}>
              Tafsir & Commentary
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink3, marginTop: 2 }}>
              2:255 · Al-Baqarah
            </div>
          </div>
          <div style={{ width: 28, height: 28, borderRadius: 6, display: "grid", placeItems: "center", color: T.ink3, fontSize: 16 }}>×</div>
        </div>

        {/* Tabs */}
        <div style={{ padding: "8px 14px 0", display: "flex", gap: 2, borderBottom: `1px solid ${T.line}` }}>
          {["Commentary", "Word-by-word", "Translation", "Audio"].map((tab, i) => (
            <div
              key={tab}
              style={{
                padding: "8px 10px",
                fontFamily: T.fontSans,
                fontSize: 13,
                color: i === activeTab ? T.ink : T.ink3,
                borderBottom: `2px solid ${i === activeTab ? T.accent : "transparent"}`,
                marginBottom: -1,
                fontWeight: i === activeTab ? 500 : 400,
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "hidden", padding: "20px 22px 40px" }}>

          {activeTab === 0 && (
            <div style={{ opacity: commentaryOpacity, transform: `translateY(${commentaryY}px)` }}>
              {/* Verse preview */}
              <div style={{ padding: 16, background: T.panel, border: `1px solid ${T.line}`, borderRadius: T.radiusLg, marginBottom: 22 }}>
                <div style={{ fontFamily: T.fontArabic, fontSize: 22, direction: "rtl", textAlign: "right", lineHeight: 1.9, color: T.ink, marginBottom: 10 }}>
                  ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ
                </div>
                <div style={{ fontFamily: T.fontSerif, fontSize: 14.5, color: T.ink2, lineHeight: 1.55 }}>
                  Allah — there is no deity except Him, the Ever-Living, the Sustainer of existence.
                </div>
              </div>

              {/* Commentary 1 */}
              <div style={{ marginBottom: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.panel2, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", fontFamily: T.fontSerif, fontSize: 13, fontWeight: 500, color: T.ink2 }}>
                    ط
                  </div>
                  <div>
                    <div style={{ fontFamily: T.fontSans, fontSize: 13.5, fontWeight: 500, color: T.ink }}>Ibn Kathir</div>
                    <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink3, marginTop: 1, letterSpacing: "0.03em" }}>TAFSIR IBN KATHIR · 774 AH</div>
                  </div>
                </div>
                <div style={{ fontFamily: T.fontSerif, fontSize: 14.5, lineHeight: 1.7, color: T.ink }}>
                  <p style={{ margin: "0 0 10px" }}>
                    This is the greatest verse in the Quran. Al-Bukhari recorded that Abu Hurayrah said: "Allah's Messenger assigned me to guard the Zakat of Ramadan…"
                  </p>
                  <p style={{ margin: 0 }}>
                    The attributes <span style={{ fontFamily: T.fontArabic, fontSize: 17, direction: "rtl", color: T.ink, margin: "0 4px" }}>الحيّ القيّوم</span> are the greatest of Allah's names, establishing His eternal life and absolute sovereignty over all existence.
                  </p>
                </div>
              </div>

              {/* Commentary 2 */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.panel2, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", fontFamily: T.fontSerif, fontSize: 13, fontWeight: 500, color: T.ink2 }}>
                    ق
                  </div>
                  <div>
                    <div style={{ fontFamily: T.fontSans, fontSize: 13.5, fontWeight: 500, color: T.ink }}>Al-Qurtubi</div>
                    <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink3, marginTop: 1, letterSpacing: "0.03em" }}>AL-JAMI LI-AHKAM AL-QURAN · 671 AH</div>
                  </div>
                </div>
                <div style={{ fontFamily: T.fontSerif, fontSize: 14.5, lineHeight: 1.7, color: T.ink }}>
                  The word <span style={{ fontFamily: T.fontArabic, fontSize: 17, direction: "rtl", margin: "0 3px" }}>سِنَة</span> means light sleep or drowsiness, while <span style={{ fontFamily: T.fontArabic, fontSize: 17, direction: "rtl", margin: "0 3px" }}>نَوْم</span> is deep sleep. Allah is transcendent above both.
                </div>
              </div>
            </div>
          )}

          {activeTab === 1 && (
            <div style={{ opacity: tab2Opacity }}>
              <div style={{ fontFamily: T.fontSans, fontSize: 12, color: T.ink3, marginBottom: 14, letterSpacing: "0.02em" }}>
                Hover any word to see detailed breakdown
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                <WbwCell arabic="ٱللَّهُ" translit="Allāhu" meaning="Allah" delay={0} />
                <WbwCell arabic="لَآ" translit="lā" meaning="no / not" delay={12} />
                <WbwCell arabic="إِلَٰهَ" translit="ilāha" meaning="deity" delay={24} />
                <WbwCell arabic="إِلَّا" translit="illā" meaning="except" delay={36} />
                <WbwCell arabic="هُوَ" translit="huwa" meaning="He" delay={48} />
                <WbwCell arabic="ٱلْحَىُّ" translit="al-ḥayyu" meaning="the Ever-Living" delay={60} />
                <WbwCell arabic="ٱلْقَيُّومُ" translit="al-qayyūmu" meaning="the Sustainer" delay={72} />
              </div>
            </div>
          )}
        </div>
      </div>

      <SceneCaption
        tag="Tafsir Integration"
        headline="Access commentary from Ibn Kathir, Al-Qurtubi and more — right beside the verse"
        body="Switch between commentary, word-by-word breakdown, translations, and audio in one panel"
        appearAt={25}
        disappearAt={durationInFrames - 35}
      />
    </div>
  );
};
