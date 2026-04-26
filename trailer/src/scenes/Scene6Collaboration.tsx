import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { T } from "../tokens";
import { Rail } from "../components/UIShell";
import { SceneCaption } from "../components/SceneCaption";

const MemberAvatar: React.FC<{ initials: string; color: string; delay: number; online?: boolean }> = ({
  initials, color, delay, online,
}) => {
  const frame = useCurrentFrame();
  const sc = spring({ frame: frame - delay, fps: 30, config: { damping: 14, stiffness: 140 } });
  const op = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        width: 40, height: 40,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${color}cc, ${color})`,
        color: "white",
        display: "grid", placeItems: "center",
        fontSize: 13, fontWeight: 600, fontFamily: T.fontSans,
        border: `2px solid ${T.bg}`,
        transform: `scale(${sc})`, opacity: op,
        position: "relative",
      }}
    >
      {initials}
      {online && (
        <div style={{
          position: "absolute", bottom: -1, right: -1,
          width: 10, height: 10, borderRadius: "50%",
          background: "oklch(0.68 0.15 145)",
          border: `2px solid ${T.bg}`,
        }} />
      )}
    </div>
  );
};

const ProgressBar: React.FC<{ label: string; pct: number; delay: number; color?: string }> = ({
  label, pct, delay, color = T.accent,
}) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [delay, delay + 45], [0, pct], { extrapolateRight: "clamp" });
  const op = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ opacity: op, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontFamily: T.fontSans, fontSize: 12.5, color: T.ink2 }}>
        <span>{label}</span>
        <span style={{ fontFamily: T.fontMono, color: T.ink3, fontSize: 11 }}>{Math.round(width)}%</span>
      </div>
      <div style={{ height: 6, background: T.panel2, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${width}%`, background: color, borderRadius: 3, transition: "none" }} />
      </div>
    </div>
  );
};

const WorkspaceCard: React.FC<{
  name: string;
  type: "private" | "group";
  surah: string;
  arabic: string;
  members: Array<{ initials: string; color: string }>;
  studied: number;
  delay: number;
}> = ({ name, type, surah, arabic, members, studied, delay }) => {
  const frame = useCurrentFrame();
  const sc = spring({ frame: frame - delay, fps: 30, config: { damping: 18, stiffness: 100 } });
  const op = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        padding: 20,
        background: T.bgElev,
        border: `1px solid ${T.line}`,
        borderRadius: T.radiusLg,
        cursor: "pointer",
        opacity: op,
        transform: `scale(${sc})`,
        boxShadow: T.shadowSm,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: type === "group" ? T.accent : T.panel2,
          color: type === "group" ? "white" : T.ink2,
          display: "grid", placeItems: "center",
          fontSize: 14, fontWeight: 600, fontFamily: T.fontSans,
        }}>
          {name[0]}
        </div>
        <span style={{
          fontFamily: T.fontMono, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase",
          padding: "4px 8px", borderRadius: 4, fontWeight: 500,
          background: type === "group" ? T.accentSoft : T.panel,
          color: type === "group" ? T.accentInk : T.ink3,
        }}>
          {type}
        </span>
      </div>

      <h3 style={{ fontFamily: T.fontSerif, fontSize: 17, fontWeight: 500, color: T.ink, margin: "0 0 8px" }}>{name}</h3>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: T.fontSans, fontSize: 13.5, fontWeight: 500, color: T.ink }}>{surah}</span>
        <span style={{ fontFamily: T.fontArabic, fontSize: 14, color: T.ink2 }}>{arabic}</span>
      </div>

      <div style={{ height: 1, background: T.line, marginBottom: 14 }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: -6 }}>
          {members.map((m, i) => (
            <div
              key={i}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: `linear-gradient(135deg, ${m.color}cc, ${m.color})`,
                color: "white", display: "grid", placeItems: "center",
                fontSize: 10, fontWeight: 600, fontFamily: T.fontSans,
                border: `2px solid ${T.bg}`,
                marginLeft: i > 0 ? -8 : 0,
                zIndex: members.length - i,
                position: "relative",
              }}
            >
              {m.initials}
            </div>
          ))}
          <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.ink3, marginLeft: 8, alignSelf: "center" }}>
            {members.length} members
          </span>
        </div>
        <span style={{
          fontFamily: T.fontMono, fontSize: 11, color: T.accentInk,
          background: T.accentSoft, padding: "3px 8px", borderRadius: 4,
        }}>
          {studied}% studied
        </span>
      </div>
    </div>
  );
};

export const Scene6Collaboration: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn  = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = Math.min(fadeIn, fadeOut);

  const headingOpacity = interpolate(frame, [15, 50], [0, 1], { extrapolateRight: "clamp" });
  const headingY       = interpolate(frame, [15, 50], [15, 0], { extrapolateRight: "clamp" });

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

      {/* Content area */}
      <div style={{ flex: 1, overflowY: "hidden", padding: "60px 56px" }}>

        {/* Heading */}
        <div style={{ opacity: headingOpacity, transform: `translateY(${headingY}px)`, marginBottom: 40 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink3, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
            Workspaces
          </div>
          <h1 style={{ fontFamily: T.fontSerif, fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em", color: T.ink, margin: "0 0 8px" }}>
            Study together
          </h1>
          <p style={{ fontFamily: T.fontSans, fontSize: 16, color: T.ink2, margin: 0 }}>
            Private research or group sessions — track progress verse by verse.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
          {/* Workspace cards */}
          <WorkspaceCard
            name="Personal Study"
            type="private"
            surah="Al-Baqarah"
            arabic="البقرة"
            members={[{ initials: "MU", color: T.accent }]}
            studied={68}
            delay={40}
          />
          <WorkspaceCard
            name="Tafsir Study Group"
            type="group"
            surah="Al-Imran"
            arabic="آل عمران"
            members={[
              { initials: "MU", color: T.accent },
              { initials: "AK", color: "#7C6FF7" },
              { initials: "FA", color: "#E5794E" },
              { initials: "SH", color: "#3B82F6" },
            ]}
            studied={42}
            delay={70}
          />
          <WorkspaceCard
            name="Quran Circle"
            type="group"
            surah="An-Nisa'"
            arabic="النساء"
            members={[
              { initials: "YU", color: "#E5794E" },
              { initials: "ZA", color: "#3B82F6" },
              { initials: "IM", color: "#7C6FF7" },
            ]}
            studied={23}
            delay={100}
          />

          {/* Progress panel */}
          <div
            style={{
              gridColumn: "1 / 3",
              padding: 24,
              background: T.bgElev,
              border: `1px solid ${T.line}`,
              borderRadius: T.radiusLg,
              opacity: interpolate(frame, [120, 145], [0, 1], { extrapolateRight: "clamp" }),
              boxShadow: T.shadowSm,
            }}
          >
            <div style={{ fontFamily: T.fontSans, fontSize: 12, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: T.ink3, marginBottom: 20 }}>
              Group Progress · Tafsir Study Group
            </div>
            <ProgressBar label="Al-Fatihah · 7 verses" pct={100} delay={145} />
            <ProgressBar label="Al-Baqarah · 286 verses" pct={42} delay={160} />
            <ProgressBar label="Ali 'Imran · 200 verses" pct={18} delay={175} />
            <ProgressBar label="An-Nisa' · 176 verses" pct={0} delay={190} color={T.ink4} />
          </div>

          {/* Members panel */}
          <div
            style={{
              padding: 24,
              background: T.bgElev,
              border: `1px solid ${T.line}`,
              borderRadius: T.radiusLg,
              opacity: interpolate(frame, [130, 155], [0, 1], { extrapolateRight: "clamp" }),
              boxShadow: T.shadowSm,
            }}
          >
            <div style={{ fontFamily: T.fontSans, fontSize: 12, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: T.ink3, marginBottom: 18 }}>
              Members
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <MemberAvatar initials="MU" color={T.accent}  delay={155} online />
              <MemberAvatar initials="AK" color="#7C6FF7"   delay={165} online />
              <MemberAvatar initials="FA" color="#E5794E"   delay={175} />
              <MemberAvatar initials="SH" color="#3B82F6"   delay={185} online />
            </div>
            <div style={{ height: 1, background: T.line, margin: "18px 0" }} />
            <div style={{ fontFamily: T.fontSans, fontSize: 12.5, color: T.ink3, lineHeight: 1.5 }}>
              Role-based access · Invite codes · Activity logs
            </div>
          </div>
        </div>

      <SceneCaption
        tag="Collaboration"
        headline="Create group workspaces and track each member's progress verse by verse"
        body="Role-based permissions keep studies structured — members advance; admins oversee"
        appearAt={110}
        disappearAt={durationInFrames - 35}
      />
      </div>
    </div>
  );
};
