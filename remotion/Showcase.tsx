/**
 * TafsirLab — animated feature showcase (professional cut of the capture montage).
 *
 * Ten scenes, ~81 s @ 30 fps, 1920×1080. Every UI is reconstructed from the
 * app's real design system (theme.ts) as motion graphics — no screen capture,
 * so it's razor-sharp at any resolution.
 *
 *   1. Title
 *   2. Make a group      — create-workspace flow (NEW)
 *   3. Surah grid        — the 114-surah board cascading in (NEW)
 *   4. Join a group      — invite code → a second member joins
 *   5. Roles & promote   — permissions matrix, promote a member
 *   6. Live sync         — laptop + tablet side by side
 *   7. Rich notes        — typing, /ayah block, tafsir drawer
 *   8. Annotate (sync)   — two Mushaf pages inked in parallel
 *   9. Channels          — organise the workspace
 *  10. End card
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

export const SHOW_FPS = 30;

export const LEN = {
  title:      90,
  makeGroup:  270,
  surahGrid:  240,
  joinGroup:  240,
  permissions:270,
  sync:       360,
  notes:      300,
  annotate:   330,
  channels:   240,
  end:        100,
};
export const SHOW_DURATION =
  LEN.title + LEN.makeGroup + LEN.surahGrid + LEN.joinGroup + LEN.permissions +
  LEN.sync + LEN.notes + LEN.annotate + LEN.channels + LEN.end;

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// ── primitives ──────────────────────────────────────────────────────────────

const useSpr = (delay = 0, damping = 14, mass = 0.8) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass } });
};

const typed = (text: string, frame: number, start: number, cpf = 0.9) =>
  text.slice(0, Math.max(0, Math.floor((frame - start) * cpf)));
const isTyped = (text: string, frame: number, start: number, cpf = 0.9) =>
  frame - start >= text.length / cpf;

const Caret: React.FC<{ color?: string; h?: number }> = ({ color = C.accent, h = 30 }) => {
  const frame = useCurrentFrame();
  return (
    <span style={{
      display: "inline-block", width: 2.5, height: h, marginLeft: 2,
      verticalAlign: "text-bottom", background: color,
      opacity: Math.floor(frame / 15) % 2 === 0 ? 1 : 0,
    }} />
  );
};

const Scene: React.FC<{ dur: number; bg?: string; children: React.ReactNode }> = ({ dur, bg = C.bg, children }) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    interpolate(frame, [0, 12], [0, 1], CL),
    interpolate(frame, [dur - 12, dur], [1, 0], CL),
  );
  return (
    <AbsoluteFill style={{ background: bg, opacity, fontFamily: FONTS.sans, color: C.ink }}>
      <AbsoluteFill style={{
        background:
          "radial-gradient(1100px 700px at 82% -8%, rgba(201,138,45,0.06), transparent 60%)," +
          "radial-gradient(900px 620px at -6% 24%, rgba(62,142,110,0.055), transparent 60%)",
      }} />
      {children}
    </AbsoluteFill>
  );
};

const Eyebrow: React.FC<{ children: React.ReactNode; light?: boolean }> = ({ children, light }) => (
  <div style={{
    fontFamily: FONTS.mono, fontSize: 22, letterSpacing: "0.12em", textTransform: "uppercase",
    color: light ? "rgba(250,248,242,0.65)" : C.ink3, display: "flex", alignItems: "center", gap: 14,
  }}>
    <span style={{ width: 10, height: 10, borderRadius: 99, background: C.accent, boxShadow: `0 0 0 7px ${C.accentSoft}` }} />
    {children}
  </div>
);

const Headline: React.FC<{ children: React.ReactNode; light?: boolean }> = ({ children, light }) => (
  <div style={{
    fontFamily: FONTS.serif, fontSize: 60, fontWeight: 500, marginTop: 20,
    letterSpacing: "-0.015em", color: light ? "#F6F4EE" : C.ink, lineHeight: 1.05,
  }}>
    {children}
  </div>
);

const Chrome: React.FC<{ tab: string; w: number; h?: number; children: React.ReactNode }> = ({ tab, w, h, children }) => (
  <div style={{
    width: w, height: h, background: C.bgElev, borderRadius: 18, border: `1px solid ${C.line2}`,
    boxShadow: "0 40px 90px rgba(34,31,26,0.16), 0 12px 30px rgba(34,31,26,0.10)", overflow: "hidden",
  }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "14px 20px",
      borderBottom: `1px solid ${C.line}`, background: C.panel,
    }}>
      {["#E1655B", "#E5B95B", "#79BA7E"].map((c) => (
        <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c }} />
      ))}
      <span style={{ fontFamily: FONTS.mono, fontSize: 17, color: C.ink3, marginLeft: 12 }}>{tab}</span>
    </div>
    {children}
  </div>
);

const Cursor: React.FC<{ x: number; y: number; press?: number }> = ({ x, y, press = 0 }) => (
  <div style={{ position: "absolute", left: x, top: y, zIndex: 60, transform: `scale(${1 - press * 0.18})` }}>
    {press > 0.05 && (
      <div style={{
        position: "absolute", left: -6, top: -6, width: 40, height: 40, borderRadius: 99,
        border: `2px solid ${C.accent}`, opacity: press * 0.7, transform: `scale(${0.4 + press})`,
      }} />
    )}
    <svg width="28" height="32" viewBox="0 0 28 32">
      <path d="M3 2 L3 25 L9 19 L13.5 30 L18 28 L13.5 17 L22 16.5 Z" fill="#1b1b1b" stroke="#fff" strokeWidth="1.8" />
    </svg>
  </div>
);

const Pip: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <span style={{ width: size, height: size, borderRadius: 99, background: color, border: "2.5px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)", display: "inline-block" }} />
);

const Avatar: React.FC<{ label: string; grad: [string, string]; size?: number }> = ({ label, grad, size = 40 }) => (
  <div style={{
    width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
    background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`, color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: FONTS.serif, fontWeight: 600, fontSize: size * 0.38,
  }}>{label}</div>
);

// ── surah data ──────────────────────────────────────────────────────────────

const SURAHS: [number, string, string, string, number, string][] = [
  [1, "الفاتحة", "Al-Fātiḥa", "The Opening", 7, "Makki"],
  [2, "البقرة", "Al-Baqara", "The Cow", 286, "Madani"],
  [3, "آل عمران", "Āl ʿImrān", "Family of Imran", 200, "Madani"],
  [4, "النساء", "An-Nisāʾ", "The Women", 176, "Madani"],
  [5, "المائدة", "Al-Māʾida", "The Table", 120, "Madani"],
  [6, "الأنعام", "Al-Anʿām", "The Cattle", 165, "Makki"],
  [7, "الأعراف", "Al-Aʿrāf", "The Heights", 206, "Makki"],
  [8, "الأنفال", "Al-Anfāl", "The Spoils", 75, "Madani"],
  [9, "التوبة", "At-Tawba", "The Repentance", 129, "Madani"],
  [10, "يونس", "Yūnus", "Jonah", 109, "Makki"],
  [11, "هود", "Hūd", "Hud", 123, "Makki"],
  [12, "يوسف", "Yūsuf", "Joseph", 111, "Makki"],
  [13, "الرعد", "Ar-Raʿd", "The Thunder", 43, "Madani"],
  [14, "إبراهيم", "Ibrāhīm", "Abraham", 52, "Makki"],
  [15, "الحجر", "Al-Ḥijr", "The Rocky Tract", 99, "Makki"],
  [16, "النحل", "An-Naḥl", "The Bee", 128, "Makki"],
  [17, "الإسراء", "Al-Isrāʾ", "The Night Journey", 111, "Makki"],
  [18, "الكهف", "Al-Kahf", "The Cave", 110, "Makki"],
  [19, "مريم", "Maryam", "Mary", 98, "Makki"],
  [20, "طه", "Ṭā-Hā", "Ta-Ha", 135, "Makki"],
  [21, "الأنبياء", "Al-Anbiyāʾ", "The Prophets", 112, "Makki"],
  [22, "الحج", "Al-Ḥajj", "The Pilgrimage", 78, "Madani"],
  [23, "المؤمنون", "Al-Muʾminūn", "The Believers", 118, "Makki"],
  [24, "النور", "An-Nūr", "The Light", 64, "Madani"],
];

// ═══════════════ 1 · TITLE ═══════════════

export const STitle: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = useSpr(24, 14, 0.7);
  const bism = interpolate(frame, [4, 32], [0, 1], CL);
  const tag  = interpolate(frame, [46, 72], [0, 1], CL);
  return (
    <Scene dur={LEN.title}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: FONTS.arabic, fontSize: 50, color: C.ink2, opacity: bism, direction: "rtl", marginBottom: 44 }}>
          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28, transform: `scale(${0.9 + pop * 0.1})`, opacity: pop }}>
          <div style={{
            width: 104, height: 104, borderRadius: 24, background: C.ink, color: C.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONTS.serif, fontSize: 60, fontWeight: 700, boxShadow: "0 24px 60px rgba(34,31,26,0.25)",
          }}>T</div>
          <div style={{ fontFamily: FONTS.serif, fontSize: 112, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Tafsir<span style={{ fontStyle: "italic", fontWeight: 400, color: C.ink2 }}>Lab</span>
          </div>
        </div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 40, color: C.ink2, marginTop: 40, opacity: tag }}>
          A collaborative study desk for the Qurʾān.
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ═══════════════ 2 · MAKE A GROUP ═══════════════

export const SMakeGroup: React.FC = () => {
  const frame = useCurrentFrame();

  const name = "Study Group";
  const modalIn = useSpr(48, 15);
  const typeStart = 92;
  const nameDone = isTyped(name, frame, typeStart, 0.35);

  // cursor path: to Create-workspace btn (click ~40), then to modal Create (~170)
  const cx = interpolate(frame, [0, 38, 60, 168, 190], [1350, 300, 960, 960, 1080], CL);
  const cy = interpolate(frame, [0, 38, 60, 168, 190], [300, 250, 620, 620, 690], CL);
  const press1 = interpolate(frame, [38, 44, 50], [0, 1, 0], CL);
  const press2 = interpolate(frame, [176, 182, 188], [0, 1, 0], CL);

  const created = frame >= 196;
  const successPop = useSpr(200, 13);

  return (
    <Scene dur={LEN.makeGroup}>
      <div style={{ position: "absolute", left: 110, top: 84 }}>
        <Eyebrow>Make a group</Eyebrow>
        <Headline>Start a workspace in seconds.</Headline>
      </div>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
        <Chrome tab="tafsirlab.app · home" w={1280} h={620}>
          <div style={{ position: "relative", height: 560, padding: "50px 70px" }}>
            {!created ? (
              <>
                <div style={{ fontFamily: FONTS.serif, fontSize: 46, fontWeight: 600 }}>Welcome, Musa</div>
                <div style={{ fontSize: 22, color: C.ink3, marginTop: 10 }}>
                  Create a workspace to begin your Qurʾān study.
                </div>
                <div style={{
                  marginTop: 34, display: "inline-flex", alignItems: "center", gap: 10,
                  background: C.ink, color: C.bg, fontSize: 22, fontWeight: 600,
                  padding: "15px 26px", borderRadius: 12,
                  transform: `scale(${1 - press1 * 0.05})`,
                }}>
                  + Create workspace
                </div>
                <div style={{ marginTop: 40, fontFamily: FONTS.mono, fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase", color: C.ink4 }}>
                  Your workspaces
                </div>
                <div style={{ marginTop: 12, fontSize: 20, color: C.ink4 }}>No workspaces yet — create one above.</div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: successPop, transform: `scale(${0.94 + successPop * 0.06})` }}>
                <div style={{ width: 90, height: 90, borderRadius: 24, background: `linear-gradient(135deg, ${C.accent}, ${C.accentInk})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.serif, fontSize: 40, fontWeight: 700 }}>ST</div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 48, fontWeight: 600, marginTop: 22 }}>Study Group</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 18, color: C.accentInk, marginTop: 8, letterSpacing: "0.04em" }}>✓ workspace created</div>
              </div>
            )}

            {/* create-workspace modal */}
            {!created && frame >= 46 && (
              <div style={{
                position: "absolute", left: "50%", top: 250, transform: `translateX(-50%) translateY(${(1 - modalIn) * 20}px)`,
                width: 560, background: C.bgElev, border: `1px solid ${C.line2}`, borderRadius: 16,
                boxShadow: "0 30px 70px rgba(34,31,26,0.22)", padding: "32px 36px", opacity: modalIn,
              }}>
                <div style={{ fontFamily: FONTS.serif, fontSize: 30, fontWeight: 600 }}>New workspace</div>
                <div style={{ fontSize: 18, color: C.ink3, marginTop: 6 }}>Give your study group a name.</div>
                <div style={{
                  marginTop: 22, border: `1.5px solid ${C.accent}`, borderRadius: 10, padding: "14px 18px",
                  fontSize: 24, color: C.ink, minHeight: 30,
                }}>
                  {typed(name, frame, typeStart, 0.35)}{!nameDone && <Caret h={26} />}
                </div>
                <div style={{
                  marginTop: 22, textAlign: "right",
                }}>
                  <span style={{ background: C.ink, color: C.bg, fontSize: 20, fontWeight: 600, padding: "12px 28px", borderRadius: 10, transform: `scale(${1 - press2 * 0.06})`, display: "inline-block" }}>
                    Create →
                  </span>
                </div>
              </div>
            )}
          </div>
        </Chrome>
      </AbsoluteFill>

      {!created && <Cursor x={cx} y={cy} press={Math.max(press1, press2)} />}
    </Scene>
  );
};

// ═══════════════ 3 · SURAH GRID ═══════════════

const SurahCard: React.FC<{ s: typeof SURAHS[number]; p: number; hot?: boolean }> = ({ s, p, hot }) => (
  <div style={{
    background: C.bgElev, border: `1px solid ${hot ? C.accent : C.line}`,
    borderRadius: 12, padding: "14px 16px", opacity: p,
    transform: `translateY(${(1 - p) * 22}px)`,
    boxShadow: hot ? `0 0 0 3px ${C.accentSoft}` : "none",
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <span style={{ fontFamily: FONTS.mono, fontSize: 14, color: C.ink4 }}>{s[0]}</span>
      <span style={{ fontFamily: FONTS.arabic, fontSize: 26, color: C.ink }}>{s[1]}</span>
    </div>
    <div style={{ fontFamily: FONTS.serif, fontSize: 21, fontWeight: 600, marginTop: 8 }}>{s[2]}</div>
    <div style={{ fontSize: 15, color: C.ink3, marginTop: 2 }}>{s[3]}</div>
    <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: C.ink4, marginTop: 8, letterSpacing: "0.03em" }}>
      {s[5]} · {s[4]} āyāt
    </div>
  </div>
);

export const SSurahGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [30, LEN.surahGrid], [0, -70], CL);
  return (
    <Scene dur={LEN.surahGrid}>
      <div style={{ position: "absolute", left: 110, top: 70, zIndex: 5 }}>
        <Eyebrow>The board</Eyebrow>
        <Headline>All 114 sūrahs, one workspace.</Headline>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 250 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(6, 250px)", gap: 16,
          transform: `translateY(${drift}px)`,
        }}>
          {SURAHS.map((s, i) => {
            const p = spring({ frame: frame - (18 + i * 3.5), fps: SHOW_FPS, config: { damping: 15 } });
            const hot = (i === 1 || i === 17) && frame > 90; // Al-Baqara & Al-Kahf glow
            return <SurahCard key={s[0]} s={s} p={p} hot={hot} />;
          })}
        </div>
      </AbsoluteFill>
      <div style={{
        position: "absolute", bottom: 70, left: 0, right: 0, textAlign: "center",
        fontFamily: FONTS.mono, fontSize: 20, letterSpacing: "0.08em", color: C.ink3,
        opacity: interpolate(frame, [110, 140], [0, 1], CL),
      }}>
        pick a sūrah · track progress · open the Mushaf
      </div>
    </Scene>
  );
};

// ═══════════════ 4 · JOIN A GROUP ═══════════════

const SJoinGroup: React.FC = () => {
  const frame = useCurrentFrame();
  const code = "892E9534BD";
  const modalIn = useSpr(14, 15);
  const typeStart = 44;
  const codeDone = isTyped(code, frame, typeStart, 0.34);
  const press = interpolate(frame, [150, 156, 162], [0, 1, 0], CL);
  const joined = frame >= 172;
  const joinPop = useSpr(176, 13);
  const cx = interpolate(frame, [0, 40, 150, 165], [1300, 960, 960, 1050], CL);
  const cy = interpolate(frame, [0, 40, 150, 165], [700, 500, 560, 590], CL);

  return (
    <Scene dur={LEN.joinGroup}>
      <div style={{ position: "absolute", left: 110, top: 84 }}>
        <Eyebrow>Step 3 · Invite the circle</Eyebrow>
        <Headline>Share a code. They&apos;re in.</Headline>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
        <Chrome tab="tafsirlab.app · join" w={1120} h={600}>
          <div style={{ position: "relative", height: 540, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!joined ? (
              <div style={{ width: 560, transform: `translateY(${(1 - modalIn) * 18}px)`, opacity: modalIn }}>
                <div style={{ fontFamily: FONTS.serif, fontSize: 34, fontWeight: 600 }}>Join a workspace</div>
                <div style={{ fontSize: 19, color: C.ink3, marginTop: 8 }}>Enter the code shared by a workspace admin.</div>
                <div style={{
                  marginTop: 24, border: `1.5px solid ${C.accent}`, borderRadius: 10, padding: "16px 20px",
                  fontFamily: FONTS.mono, fontSize: 30, letterSpacing: "0.12em", color: C.ink, minHeight: 34,
                }}>
                  {typed(code, frame, typeStart, 0.34)}{!codeDone && <Caret h={30} />}
                </div>
                <div style={{ marginTop: 22 }}>
                  <span style={{ background: C.accent, color: "#fff", fontSize: 21, fontWeight: 600, padding: "14px 30px", borderRadius: 10, transform: `scale(${1 - press * 0.06})`, display: "inline-block" }}>
                    Join workspace
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", opacity: joinPop, transform: `scale(${0.94 + joinPop * 0.06})` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 20 }}>
                  <Avatar label="ST" grad={[C.accent, C.accentInk]} size={64} />
                </div>
                <div style={{ fontFamily: FONTS.serif, fontSize: 44, fontWeight: 600 }}>Study Group</div>
                <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 10, fontSize: 20, color: C.accentInk }}>
                  <Pip color={C.warm} size={26} /><Pip color={C.accent} size={26} /><Pip color={C.violet} size={26} />
                  <span style={{ marginLeft: 6 }}>You joined — 4 members now studying</span>
                </div>
              </div>
            )}
          </div>
        </Chrome>
      </AbsoluteFill>
      {!joined && <Cursor x={cx} y={cy} press={press} />}
    </Scene>
  );
};

// ═══════════════ 5 · ROLES & PROMOTE ═══════════════

const PERMS: [string, boolean, boolean][] = [
  ["Create, rename & delete pages", true, false],
  ["Start new surah boards", true, false],
  ["Invite & manage members", true, false],
  ["Write page content & notes", true, true],
  ["Draw & add text boxes", true, true],
  ["Track reading progress", true, true],
];

export const SPermissions: React.FC = () => {
  const frame = useCurrentFrame();
  const modalIn = useSpr(10, 15);
  const promoted = frame >= 168;
  const badgeSwap = interpolate(frame, [160, 172], [0, 1], CL);
  const press = interpolate(frame, [150, 157, 164], [0, 1, 0], CL);
  const cx = interpolate(frame, [0, 60, 150, 162], [1500, 1160, 1150, 1230], CL);
  const cy = interpolate(frame, [0, 60, 150, 162], [300, 760, 770, 790], CL);

  return (
    <Scene dur={LEN.permissions}>
      <div style={{ position: "absolute", left: 110, top: 70, zIndex: 5 }}>
        <Eyebrow>Roles &amp; permissions</Eyebrow>
        <Headline>You decide who does what.</Headline>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 90 }}>
        <div style={{
          width: 780, background: C.bgElev, border: `1px solid ${C.line2}`, borderRadius: 18,
          boxShadow: "0 34px 80px rgba(34,31,26,0.2)", padding: "30px 38px",
          transform: `translateY(${(1 - modalIn) * 20}px)`, opacity: modalIn,
        }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 15, letterSpacing: "0.08em", color: C.ink3, textTransform: "uppercase" }}>Permissions</div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", fontFamily: FONTS.mono, fontSize: 14, color: C.ink4, textTransform: "uppercase", letterSpacing: "0.05em", paddingBottom: 8, borderBottom: `1px solid ${C.line}` }}>
              <span>Capability</span><span style={{ textAlign: "center" }}>Admin</span><span style={{ textAlign: "center" }}>Member</span>
            </div>
            {PERMS.map((row, i) => {
              const rp = interpolate(frame, [24 + i * 5, 34 + i * 5], [0, 1], CL);
              return (
                <div key={row[0]} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${C.line}`, fontSize: 18, opacity: rp }}>
                  <span>{row[0]}</span>
                  <span style={{ textAlign: "center", color: C.accentInk, fontWeight: 700 }}>{row[1] ? "✓" : "—"}</span>
                  <span style={{ textAlign: "center", color: row[2] ? C.accentInk : C.ink4, fontWeight: 700 }}>{row[2] ? "✓" : "—"}</span>
                </div>
              );
            })}
          </div>

          <div style={{ fontFamily: FONTS.mono, fontSize: 15, letterSpacing: "0.08em", color: C.ink3, textTransform: "uppercase", marginTop: 26 }}>Members (2)</div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar label="M" grad={[C.accent, C.accentInk]} />
            <span style={{ fontSize: 20, fontWeight: 600, flex: 1 }}>Musa Surty (you)</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 14, color: C.accentInk, background: C.accentSoft, padding: "5px 14px", borderRadius: 8 }}>OWNER</span>
          </div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar label="S" grad={[C.warm, "#9C6A20"]} />
            <span style={{ fontSize: 20, fontWeight: 600, flex: 1 }}>Steven Jobless</span>
            {/* role badge swaps Member → Admin */}
            <span style={{ position: "relative", width: 96, height: 34 }}>
              <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mono, fontSize: 14, color: C.ink3, background: C.panel, borderRadius: 8, opacity: 1 - badgeSwap }}>MEMBER</span>
              <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mono, fontSize: 14, color: "#fff", background: C.accent, borderRadius: 8, opacity: badgeSwap, transform: `scale(${0.8 + badgeSwap * 0.2})` }}>ADMIN</span>
            </span>
            {!promoted && (
              <span style={{ fontFamily: FONTS.sans, fontSize: 16, fontWeight: 600, color: C.accentInk, border: `1.5px solid ${C.accent}`, padding: "7px 16px", borderRadius: 8, transform: `scale(${1 - press * 0.08})`, display: "inline-block" }}>
                Promote
              </span>
            )}
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: 66, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontSize: 20, letterSpacing: "0.08em", color: C.ink3, opacity: interpolate(frame, [176, 196], [0, 1], CL) }}>
        promoted Steven to admin
      </div>
      <Cursor x={cx} y={cy} press={press} />
    </Scene>
  );
};

// ═══════════════ 6 · LIVE SYNC (side by side) ═══════════════

const DeviceLabel: React.FC<{ children: React.ReactNode; color: string }> = ({ children, color }) => (
  <div style={{ fontFamily: FONTS.mono, fontSize: 20, fontWeight: 600, letterSpacing: "0.08em", color: "#fff", background: color, padding: "6px 16px", borderRadius: 8, display: "inline-block" }}>
    {children}
  </div>
);

const MiniDoc: React.FC<{ text: string; showCaret: boolean; tablet?: boolean }> = ({ text, showCaret, tablet }) => (
  <div style={{ width: "100%", height: "100%", background: C.bgElev, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, background: C.panel }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: C.ink, color: C.bg, fontSize: 12, fontFamily: FONTS.serif, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>T</span>
      <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: C.ink3 }}>Study Group / Overview</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONTS.mono, fontSize: 12, color: C.accentInk }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: C.accent }} />Live
      </span>
    </div>
    <div style={{ padding: tablet ? "26px 30px" : "30px 34px" }}>
      <div style={{ fontFamily: FONTS.serif, fontSize: tablet ? 30 : 32, fontWeight: 600 }}>Overview</div>
      <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: C.ink4, marginTop: 6 }}>Musa Surty · today · Draft</div>
      <div style={{ marginTop: 22, border: `1px solid ${C.line}`, borderRadius: 8, padding: "16px 18px", minHeight: 120, fontFamily: FONTS.serif, fontSize: tablet ? 21 : 22, lineHeight: 1.6, color: C.ink }}>
        {text}{showCaret && <Caret h={22} />}
      </div>
    </div>
  </div>
);

export const SSync: React.FC = () => {
  const frame = useCurrentFrame();
  const full = "The program has a live sync for text and annotation.";
  // laptop types; tablet mirrors ~10 frames behind
  const lapText = typed(full, frame, 26, 0.7);
  const tabText = typed(full, frame, 36, 0.7);
  const lapTyping = !isTyped(full, frame, 26, 0.7);
  const tabTyping = !isTyped(full, frame, 36, 0.7);
  const pulse = (Math.sin(frame / 8) + 1) / 2;

  return (
    <Scene dur={LEN.sync} bg={C.dark}>
      <AbsoluteFill style={{ background: "radial-gradient(900px 600px at 50% 40%, rgba(62,142,110,0.14), transparent 65%)" }} />
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Eyebrow light>Live sync · text mode</Eyebrow>
        </div>
      </div>

      {/* device labels */}
      <div style={{ position: "absolute", top: 150, left: 480, transform: "translateX(-50%)" }}><DeviceLabel color={C.accent}>LAPTOP</DeviceLabel></div>
      <div style={{ position: "absolute", top: 150, left: 1440, transform: "translateX(-50%)" }}><DeviceLabel color={C.warm}>TABLET</DeviceLabel></div>

      {/* panels */}
      <div style={{ position: "absolute", left: 60, top: 210, width: 840, height: 560 }}>
        <MiniDoc text={lapText} showCaret={lapTyping} />
      </div>
      <div style={{ position: "absolute", left: 1020, top: 210, width: 840, height: 560 }}>
        <MiniDoc text={tabText} showCaret={tabTyping} tablet />
      </div>

      {/* sync link */}
      <div style={{ position: "absolute", left: 900, top: 470, width: 120, height: 4, background: `rgba(62,142,110,${0.35 + pulse * 0.5})`, boxShadow: `0 0 ${10 + pulse * 20}px rgba(62,142,110,0.8)` }} />
      <div style={{ position: "absolute", left: 960, top: 430, transform: "translateX(-50%)", fontFamily: FONTS.mono, fontSize: 15, color: "rgba(246,244,238,0.7)", letterSpacing: "0.1em" }}>SYNC</div>

      <div style={{ position: "absolute", bottom: 90, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.serif, fontSize: 44, color: "#F6F4EE" }}>
        One document. Every device. In real time.
      </div>
    </Scene>
  );
};

// ═══════════════ 7 · RICH NOTES ═══════════════

const SNotes: React.FC = () => {
  const frame = useCurrentFrame();
  const para = "Al-ḥamd here is definite and total — praise for what He is, not merely thanks for what is given.";
  const paraDone = isTyped(para, frame, 34, 0.95);
  const slashAt = 150;
  const slashOn = frame >= slashAt && frame < 196;
  const slashPop = useSpr(slashAt, 15);
  const blockAt = 200;
  const blockPop = useSpr(blockAt, 13, 0.9);
  const drawerAt = 236;
  const drawerIn = interpolate(frame, [drawerAt, drawerAt + 22], [0, 1], CL);

  return (
    <Scene dur={LEN.notes}>
      <div style={{ position: "absolute", left: 110, top: 70, zIndex: 5 }}>
        <Eyebrow>Step 6 · Write</Eyebrow>
        <Headline>Notes, ʾāyah blocks & tafsīr.</Headline>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
        <Chrome tab="Study Group · Al-Fātiḥa · Overview" w={1440} h={620}>
          <div style={{ position: "relative", height: 560, padding: "40px 60px", display: "flex" }}>
            <div style={{ flex: 1, paddingRight: drawerIn > 0 ? 30 : 0 }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 15, color: C.ink3, letterSpacing: "0.06em" }}>SURAH AL-FĀTIḤA · 1:2</div>
              <div style={{ fontFamily: FONTS.serif, fontSize: 30, fontWeight: 600, margin: "10px 0 24px" }}>On praise as the opening posture</div>
              <div style={{ fontFamily: FONTS.serif, fontSize: 23, lineHeight: 1.65, color: C.ink }}>
                {typed(para, frame, 34, 0.95)}
                {!paraDone && <Caret />}
                {paraDone && frame < blockAt && (
                  <> <span style={{ color: C.accentInk, fontFamily: FONTS.mono, fontSize: 20 }}>{typed("/ayah 1:2", frame, slashAt - 12, 0.6)}</span><Caret /></>
                )}
              </div>

              {slashOn && (
                <div style={{ position: "absolute", left: 300, top: 300, width: 400, background: C.bgElev, border: `1px solid ${C.line2}`, borderRadius: 12, boxShadow: "0 20px 44px rgba(34,31,26,0.18)", padding: 8, opacity: slashPop, transform: `translateY(${(1 - slashPop) * 12}px)`, zIndex: 10 }}>
                  {[["📖", "Ayah block", "Embed a verse"], ["📚", "Tafsir block", "67 sources"], ["✦", "Callout", "Highlighted note"]].map((it, i) => (
                    <div key={it[1]} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 12px", borderRadius: 8, background: i === 0 ? C.accentSoft : "transparent" }}>
                      <span style={{ fontSize: 22, width: 32, textAlign: "center" }}>{it[0]}</span>
                      <span><div style={{ fontSize: 19, fontWeight: 600 }}>{it[1]}</div><div style={{ fontSize: 15, color: C.ink3 }}>{it[2]}</div></span>
                    </div>
                  ))}
                </div>
              )}

              {frame >= blockAt && (
                <div style={{ marginTop: 26, border: `1px solid ${C.line2}`, borderInlineStart: `4px solid ${C.accent}`, borderRadius: 10, background: C.panel, padding: "22px 30px", opacity: blockPop, transform: `translateY(${(1 - blockPop) * 22}px)` }}>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 14, color: C.accentInk, letterSpacing: "0.06em" }}>● AL-FĀTIḤA · 1:2</div>
                  <div style={{ fontFamily: FONTS.arabic, fontSize: 44, direction: "rtl", textAlign: "right", margin: "14px 0 10px", lineHeight: 1.8 }}>ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ</div>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 20, color: C.ink2 }}>All praise is due to Allah, Lord of all the worlds.</div>
                </div>
              )}
            </div>

            {/* tafsir drawer */}
            {frame >= drawerAt && (
              <div style={{ width: 420, borderLeft: `1px solid ${C.line}`, paddingLeft: 26, transform: `translateX(${(1 - drawerIn) * 60}px)`, opacity: drawerIn }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 14, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tafsīr · Ibn Kathīr</div>
                <div style={{ marginTop: 14, fontFamily: FONTS.serif, fontSize: 18, lineHeight: 1.7, color: C.ink2 }}>
                  All praise belongs to Allah alone — the One perfect in His attributes and acts, deserving of praise before and after any servant offers it…
                </div>
                <div style={{ marginTop: 18, fontFamily: FONTS.arabic, fontSize: 22, direction: "rtl", textAlign: "right", lineHeight: 1.9, color: C.ink3 }}>
                  الحمد لله الذي له الكمال المطلق في ذاته وصفاته وأفعاله
                </div>
              </div>
            )}
          </div>
        </Chrome>
      </AbsoluteFill>
    </Scene>
  );
};

// ═══════════════ 8 · ANNOTATE (sync) ═══════════════

const MiniMushaf: React.FC<{ drawP: number; hlP: number; washP: number; tablet?: boolean }> = ({ drawP, hlP, washP }) => {
  const lines = [
    "قَالُوا۟ سُبْحَـٰنَكَ لَا عِلْمَ لَنَآ إِلَّا مَا عَلَّمْتَنَآ ۝",
    "قَالَ يَـٰٓـَٔادَمُ أَنۢبِئْهُم بِأَسْمَآئِهِمْ ۝",
    "وَإِذْ قُلْنَا لِلْمَلَـٰٓئِكَةِ ٱسْجُدُوا۟ لِـَٔادَمَ ۝",
    "وَقُلْنَا يَـٰٓـَٔادَمُ ٱسْكُنْ أَنتَ وَزَوْجُكَ ٱلْجَنَّةَ ۝",
    "فَأَزَلَّهُمَا ٱلشَّيْطَـٰنُ عَنْهَا فَأَخْرَجَهُمَا ۝",
  ];
  return (
    <div style={{ width: "100%", height: "100%", background: C.paper, borderRadius: 12, padding: "30px 40px", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
      <div style={{ textAlign: "center", fontFamily: FONTS.arabic, fontSize: 24, border: "1px double rgba(150,110,45,0.5)", borderRadius: 6, padding: "8px 0 10px", marginBottom: 20, color: "#6E5320" }}>سُورَةُ ٱلْبَقَرَةِ</div>
      {lines.map((ln, i) => (
        <div key={i} style={{
          position: "relative", fontFamily: FONTS.arabic, fontSize: 25, lineHeight: 2.1, direction: "rtl", textAlign: "center",
          color: i === 2 ? C.accentInk : "#26221C",
          background: i === 0 ? `rgba(112,146,224,${0.4 * washP})` : "transparent", borderRadius: 6,
        }}>
          {i === 3 ? (
            <span style={{ backgroundImage: "linear-gradient(100deg, rgba(244,208,80,0.55), rgba(244,208,80,0.42))", backgroundRepeat: "no-repeat", backgroundSize: `${hlP * 100}% 76%`, backgroundPosition: "right center", borderRadius: 8 }}>{ln}</span>
          ) : ln}
          {i === 2 && (
            <svg style={{ position: "absolute", bottom: 2, left: "5%", width: "90%", height: 14 }} viewBox="0 0 200 12" preserveAspectRatio="none">
              <path d="M3 7 C 30 3, 62 10, 96 6 C 128 3, 162 9, 197 6" fill="none" stroke={C.accent} strokeWidth={2.4} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 - drawP * 100} />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
};

const SAnnotate: React.FC = () => {
  const frame = useCurrentFrame();
  const drawL = interpolate(frame, [30, 78], [0, 1], CL);
  const drawR = interpolate(frame, [46, 94], [0, 1], CL);
  const hl = interpolate(frame, [120, 156], [0, 1], CL);
  const wash = interpolate(frame, [190, 220], [0, 1], CL);
  const pulse = (Math.sin(frame / 8) + 1) / 2;
  return (
    <Scene dur={LEN.annotate} bg={C.dark}>
      <AbsoluteFill style={{ background: "radial-gradient(900px 600px at 50% 45%, rgba(62,142,110,0.13), transparent 65%)" }} />
      <div style={{ position: "absolute", top: 66, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ display: "inline-block" }}><Eyebrow light>Step 7 · Ink the Mushaf</Eyebrow></div>
      </div>
      <div style={{ position: "absolute", top: 140, left: 480, transform: "translateX(-50%)" }}><DeviceLabel color={C.accent}>LAPTOP</DeviceLabel></div>
      <div style={{ position: "absolute", top: 140, left: 1440, transform: "translateX(-50%)" }}><DeviceLabel color={C.warm}>TABLET</DeviceLabel></div>
      <div style={{ position: "absolute", left: 90, top: 200, width: 780, height: 590 }}><MiniMushaf drawP={drawL} hlP={hl} washP={wash} /></div>
      <div style={{ position: "absolute", left: 1050, top: 200, width: 780, height: 590 }}><MiniMushaf drawP={drawR} hlP={hl} washP={wash} tablet /></div>
      <div style={{ position: "absolute", left: 900, top: 480, width: 120, height: 4, background: `rgba(62,142,110,${0.35 + pulse * 0.5})`, boxShadow: `0 0 ${10 + pulse * 20}px rgba(62,142,110,0.8)` }} />
      <div style={{ position: "absolute", bottom: 84, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.serif, fontSize: 42, color: "#F6F4EE" }}>
        Pen, highlighter, ʾāyah wash — synced to every reader.
      </div>
    </Scene>
  );
};

// ═══════════════ 9 · CHANNELS ═══════════════

export const SChannels: React.FC = () => {
  const frame = useCurrentFrame();
  const appearAt = 70;
  const chanPop = useSpr(appearAt, 14);
  const press = interpolate(frame, [44, 51, 58], [0, 1, 0], CL);
  const cx = interpolate(frame, [0, 40, 44], [900, 300, 300], CL);
  const cy = interpolate(frame, [0, 40, 44], [700, 400, 400], CL);
  const existing = ["Overview", "Tafsīr notes", "Word study"];

  return (
    <Scene dur={LEN.channels}>
      <div style={{ position: "absolute", left: 110, top: 70, zIndex: 5 }}>
        <Eyebrow>Channels</Eyebrow>
        <Headline>A channel for every topic.</Headline>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
        <Chrome tab="Study Group · Al-Baqara" w={1360} h={600}>
          <div style={{ display: "flex", height: 540 }}>
            {/* sidebar */}
            <div style={{ width: 340, borderRight: `1px solid ${C.line}`, background: C.panel, padding: "24px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <Avatar label="ST" grad={[C.accent, C.accentInk]} size={34} />
                <span style={{ fontFamily: FONTS.serif, fontSize: 20, fontWeight: 600 }}>Study Group</span>
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: C.ink4, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Al-Baqara</span>
                <span style={{ fontSize: 20, color: C.ink3, transform: `scale(${1 - press * 0.2})` }}>＋</span>
              </div>
              {existing.map((c) => (
                <div key={c} style={{ padding: "10px 12px", borderRadius: 8, fontSize: 18, color: C.ink2 }}>{c}</div>
              ))}
              {frame >= appearAt && (
                <div style={{ padding: "10px 12px", borderRadius: 8, fontSize: 18, fontWeight: 600, color: C.ink, background: C.accentSoft, opacity: chanPop, transform: `translateX(${(1 - chanPop) * -14}px)` }}>
                  # example channel
                </div>
              )}
            </div>
            {/* content */}
            <div style={{ flex: 1, padding: "40px 50px" }}>
              {frame >= appearAt ? (
                <div style={{ opacity: chanPop }}>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 38, fontWeight: 600 }}>example channel</div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 14, color: C.ink4, marginTop: 8 }}>new · just now</div>
                  <div style={{ marginTop: 26, border: `1px solid ${C.line}`, borderRadius: 8, padding: "16px 18px", color: C.ink4, fontSize: 18 }}>
                    Type “/” for commands, or start writing…
                  </div>
                </div>
              ) : (
                <div style={{ color: C.ink4, fontSize: 20, marginTop: 20 }}>Add a channel to organise your study →</div>
              )}
            </div>
          </div>
        </Chrome>
      </AbsoluteFill>
      {frame < appearAt && <Cursor x={cx} y={cy} press={press} />}
    </Scene>
  );
};

// ═══════════════ 10 · END ═══════════════

export const SEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = useSpr(16, 14);
  const btn = useSpr(52, 13);
  return (
    <Scene dur={LEN.end}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: FONTS.arabic, fontSize: 38, color: C.ink3, marginBottom: 38, direction: "rtl", opacity: interpolate(frame, [2, 24], [0, 1], CL) }}>
          ٱقْرَأْ وَرَبُّكَ ٱلْأَكْرَمُ
        </div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 96, fontWeight: 500, textAlign: "center", lineHeight: 1.08, opacity: pop, transform: `scale(${0.94 + pop * 0.06})` }}>
          Open the lab.<br />
          <span style={{ fontStyle: "italic", fontWeight: 400, color: C.accentInk }}>Begin the work.</span>
        </div>
        <div style={{ marginTop: 54, background: C.ink, color: C.bg, fontFamily: FONTS.sans, fontSize: 28, fontWeight: 600, padding: "20px 46px", borderRadius: 16, boxShadow: "0 26px 60px rgba(34,31,26,0.28)", opacity: btn, transform: `translateY(${(1 - btn) * 22}px)` }}>
          Start your study group — free forever →
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ═══════════════ COMPOSITION ═══════════════

export const Showcase: React.FC = () => {
  let at = 0;
  const seq = (len: number) => { const from = at; at += len; return { from, durationInFrames: len }; };
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence {...seq(LEN.title)}><STitle /></Sequence>
      <Sequence {...seq(LEN.makeGroup)}><SMakeGroup /></Sequence>
      <Sequence {...seq(LEN.surahGrid)}><SSurahGrid /></Sequence>
      <Sequence {...seq(LEN.joinGroup)}><SJoinGroup /></Sequence>
      <Sequence {...seq(LEN.permissions)}><SPermissions /></Sequence>
      <Sequence {...seq(LEN.sync)}><SSync /></Sequence>
      <Sequence {...seq(LEN.notes)}><SNotes /></Sequence>
      <Sequence {...seq(LEN.annotate)}><SAnnotate /></Sequence>
      <Sequence {...seq(LEN.channels)}><SChannels /></Sequence>
      <Sequence {...seq(LEN.end)}><SEnd /></Sequence>
    </AbsoluteFill>
  );
};
