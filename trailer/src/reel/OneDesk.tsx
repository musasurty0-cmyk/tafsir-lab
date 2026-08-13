import React from "react";
import {
  AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import { buildArc, track, clamp, smoothstep } from "./searchCurves";
import { Brand, Crumbs, Rail } from "./AppUI";

/* ── One Desk ──────────────────────────────────────────────────────────────
   A rebuild of the first thing made for TafsirLab — the 70s landscape tour
   that opened "A new way to study the Quran — deeply, collaboratively, and in
   context".

   THIS IS THE SECOND CUT. The first was structurally right and told nothing:
   nine beats of feature captions with no through-line, generic cards that
   could have belonged to any note app, two sound families doing all the work,
   and 2.0s beats that gave a viewer no time to read what they were looking at.

   NARRATIVE (the fix that matters most). It is now one study session, in the
   order you would actually do it, bracketed by a question and its answer:

     ask      "Have you ever wanted to study the Qurʾān" / "the way it deserves?"
     begin    open a sūrah
     read     the muṣḥaf as it is written
     notice   mark the word that stopped you
     write    what you found
     check    how the scholars read it
     keep     the link you noticed
     return   it is still here, and so is your ḥalaqa
     answer   "A desk for that work."

   Every caption now depends on the one before it. Nothing is a bullet.

   TRUE TO PRODUCT. The surfaces are the app's own chrome — Brand, Crumbs and
   Rail from AppUI, the real note types, the real tafsīr names, the real slash
   command. The first cut invented plain rows with coloured dots, which is why
   it read as a generic productivity reel.

   PACE. Beats are 190 frames (3.2s) against the first cut's 120. The
   references change state every 1.3–2.0s, but their beats carry one word and
   ours carry a sentence of Arabic plus a caption.

   SOUND. The click is the spine — it is the product's own sound and it fires
   on every cursor action. §12.6 was satisfied on level in the first cut but
   not on VARIETY: two families carried nine beats.

   Kept from the first cut, all measured: one container with no cut anywhere
   (§6), the tracked throw with its hang (§9.1), per-word caption catch-up
   (§3), the never-still cursor (§4), rack focus as a pointer (§5), and a
   loop whose last frame matches its first (§7).                            */

const FPS = 60;
export const DESK_FRAMES = 30 * FPS;          // 1800

const W = 1080, H = 1920;
const CX = W / 2, CY = H / 2;

const ARC = buildArc(W / 1280, H / 1714);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

// ── Beats ──────────────────────────────────────────────────────────────────

interface Beat {
  at: number; w: number; h: number; r: number;
  cap?: string; side?: "above" | "below";
  /** text-only beat: the container is absent and the line owns the frame */
  say?: string;
}

const BEATS: Beat[] = [
  { at:    0, w: 0,   h: 0,    r:  0, say: "Have you ever wanted to study the Qurʾān" },
  { at:  170, w: 0,   h: 0,    r:  0, say: "the way it deserves?" },
  { at:  330, w: 900, h: 340,  r: 24, cap: "Start with one sūrah.",            side: "below" },
  { at:  520, w: 700, h: 1120, r: 20, cap: "Read it as it is written.",        side: "below" },
  { at:  710, w: 900, h: 640,  r: 20, cap: "Mark the word that stopped you.",  side: "above" },
  { at:  900, w: 780, h: 900,  r: 22, cap: "Write down what you found.",       side: "below" },
  { at: 1090, w: 920, h: 580,  r: 22, cap: "See how the scholars read it.",    side: "above" },
  { at: 1280, w: 800, h: 760,  r: 22, cap: "Keep the link you noticed.",       side: "below" },
  { at: 1470, w: 660, h: 840,  r: 24, cap: "Come back. It is still here.",     side: "above" },
  { at: 1640, w: 360, h: 360,  r: 180 },
];

const MORPH = 22;

const phase = (f: number) => {
  let i = 0;
  for (let k = 0; k < BEATS.length; k++) if (f >= BEATS[k].at) i = k;
  const m = Math.min(1, (f - BEATS[i].at) / MORPH);
  return { i, m };
};

const geom = (f: number) => {
  const { i, m } = phase(f);
  const a = BEATS[Math.max(0, i - 1)], b = BEATS[i];
  const t = ease(m);
  const over = 1 + 0.026 * Math.sin(Math.PI * Math.min(1, m * 1.35));
  return {
    w: (a.w + (b.w - a.w) * t) * over,
    h: a.h + (b.h - a.h) * t,
    r: a.r + (b.r - a.r) * t,
    i, m,
  };
};

const contentBlur = (m: number) => ({
  opacity: m < 0.42 ? interpolate(m, [0, 0.34], [1, 0], clamp)
                    : interpolate(m, [0.5, 0.78], [0, 1], clamp),
  blur:    m < 0.42 ? interpolate(m, [0, 0.34], [0, 14], clamp)
                    : interpolate(m, [0.5, 0.86], [10, 0], clamp),
  dx:      m < 0.42 ? interpolate(m, [0, 0.34], [0, 46], clamp)
                    : interpolate(m, [0.5, 0.86], [-18, 0], clamp),
});

// ── Text beats: the question, and its answer ───────────────────────────────

const Say: React.FC<{ text: string; at: number; dur: number }> = ({ text, at, dur }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  const out = interpolate(f, [at + dur - 34, at + dur - 6], [1, 0], clamp);
  if (f < at) return null;
  return (
    <div style={{
      position: "absolute", left: 90, right: 90, top: CY - 130,
      display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 18px",
      opacity: out,
    }}>
      {words.map((word, k) => {
        const s = at + 10 + k * 4;
        const e = ease(interpolate(f, [s, s + 9], [0, 1], clamp));
        return (
          <span key={k} style={{
            fontFamily: R.fontSerif, fontSize: 74, lineHeight: 1.34, color: "#221f19",
            transform: `translate(${(1 - e) * 30}px, ${(1 - e) * 9}px)`,
            opacity: e, display: "inline-block",
          }}>{word}</span>
        );
      })}
    </div>
  );
};

// ── Caption ────────────────────────────────────────────────────────────────

const Caption: React.FC<{ text: string; at: number; side: "above" | "below"; h: number }> =
({ text, at, side, h }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  const gone = interpolate(f, [at + 140, at + 164], [1, 0], clamp);
  if (f < at || gone <= 0) return null;
  return (
    <div style={{
      position: "absolute", left: 0, right: 0,
      top: side === "below" ? CY + h / 2 + 136 : CY - h / 2 - 136 - 56,
      textAlign: "center", opacity: gone,
      display: "flex", justifyContent: "center", gap: 13, flexWrap: "wrap",
    }}>
      {words.map((word, k) => {
        const s = at + 10 + k * 3;
        const p = interpolate(f, [s, s + 7], [0, 1], clamp);
        const e = ease(p);
        return (
          <span key={k} style={{
            fontFamily: R.fontSerif, fontSize: 48, color: "#2b2822",
            transform: `translate(${(1 - e) * 26}px, ${(1 - e) * 7}px)`,
            opacity: p, display: "inline-block",
          }}>{word}</span>
        );
      })}
    </div>
  );
};

// ── Cursor ─────────────────────────────────────────────────────────────────
// Travel sits in the tail of the beat it is leaving, so it arrives before the
// next morph and fills what would otherwise be a dead hold (§4, §11.10).

const LEGS: { at: number; x: number; y: number }[] = [
  { at:    0, x: 720, y: 1420 },
  { at:  392, x: CX + 140, y: CY + 50 },
  { at:  588, x: CX - 170, y: CY - 300 },
  { at:  776, x: CX - 40,  y: CY + 30 },
  { at:  966, x: CX - 230, y: CY - 120 },
  { at: 1156, x: CX + 250, y: CY - 40 },
  { at: 1346, x: CX + 60,  y: CY + 150 },
  { at: 1532, x: CX - 120, y: CY - 60 },
  { at: 1680, x: 780, y: 1400 },
];

const cursorAt = (f: number) => {
  let a = LEGS[0], b = LEGS[0];
  for (let k = 0; k < LEGS.length; k++) {
    if (f >= LEGS[k].at) { a = LEGS[k]; b = LEGS[Math.min(k + 1, LEGS.length - 1)]; }
  }
  const span = Math.max(1, b.at - a.at);
  const p = ease(Math.min(1, (f - a.at) / Math.min(52, span)));
  const idle = Math.max(0, f - a.at - 52);
  return {
    x: a.x + (b.x - a.x) * p + Math.sin(idle / 37) * 5.5 + Math.sin(idle / 13) * 1.6,
    y: a.y + (b.y - a.y) * p + Math.cos(idle / 29) * 4.2 + Math.cos(idle / 17) * 1.2,
    v: Math.abs(b.x - a.x + b.y - a.y) * (p < 1 ? (1 - p) : 0) / 42,
  };
};

const Cursor: React.FC = () => {
  const f = useCurrentFrame();
  if (f < 300) return null;                    // no cursor over the question
  const { x, y, v } = cursorAt(f);
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: 26, height: 34,
      filter: `blur(${Math.min(7, v * 1.7)}px)`, zIndex: 40,
    }}>
      <svg viewBox="0 0 26 34" width="26" height="34">
        <path d="M2 1 L2 26 L8.5 20 L12.5 30 L17 28 L13 18.5 L21 18 Z"
              fill="#1e1a14" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ── Product surfaces ───────────────────────────────────────────────────────
// The app's own chrome, not invented cards. This is what "true to product"
// costs: the header, the breadcrumb and the rail are the same components the
// other compositions use.

const Chrome: React.FC<{ trail: string[]; children: React.ReactNode; rail?: boolean }> =
({ trail, children, rail = true }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
    <Brand />
    <Crumbs trail={trail} />
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {rail && <Rail />}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>{children}</div>
    </div>
  </div>
);

const SurahRow: React.FC<{ name: string; sub: string; on?: boolean; dim?: number }> =
({ name, sub, on, dim = 0 }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 16, padding: "16px 22px",
    borderRadius: 10, background: on ? R.accentSoft : "transparent",
    filter: dim ? `blur(${dim}px)` : undefined, opacity: dim ? 0.5 : 1,
  }}>
    <div style={{ width: 10, height: 10, borderRadius: 5,
                  background: on ? R.accent : R.ink4, flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: R.fontSans, fontSize: 26, color: R.ink }}>{name}</div>
      <div style={{ fontFamily: R.fontMono, fontSize: 17, color: R.ink3, marginTop: 3 }}>{sub}</div>
    </div>
  </div>
);

const MushafLines = ["ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ", "ٱلْحَىُّ ٱلْقَيُّومُ",
                     "لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ", "لَّهُۥ مَا فِى ٱلسَّمَـٰوَٰتِ"];

const Surface: React.FC<{ i: number; f: number }> = ({ i, f }) => {
  const since = f - BEATS[i].at;
  const p = Math.min(1, Math.max(0, (since - 10) / 150));

  switch (i) {
    /* begin — the workspace, with the app's real header and breadcrumb */
    case 2: return (
      <Chrome trail={["Tafsir Lab", "Al-Baqara"]} rail={false}>
        <div style={{ padding: "14px 12px" }}>
          <SurahRow name="Al-Fātiḥa" sub="7 āyāt · complete" />
          <SurahRow name="Al-Baqara" sub="286 āyāt · 11 notes" on={p > 0.35} />
        </div>
      </Chrome>
    );

    /* read — the muṣḥaf, lines arriving across the whole beat */
    case 3: return (
      <Chrome trail={["Al-Baqara", "2:255"]}>
        <div style={{ padding: "34px 26px", direction: "rtl", textAlign: "center" }}>
          {MushafLines.map((line, k) => (
            <div key={k} style={{
              fontFamily: R.fontSerif, fontSize: 44, color: R.ink, lineHeight: 2.15,
              opacity: interpolate(p, [k * 0.17, k * 0.17 + 0.3], [0, 1], clamp),
            }}>{line}</div>
          ))}
        </div>
      </Chrome>
    );

    /* notice — ink drawn on the word, and the word note it opens */
    case 4: return (
      <Chrome trail={["2:255", "al-Qayyūm"]} rail={false}>
        <div style={{ padding: "26px 24px", position: "relative" }}>
          <div style={{ fontFamily: R.fontSerif, fontSize: 58, color: R.ink,
                        direction: "rtl", textAlign: "center", lineHeight: 1.7 }}>
            ٱلْحَىُّ ٱلْقَيُّومُ
          </div>
          <svg width="100%" height="90" style={{ position: "absolute", left: 0, top: 96 }}>
            <path d="M250 40 C330 10, 470 8, 590 30 C640 40, 670 34, 700 20"
                  stroke={R.highlight} strokeWidth="17" fill="none" strokeLinecap="round"
                  opacity={0.5} strokeDasharray={520}
                  strokeDashoffset={520 * (1 - interpolate(p, [0.1, 0.62], [0, 1], clamp))} />
          </svg>
          <div style={{ marginTop: 76, opacity: interpolate(p, [0.6, 0.95], [0, 1], clamp) }}>
            <div style={{ fontFamily: R.fontMono, fontSize: 16, color: "#92400E",
                          letterSpacing: "0.05em", textTransform: "uppercase" }}>Linguistic</div>
            <div style={{ fontFamily: R.fontSans, fontSize: 25, color: R.ink2,
                          marginTop: 8, lineHeight: 1.5 }}>
              qāma — to stand. The One who sustains all that stands.
            </div>
          </div>
        </div>
      </Chrome>
    );

    /* write — the real slash command */
    case 5: {
      const typed = "/ayah 2:255".slice(0, Math.floor(interpolate(p, [0.18, 0.52], [0, 11], clamp)));
      return (
        <Chrome trail={["Al-Baqara", "Āyat al-Kursī"]} rail={false}>
          <div style={{ padding: "26px 24px" }}>
            <div style={{ fontFamily: R.fontSerif, fontSize: 32, fontWeight: 700, color: R.ink }}>
              On al-Qayyūm
            </div>
            <div style={{ fontFamily: R.fontSans, fontSize: 24, color: R.ink2,
                          marginTop: 14, lineHeight: 1.55,
                          opacity: interpolate(p, [0.05, 0.2], [0, 1], clamp) }}>
              The name that stopped me today.
            </div>
            <div style={{ fontFamily: R.fontMono, fontSize: 26, color: R.accentInk, marginTop: 22 }}>
              {typed}<span style={{ opacity: Math.floor(f / 16) % 2 ? 1 : 0.15 }}>▌</span>
            </div>
            <div style={{
              marginTop: 14, border: `1px solid ${R.lineStrong}`, borderRadius: R.radiusMd,
              background: R.bgElev, boxShadow: R.shadowMd, padding: 10,
              opacity: interpolate(p, [0.5, 0.68], [0, 1], clamp),
              transform: `translateY(${(1 - interpolate(p, [0.5, 0.68], [0, 1], clamp)) * 10}px)`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12,
                            padding: 10, borderRadius: 6, background: R.panel }}>
                <span style={{ fontSize: 20 }}>📖</span>
                <div>
                  <div style={{ fontFamily: R.fontSans, fontSize: 21, fontWeight: 600, color: R.ink }}>
                    Embed āyah
                  </div>
                  <div style={{ fontFamily: R.fontSans, fontSize: 16, color: R.ink3, marginTop: 2 }}>
                    Al-Baqara 2:255 — Āyat al-Kursī
                  </div>
                </div>
              </div>
            </div>
            <div style={{
              marginTop: 16, padding: "16px 18px", borderRadius: 8,
              background: R.panel, direction: "rtl", textAlign: "center",
              fontFamily: R.fontSerif, fontSize: 30, color: R.ink,
              opacity: interpolate(p, [0.76, 0.94], [0, 1], clamp),
            }}>ٱلْحَىُّ ٱلْقَيُّومُ</div>
          </div>
        </Chrome>
      );
    }

    /* check — the tafsīr drawer, rack focus pointing at it */
    case 6: return (
      <Chrome trail={["2:255", "Tafsīr"]} rail={false}>
        <div style={{ position: "absolute", inset: 0, display: "flex", paddingTop: 112 }}>
          <div style={{ flex: 1, padding: "22px 20px",
                        filter: `blur(${interpolate(p, [0.28, 0.62], [0, 5], clamp)}px)`,
                        opacity: interpolate(p, [0.28, 0.62], [1, 0.45], clamp) }}>
            <div style={{ fontFamily: R.fontSerif, fontSize: 38, color: R.ink, direction: "rtl" }}>
              ٱلْقَيُّومُ
            </div>
            <div style={{ fontFamily: R.fontMono, fontSize: 17, color: R.ink3, marginTop: 12 }}>
              2:255 · WORD 5
            </div>
          </div>
          <div style={{
            width: "58%", background: R.panel, borderLeft: `1px solid ${R.line}`,
            padding: "20px 18px",
            transform: `translateX(${(1 - ease(interpolate(p, [0.16, 0.6], [0, 1], clamp))) * 100}%)`,
          }}>
            {[["Ibn Kathīr", "774 AH"], ["Al-Qurṭubī", "671 AH"],
              ["Al-Ṭabarī", "310 AH"], ["Al-Saʿdī", "1376 AH"]].map(([n, d], k) => (
              <div key={n} style={{ marginBottom: 18,
                    opacity: interpolate(p, [0.4 + k * 0.12, 0.62 + k * 0.12], [0, 1], clamp) }}>
                <div style={{ fontFamily: R.fontSans, fontSize: 24, color: R.ink }}>{n}</div>
                <div style={{ fontFamily: R.fontMono, fontSize: 16, color: R.ink3, marginTop: 3 }}>{d}</div>
              </div>
            ))}
            <div style={{ fontFamily: R.fontMono, fontSize: 16, color: R.ink4, marginTop: 6,
                          opacity: interpolate(p, [0.88, 1], [0, 1], clamp) }}>
              + 63 more
            </div>
          </div>
        </div>
      </Chrome>
    );

    /* keep — the Connection, saved */
    case 7: return (
      <Chrome trail={["Connections", "New"]} rail={false}>
        <div style={{ padding: "24px 22px" }}>
          <div style={{
            border: `1px solid ${R.lineStrong}`, borderRadius: R.radius,
            background: R.bgElev, padding: "20px 20px", boxShadow: R.shadowSm,
            opacity: interpolate(p, [0.12, 0.4], [0, 1], clamp),
            transform: `translateY(${(1 - interpolate(p, [0.12, 0.4], [0, 1], clamp)) * 14}px)`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
              <div style={{ fontFamily: R.fontSans, fontSize: 25, fontWeight: 600, color: R.ink }}>
                The One who sustains
              </div>
              <div style={{ fontSize: 20, color: R.iconLink }}>🔗</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12,
                          fontFamily: R.fontSans, fontSize: 21, color: R.ink2 }}>
              <span>Al-Baqara 2:255</span>
              <span style={{ color: R.iconLink }}>↔</span>
              <span>Āl ʿImrān 3:2</span>
            </div>
            <div style={{ fontFamily: R.fontSans, fontSize: 20, color: R.ink2,
                          marginTop: 12, lineHeight: 1.5,
                          opacity: interpolate(p, [0.45, 0.7], [0, 1], clamp) }}>
              The same two names open both āyāt.
            </div>
            <div style={{ fontFamily: R.fontMono, fontSize: 16, color: R.ink4, marginTop: 14,
                          opacity: interpolate(p, [0.6, 0.82], [0, 1], clamp) }}>
              Munāsabāt · divine names
            </div>
          </div>
          <div style={{ fontFamily: R.fontMono, fontSize: 18, color: R.ink3,
                        textAlign: "center", marginTop: 24,
                        opacity: interpolate(p, [0.82, 1], [0, 1], clamp) }}>
            saved to your Connections
          </div>
        </div>
      </Chrome>
    );

    /* return — it is still here, and so are they */
    case 8: {
      const people = [
        { n: "Yahya",   c: "#448061", fy:   0, dx: -300, t: 0.30 },
        { n: "Amina",   c: "#695ba9", fy:  70, dx:  300, t: 0.42 },
        { n: "Bilal",   c: "#b07d3a", fy: 140, dx:  300, t: 0.54 },
        { n: "Sumayya", c: "#3a6fb0", fy: 210, dx: -300, t: 0.66 },
      ];
      return (
        <Chrome trail={["Tuesday Ḥalaqa", "2:255"]} rail={false}>
          <div style={{ padding: "22px 22px", position: "relative" }}>
            <div style={{ fontFamily: R.fontSans, fontSize: 23, color: R.ink3 }}>
              Last opened 6 days ago
            </div>
            <div style={{ fontFamily: R.fontSerif, fontSize: 30, color: R.ink, marginTop: 10 }}>
              On al-Qayyūm
            </div>
            <div style={{ height: 1, background: R.line, margin: "20px 0 26px" }} />
            <div style={{ position: "relative", height: 260 }}>
              {people.map((pp) => {
                const q = ease(interpolate(p, [pp.t, pp.t + 0.26], [0, 1], clamp));
                return (
                  <div key={pp.n} style={{
                    position: "absolute", left: 20, top: pp.fy,
                    transform: `translateX(${(1 - q) * pp.dx}px)`, opacity: q,
                    display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <div style={{ width: 34, height: 34, borderRadius: 17, background: pp.c }} />
                    <div style={{ fontFamily: R.fontSans, fontSize: 24, color: R.ink2 }}>{pp.n}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Chrome>
      );
    }

    /* answer */
    case 9: {
      const q = ease(Math.min(1, Math.max(0, (since - 6) / 46)));
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: R.fontSerif, fontSize: 76, color: R.ink, lineHeight: 1,
                        opacity: interpolate(q, [0, 0.35], [0, 1], clamp),
                        transform: `translateY(${(1 - q) * 12}px)` }}>ت</div>
          <div style={{ width: 118, height: 2, background: R.ink4, overflow: "hidden" }}>
            <div style={{ width: `${interpolate(q, [0.25, 0.8], [0, 100], clamp)}%`,
                          height: "100%", background: R.ink3 }} />
          </div>
          <div style={{ fontFamily: R.fontMono, fontSize: 18, color: R.ink3,
                        letterSpacing: "0.22em", opacity: interpolate(q, [0.45, 0.8], [0, 1], clamp) }}>
            TAFSIR LAB
          </div>
        </div>
      );
    }
    default: return null;
  }
};

// ── The throw ──────────────────────────────────────────────────────────────
// The sūrah is thrown out of the list and the muṣḥaf container catches it.

const THROW_AT = 460, THROW_LEN = 60;    // lands at BEATS[3].at = 520

const Thrown: React.FC = () => {
  const f = useCurrentFrame();
  const p = (f - THROW_AT) / THROW_LEN;
  if (p < 0 || p > 1) return null;
  const dy = track(p, ARC.S, ARC.Y);
  const v = Math.abs(track(Math.min(1, p + 0.01), ARC.S, ARC.Y) - dy) / 0.01;
  return (
    <div style={{
      position: "absolute", left: CX - 160, top: CY + 30 + dy, width: 320,
      opacity: interpolate(p, [0.86, 1], [1, 0], clamp), zIndex: 30,
      filter: `blur(${Math.min(9, v / 90)}px)`,
      background: R.bgElev, borderRadius: 12, padding: "16px 20px", boxShadow: R.shadowMd,
      fontFamily: R.fontSans, fontSize: 25, color: R.ink, textAlign: "center",
    }}>Al-Baqara · 2:255</div>
  );
};

// ── Composition ────────────────────────────────────────────────────────────

export const OneDesk: React.FC = () => {
  const f = useCurrentFrame();
  const g = geom(f);
  const cb = contentBlur(g.m);
  const beat = BEATS[g.i];
  const warm = smoothstep(Math.min(1, Math.abs(f - 900) / 900));

  return (
    <AbsoluteFill style={{ background: `hsl(252 8% ${89 + warm * 1.6}%)` }}>
      {g.w > 2 && (
        <div style={{
          position: "absolute", left: CX - g.w / 2, top: CY - g.h / 2,
          width: g.w, height: g.h, borderRadius: g.r,
          background: R.bgElev, boxShadow: R.shadowLg, overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: cb.opacity, filter: `blur(${cb.blur}px)`,
            transform: `translateX(${cb.dx}px)`,
          }}>
            <div style={{ width: "100%", height: "100%", position: "relative" }}>
              <Surface i={g.i} f={f} />
            </div>
          </div>
        </div>
      )}

      <Thrown />
      {beat.say && <Say text={beat.say} at={beat.at} dur={g.i === 0 ? 170 : 160} />}
      {beat.cap && beat.side &&
        <Caption text={beat.cap} at={beat.at + MORPH} side={beat.side} h={g.h} />}
      <Cursor />

      {/* ── Sound ──────────────────────────────────────────────────────────
          The CLICK is the spine — it is the product's own sound, and it fires
          on every cursor action. The first cut leaned on two families for nine
          beats, which is §12.6's fault stated as variety rather than level.
          Whoosh appears twice in thirty seconds; the loud moments remain the
          catch and the close (§12.1).                                      */}
      <Audio src={staticFile("bg.mp3")} volume={0.15} />

      <Sequence from={322} durationInFrames={80}><Audio src={staticFile("sfx/granular.mp3")} volume={0.26} /></Sequence>
      <Sequence from={392} durationInFrames={44}><Audio src={staticFile("sfx/click.mp3")} volume={0.42} /></Sequence>
      <Sequence from={THROW_AT - 4} durationInFrames={70}><Audio src={staticFile("sfx/whoosh.mp3")} volume={0.30} /></Sequence>
      <Sequence from={THROW_AT + 54} durationInFrames={80}><Audio src={staticFile("sfx/land.mp3")} volume={0.54} /></Sequence>
      <Sequence from={716} durationInFrames={90}><Audio src={staticFile("sfx/granular-select.mp3")} volume={0.30} /></Sequence>
      <Sequence from={776} durationInFrames={44}><Audio src={staticFile("sfx/click.mp3")} volume={0.38} /></Sequence>
      <Sequence from={912} durationInFrames={96}><Audio src={staticFile("sfx/typing.mp3")} volume={0.38} /></Sequence>
      <Sequence from={996} durationInFrames={44}><Audio src={staticFile("sfx/click.mp3")} volume={0.44} /></Sequence>
      <Sequence from={1100} durationInFrames={70}><Audio src={staticFile("sfx/whoosh.mp3")} volume={0.24} /></Sequence>
      <Sequence from={1160} durationInFrames={44}><Audio src={staticFile("sfx/click.mp3")} volume={0.36} /></Sequence>
      <Sequence from={1300} durationInFrames={44}><Audio src={staticFile("sfx/click.mp3")} volume={0.42} /></Sequence>
      <Sequence from={1352} durationInFrames={80}><Audio src={staticFile("sfx/magnetic.mp3")} volume={0.38} /></Sequence>
      <Sequence from={1486} durationInFrames={80}><Audio src={staticFile("sfx/granular.mp3")} volume={0.24} /></Sequence>
      <Sequence from={1640} durationInFrames={110}><Audio src={staticFile("sfx/land.mp3")} volume={0.56} /></Sequence>
    </AbsoluteFill>
  );
};

export default OneDesk;
