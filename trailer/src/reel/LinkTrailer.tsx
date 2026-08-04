import React from "react";
import {
  AbsoluteFill, Sequence, Audio, staticFile,
  useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import { typed } from "./parts";
import { Wheel } from "./Wheel";
import {
  morphAt, Card, Stage, Words, Rise, Focus, rack, Say,
  SmearCursor, themeAt, useTheme, ThemeProvide,
} from "./morph";
import {
  TRAILER_FRAMES, STATES as S, THEME_KEYS as THEME, SAYS, LEGS, LINKS, STARTS,
  DRAW_FOR, WHEEL_IN, CONNS, VERSES, IX, CMD, NAME, T, T_END, NOTE, MOD, STACK, TOG,
  MAGNETIC, FALLS, PAIR,
  type Conn,
} from "./trailerSpec";

export { TRAILER_FRAMES };

/* ── The Connections trailer ───────────────────────────────────────────────
   One container for 38 seconds. It becomes the title card, the brand mark, a
   full note, the /link command line, the suggestion menu, the Create form, the
   saved Connection, a stack of them, the Connections map, and the end card —
   then returns to the title card it opened on, so the last frame loops into
   the first.

   Where the earlier test read as repetitive, the fix is not faster cutting. It
   is VARIATION in the four things the references vary:

     · position — the container parks high, low, and centre, and the
       explanation text takes the space it leaves
     · scale — from a 132px mark to a 940px sheet
     · tone — a real mode drop to the app's dark theme for the map
     · count — one card becomes four, cascading

   Nothing here is a cut. Every change is the same object moving.            */

/* ── Content ──────────────────────────────────────────────────────────────*/

const Mark: React.FC<{ size: number }> = ({ size }) => {
  const th = useTheme();
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.26,
      background: th.ink, color: th.card,
      display: "grid", placeItems: "center",
      fontFamily: R.fontSans, fontSize: size * 0.5, fontWeight: 700,
    }}>T</div>
  );
};

const TitleCard: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const rule = interpolate(f, [s + 26, s + 60], [0, 168],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 4,
    }}>
      <Rise f={f} start={s} i={0} style={{ marginBottom: 22 }}>
        <Mark size={64} />
      </Rise>
      <div style={{
        fontFamily: R.fontSerif, fontSize: 50, color: th.ink, letterSpacing: "-0.025em",
      }}>
        <Words f={f} start={s + 5} text="Tafsir Lab" step={7} />
      </div>
      <div style={{
        fontFamily: R.fontSans, fontSize: 25, color: th.accent,
        letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 12,
      }}>
        <Words f={f} start={s + 16} text="Connections" step={7} />
      </div>
      <div style={{ width: rule, height: 2, background: th.accent, borderRadius: 2, marginTop: 26 }} />
    </div>
  );
};

/**
 * One passage: what it is, what it says, and what it means.
 *
 * The English line is not decoration. A viewer who cannot read Arabic learns
 * nothing from the script alone, and the opening only works if they can see
 * for themselves why these two passages belong together — one is seven verses,
 * the other names seven verses.
 */
const VerseRow: React.FC<{ f: number; s: number; i: number; base?: number }> =
({ f, s, i, base = 0 }) => {
  const th = useTheme();
  const v = VERSES[i];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Rise f={f} start={s} i={base}>
        <span style={{
          fontFamily: R.fontSans, fontSize: 21, color: th.accentInk,
          background: th.accentSoft, padding: "9px 18px", borderRadius: 999,
        }}>{v.ref}</span>
      </Rise>
      <Rise f={f} start={s} i={base + 1}>
        <div dir="rtl" style={{
          fontFamily: R.fontArabic, fontSize: 36, lineHeight: 1.7,
          color: th.ink, textAlign: "right",
        }}>{v.ar}</div>
      </Rise>
      <Rise f={f} start={s} i={base + 2} style={{
        fontFamily: R.fontSans, fontSize: 23, color: th.ink3, lineHeight: 1.45,
      }}>{v.en}</Rise>
    </div>
  );
};

const VerseChip: React.FC<{ f: number; s: number; i: number }> = ({ f, s, i }) => (
  <div style={{
    height: "100%", padding: "0 40px", boxSizing: "border-box",
    display: "flex", flexDirection: "column", justifyContent: "center",
  }}>
    <VerseRow f={f} s={s} i={i} />
  </div>
);

/**
 * Both passages in one card, with the connector drawn between them.
 *
 * This is the beat that stops the opening being two unexplained Arabic lines.
 * The line draws itself from the first reference down to the second, and the
 * link node lands on it — the same relationship the rest of the trailer goes
 * on to create with /link.
 */
const VersePair: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const draw = interpolate(f, [s + 30, s + 74], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const node = interpolate(f, [s + 62, s + 84], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const LEN = PAIR.linkH + 8;
  return (
    <div style={{
      height: "100%", padding: PAIR.pad, boxSizing: "border-box",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      <VerseRow f={f} s={s} i={0} />

      {/* The connector. It draws downward, so the eye is carried from the
          first passage to the second rather than being asked to compare two
          things that simply appeared. */}
      <div style={{
        height: PAIR.linkH, position: "relative",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <svg width="26" height={PAIR.linkH} style={{ overflow: "visible", flexShrink: 0 }}>
          <path d={`M13 0 L13 ${PAIR.linkH}`}
            stroke={th.accent} strokeWidth={2.5} strokeLinecap="round" fill="none"
            strokeDasharray={LEN} strokeDashoffset={LEN * (1 - draw)} />
        </svg>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          opacity: node, transform: `translateX(${(1 - node) * -14}px)`,
        }}>
          <span style={{ fontSize: 21, color: th.iconLink }}>🔗</span>
          <span style={{
            fontFamily: R.fontSans, fontSize: 19, color: th.ink3,
          }}>the seven oft-repeated verses</span>
        </div>
      </div>

      <VerseRow f={f} s={s} i={1} base={3} />
    </div>
  );
};

/** The note, at a size that fills the frame — the reference's "fill" beat. */
const Note: React.FC<{
  f: number; s: number; slash?: string; caret?: boolean; menu?: number;
  lineIn?: number;
}> = ({ f, s, slash, caret, menu, lineIn = 1 }) => {
  const th = useTheme();
  return (
    <div style={{ padding: NOTE.pad, position: "relative", height: "100%" }}>
      <div style={{
        fontFamily: R.fontSerif, fontSize: 42, fontWeight: 700,
        color: th.ink, letterSpacing: "-0.012em", lineHeight: 1.2,
      }}>
        <Words f={f} start={s} text="3. As-Sabʿ al-Mathānī" step={8} />
      </div>

      <Rise f={f} start={s} i={1} style={{
        fontFamily: R.fontSans, fontSize: 24, color: th.ink3, marginTop: 12, lineHeight: 1.4,
      }}>
        Seven verses, repeated in every rakʿah of every prayer.
      </Rise>

      <Rise f={f} start={s} i={2} style={{
        borderLeft: `3px solid ${th.lineStrong}`, paddingLeft: 22, marginTop: 24,
      }}>
        <div dir="rtl" style={{
          fontFamily: R.fontArabic, fontSize: 34, lineHeight: 1.95,
          color: th.ink, textAlign: "right",
        }}>
          وَلَقَدْ آتَيْنَاكَ سَبْعًا مِّنَ الْمَثَانِي
        </div>
        <div style={{
          fontFamily: R.fontSans, fontSize: 21, fontStyle: "italic",
          color: th.ink2, lineHeight: 1.55, marginTop: 14,
        }}>
          And We have certainly given you the seven oft-repeated verses.
        </div>
      </Rise>

      <Rise f={f} start={s} i={3} style={{
        fontFamily: R.fontSans, fontSize: 22, color: th.ink2,
        lineHeight: 1.62, marginTop: 24,
      }}>
        It is called as-Sabʿ al-Mathānī because it is seven verses by consensus,
        and Mathānī because it is repeated in every rakʿah.
      </Rise>

      <Rise f={f} start={s} i={4} style={{
        fontFamily: R.fontSans, fontSize: 18, color: th.ink4, marginTop: 12,
      }}>
        — Tafsīr al-Baghawī, 1:37
      </Rise>

      {slash !== undefined && (
        /* The command line arrives WITH the reflow that makes room for it, so
           the card growing and the line appearing are one event rather than
           two. `lineIn` is driven by the reflow window, not by a guess. */
        <div style={{
          position: "absolute", left: NOTE.pad, top: NOTE.slashY, right: NOTE.pad,
          opacity: lineIn, transform: `translateY(${(1 - lineIn) * -8}px)`,
        }}>
          <div style={{
            fontFamily: R.fontSans, fontSize: 30, color: th.accentInk,
            height: NOTE.lineH, display: "flex", alignItems: "center",
          }}>
            {slash}
            {caret && (
              <span style={{
                display: "inline-block", width: 2, height: 30, background: th.ink,
                marginLeft: 3, opacity: Math.floor(f / 18) % 2 === 0 ? 1 : 0,
              }} />
            )}
          </div>

          {menu !== undefined && menu > 0 && (
            <div style={{
              marginTop: NOTE.menuGap, opacity: menu, width: 540, height: NOTE.menuH,
              background: th.card, border: `1px solid ${th.lineStrong}`,
              borderRadius: 10, boxShadow: th.shadowLg, padding: 10,
              boxSizing: "border-box",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 14, height: "100%",
                padding: "0 14px", borderRadius: 6, background: th.panel,
                boxSizing: "border-box",
              }}>
                <div style={{ fontSize: 24, color: th.iconLink }}>🔗</div>
                <div>
                  <div style={{ fontFamily: R.fontSans, fontSize: 22, fontWeight: 600, color: th.ink }}>
                    Link Qurʾanic passage
                  </div>
                  <div style={{ fontFamily: R.fontSans, fontSize: 16, color: th.ink3, marginTop: 2 }}>
                    Create a permanent Connection
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Lab: React.FC<{ top: number; children: React.ReactNode }> = ({ top, children }) => {
  const th = useTheme();
  return (
    <div style={{
      position: "absolute", left: MOD.pad, top,
      fontFamily: R.fontSans, fontSize: 14, letterSpacing: "0.09em",
      textTransform: "uppercase", color: th.ink4,
    }}>{children}</div>
  );
};

const CATS = ["Naẓm", "Tafsīr", "Lughah"];

const Modal: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const name = typed(NAME, f, T.nameStart, T.nameCps);
  const typing = f >= T.nameStart && f < T_END.name + 30;
  /* Rack focus: the fields go soft as attention moves to the category row.
     Blur used to point at something, not to cover a cut. */
  const toCat = rack(f, T.catRack, 20);
  const field: React.CSSProperties = {
    border: `1px solid ${th.lineStrong}`, borderRadius: 6,
    background: th.panel, padding: "0 18px", boxSizing: "border-box",
    fontFamily: R.fontSans, color: th.ink,
    display: "flex", alignItems: "center",
  };
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div style={{
        position: "absolute", left: MOD.pad, top: MOD.pad,
        fontFamily: R.fontSerif, fontSize: 34, fontWeight: 700, color: th.ink,
      }}>
        <Words f={f} start={s} text="Create Connection" step={9} />
      </div>

      <Focus on={1 - toCat * 0.75}>
        <Lab top={MOD.nameLab}>Name</Lab>
        <div style={{
          ...field,
          position: "absolute", left: MOD.pad, right: MOD.pad,
          top: MOD.nameFld, height: MOD.nameH, fontSize: 23,
          borderColor: typing ? th.accent : th.lineStrong,
          boxShadow: typing ? `0 0 0 4px ${th.accentSoft}` : "none",
        }}>
          {name}
          {typing && (
            <span style={{
              display: "inline-block", width: 2, height: 25, background: th.ink,
              marginLeft: 3, opacity: Math.floor(f / 16) % 2 === 0 ? 1 : 0,
            }} />
          )}
        </div>
      </Focus>

      <Focus on={1 - toCat * 0.8}>
        <Lab top={MOD.commLab}>Commentary</Lab>
        <div style={{
          ...field,
          position: "absolute", left: MOD.pad, right: MOD.pad,
          top: MOD.commFld, height: MOD.commH,
          padding: "16px 18px", alignItems: "flex-start",
          fontSize: 21, color: th.ink2, lineHeight: 1.5,
        }}>
          Al-Fātiḥah is referred to here in Sūrah al-Ḥijr, long after it was revealed.
        </div>
      </Focus>

      <Focus on={0.25 + toCat * 0.75}>
        <Lab top={MOD.catLab}>Category</Lab>
        <div style={{
          position: "absolute", left: MOD.pad, top: MOD.catRow,
          height: MOD.catH, display: "flex", gap: 12, alignItems: "center",
        }}>
          {CATS.map((c, i) => {
            const on = i === 1 && f >= T.catRack;
            return (
              <div key={c} style={{
                padding: "12px 24px", borderRadius: 999,
                fontFamily: R.fontSans, fontSize: 20,
                background: on ? th.accent : th.panel,
                color: on ? "#fff" : th.ink2,
                border: `1px solid ${on ? th.accent : th.lineStrong}`,
              }}>{c}</div>
            );
          })}
        </div>
      </Focus>

      <div style={{
        position: "absolute", right: MOD.pad, top: MOD.btnY,
        width: MOD.btnW, height: MOD.btnH, borderRadius: 6,
        background: th.accent, color: "#fff",
        boxShadow: f >= T.btnRack ? `0 0 0 5px ${th.accentSoft}` : "none",
        display: "grid", placeItems: "center",
        fontFamily: R.fontSans, fontSize: 21, fontWeight: 600,
      }}>Create Connection</div>
    </div>
  );
};


const ConnRow: React.FC<{ f: number; s: number; c: Conn; h: number; bare?: boolean }> =
({ f, s, c, h, bare }) => {
  const th = useTheme();
  return (
    <div style={{
      height: h, display: "flex", alignItems: "center", gap: 18,
      padding: bare ? 0 : "0 22px", borderRadius: 14,
      background: bare ? "transparent" : th.panel,
      border: bare ? "none" : `1px solid ${th.line}`,
      boxSizing: "border-box",
    }}>
      <div style={{
        width: 50, height: 50, borderRadius: 13, background: th.accentSoft,
        display: "grid", placeItems: "center", fontSize: 24, color: th.iconLink, flexShrink: 0,
      }}>🔗</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: R.fontSans, fontSize: 24, fontWeight: 600, color: th.ink, lineHeight: 1.25,
        }}>
          <Words f={f} start={s} text={c.name} step={5} />
        </div>
        <Rise f={f} start={s} i={2} style={{
          display: "flex", gap: 9, marginTop: 10, alignItems: "center", flexWrap: "nowrap",
        }}>
          <span style={{
            fontFamily: R.fontSans, fontSize: 16, color: th.accentInk,
            background: th.accentSoft, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap",
          }}>{c.a}</span>
          <span style={{ color: th.ink4, fontSize: 17 }}>↔</span>
          <span style={{
            fontFamily: R.fontSans, fontSize: 16, color: th.accentInk,
            background: th.accentSoft, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap",
          }}>{c.b}</span>
          <span style={{
            fontFamily: R.fontSans, fontSize: 15, color: th.ink3,
            background: th.panel2, padding: "6px 12px", borderRadius: 999, marginLeft: 2,
          }}>{c.cat}</span>
        </Rise>
      </div>
    </div>
  );
};

/** The single saved Connection, on its own, parked high. */
const Saved: React.FC<{ f: number; s: number }> = ({ f, s }) => (
  /* Wide side padding because the container is a stadium — its corners curve
     all the way in, so content has to keep clear of them. */
  <div style={{ padding: "0 58px", height: "100%", boxSizing: "border-box",
                display: "flex", alignItems: "center" }}>
    <ConnRow f={f} s={s} c={CONNS[0]} h={138} bare />
  </div>
);

/** …and then there are four. Staggered arrival is the whole point: bringing
 *  them in together reads as a screenshot, one after another reads as growth. */
const Stack: React.FC<{ f: number; s: number }> = ({ f, s }) => (
  <div style={{
    padding: STACK.pad, height: "100%", boxSizing: "border-box",
    display: "flex", flexDirection: "column", gap: STACK.gap,
  }}>
    {CONNS.map((c, i) => (
      <ConnRow key={c.name} f={f} s={s + i * STACK.step} c={c} h={STACK.rowH} />
    ))}
  </div>
);

/**
 * The appearance switch, thrown on camera.
 *
 * Dark mode reads as a slideshow trick when it simply happens between shots.
 * Here the cursor crosses the whole frame, throws the switch, and the tone
 * follows from the click — the product changing because it was operated.
 */
const Toggle: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const k = interpolate(f, [T.themeAt, T.themeAt + 16], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const travel = TOG.swW - TOG.knob - 10;
  return (
    <div style={{
      height: "100%", padding: `0 ${TOG.pad}px`, boxSizing: "border-box",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
    }}>
      <div>
        <Rise f={f} start={s} i={0} style={{
          fontFamily: R.fontSans, fontSize: 26, fontWeight: 600, color: th.ink,
        }}>Appearance</Rise>
        <Rise f={f} start={s} i={1} style={{
          fontFamily: R.fontSans, fontSize: 19, color: th.ink3, marginTop: 4,
        }}>{k > 0.5 ? "Dark" : "Light"}</Rise>
      </div>
      <Rise f={f} start={s} i={2}>
        <div style={{
          width: TOG.swW, height: TOG.swH, borderRadius: TOG.swH / 2,
          background: k > 0.5 ? th.panel2 : th.accent,
          border: `1px solid ${th.lineStrong}`,
          position: "relative", boxSizing: "border-box",
        }}>
          <div style={{
            position: "absolute", top: (TOG.swH - TOG.knob) / 2 - 1,
            left: 5 + (1 - k) * travel,
            width: TOG.knob, height: TOG.knob, borderRadius: "50%",
            background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }} />
        </div>
      </Rise>
    </div>
  );
};

const Map: React.FC<{ f: number; s: number; dark: number }> = ({ f, s, dark }) => (
  /* A circular container for a circular thing. The label lives outside it, on
     the stage, because a caption inside a circle has nowhere square to sit. */
  <div style={{ padding: 48, height: "100%", boxSizing: "border-box" }}>
    <Wheel t={f} edges={LINKS} starts={STARTS} drawFor={DRAW_FOR}
      build={false} ringIn={{ at: WHEEL_IN - 26, over: 34 }}
      linkW={2.6} linkOpacity={0.75} dark={dark} />
  </div>
);

/**
 * What the map amounts to, said once and small — and then said shorter.
 *
 * "Infinite" is written first, then handed over to the symbol for it while the
 * pill narrows around the change. The word and the glyph occupy the SAME slot,
 * one leaving as the other arrives, so the container reads as revising itself
 * rather than cutting to a different card.
 */
const Count: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  const sw = interpolate(f, [T.infAt, T.infAt + T.infOver], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const slot: React.CSSProperties = {
    gridArea: "1 / 1", fontFamily: R.fontSans, fontWeight: 600, color: th.ink,
    whiteSpace: "nowrap",
  };
  return (
    <div style={{
      height: "100%", display: "flex", alignItems: "center",
      justifyContent: "center", gap: 12,
    }}>
      <Rise f={f} start={s} i={0}>
        <span style={{ fontSize: 26, color: th.iconLink }}>🔗</span>
      </Rise>

      <div style={{
        display: "grid", placeItems: "center",
        width: interpolate(sw, [0, 1], [116, 44]),
        height: 46, overflow: "hidden",
      }}>
        <span style={{
          ...slot, fontSize: 26,
          opacity: 1 - sw,
          transform: `scale(${1 - sw * 0.3})`,
          filter: sw > 0.02 ? `blur(${sw * 8}px)` : undefined,
        }}>Infinite</span>
        <span style={{
          ...slot, fontSize: 42, lineHeight: 1, color: th.accent,
          opacity: sw,
          transform: `scale(${0.55 + sw * 0.45})`,
          filter: sw < 0.98 ? `blur(${(1 - sw) * 8}px)` : undefined,
        }}>∞</span>
      </div>

      <div style={{
        fontFamily: R.fontSans, fontSize: 26, fontWeight: 600, color: th.ink,
      }}>
        <Words f={f} start={s + 3} text="Connections" step={6} />
      </div>
    </div>
  );
};

const Cta: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const th = useTheme();
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      <Rise f={f} start={s} i={0} style={{ marginBottom: 20 }}>
        <Mark size={58} />
      </Rise>
      <div style={{ fontFamily: R.fontSerif, fontSize: 44, color: th.ink, letterSpacing: "-0.022em" }}>
        <Words f={f} start={s + 4} text="Tafsir Lab" step={7} />
      </div>
      <Rise f={f} start={s} i={3} style={{
        display: "flex", alignItems: "center", gap: 14, marginTop: 24, width: 300,
      }}>
        <div style={{ flex: 1, height: 1, background: th.lineStrong }} />
        <div style={{ color: th.ink4, fontSize: 13 }}>◆</div>
        <div style={{ flex: 1, height: 1, background: th.lineStrong }} />
      </Rise>
      <div style={{
        fontFamily: R.fontSans, fontSize: 27, color: th.accentInk, marginTop: 24,
      }}>
        <Words f={f} start={s + 26} text="Join the waitlist." step={7} />
      </div>
    </div>
  );
};

/* ── Composition ──────────────────────────────────────────────────────────*/

/** Tone at a frame, 0 light → 1 dark. Kept separate from the Theme object so
 *  the Wheel can mix its own group tints by the same amount. */
const darkAt = (f: number) => {
  let t = THEME[0].t;
  for (let i = 1; i < THEME.length; i++) {
    const a = THEME[i - 1], b = THEME[i];
    if (f >= b.at) { t = b.t; continue; }
    if (f > a.at) { t = a.t + (b.t - a.t) * ((f - a.at) / Math.max(1, b.at - a.at)); break; }
  }
  return Math.max(0, Math.min(1, t));
};

const Body: React.FC = () => {
  const f = useCurrentFrame();
  const m = morphAt(f, S);
  const dark = darkAt(f);

  /* 3D tilt, used twice: a small sway on the stack so it reads as a stack of
     physical cards, and a slower one on the map so the ring reads as an
     object being looked at rather than a diagram pasted on. */
  const stack = S[IX.stack], wheel = S[IX.wheel], after = S[IX.count];
  const tog = S[IX.toggle];
  const tilt =
    /* A slow ROCK on the stack, not a held lean. A sustained tilt parks the
       card visibly off-axis, which reads as bad centring rather than as depth;
       an oscillation starting and ending square-on gives the same sense of
       physical cards without ever leaving the card looking crooked. */
    Math.sin((f - stack.at) / 68) *
      interpolate(f,
        [stack.at, stack.at + 60, tog.at - tog.morph - 30, tog.at - tog.morph],
        [0, 0.28, 0.28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) +
    /* …and a slow sway on the map, so the ring is an object being looked at
       rather than a diagram pasted onto the frame. */
    Math.sin((f - wheel.at) / 130) *
      interpolate(f,
        [wheel.at, wheel.at + 70, after.at - after.morph - 60, after.at - after.morph],
        [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  /* The command line fades up across the reflow that makes room for it. */
  const slashIn = S[IX.slash].at - S[IX.slash].morph;
  const lineIn = interpolate(f, [slashIn + 4, slashIn + 24], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const render = (key: string, start: number) => {
    switch (key) {
      case "title": return <TitleCard f={f} s={start} />;
      case "verseA": return <VerseChip f={f} s={start} i={0} />;
      case "verseB": return <VerseChip f={f} s={start} i={1} />;
      case "verseBoth": return <VersePair f={f} s={start} />;
      case "note":  return <Note f={f} s={start} />;
      /* The caret only exists after the cursor has clicked the line. A caret
         already blinking when the cursor arrives puts the events in the wrong
         order and gives away that nothing was really clicked. */
      case "slash": return (
        <Note f={f} s={start} caret={f >= T.caretAt} lineIn={lineIn}
          slash={typed(CMD, f, T.slashStart, T.slashCps)} />
      );
      case "menu":  return (
        <Note f={f} s={start} caret slash={CMD} lineIn={1}
          menu={interpolate(f, [S[IX.menu].at - 10, S[IX.menu].at + 12], [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      );
      case "modal": return <Modal f={f} s={start} />;
      case "saved": return <Saved f={f} s={start} />;
      case "stack": return <Stack f={f} s={start} />;
      case "toggle": return <Toggle f={f} s={start} />;
      case "wheel": return <Map f={f} s={start} dark={dark} />;
      case "count":
      case "countInf": return <Count f={f} s={start} />;
      case "cta":   return <Cta f={f} s={start} />;
      default: return null;
    }
  };

  /* The cursor only exists while the product is being operated. No pointer on
     the title card, the explanation beats, the map or the end card — and its
     absence at both ends is what lets the last frame equal the first. */
  const cur = interpolate(f, [560, 600, 1700, 1740], [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <>
      <Card m={m} tilt={tilt}>
        {m.old && m.old.opacity > 0.01 && (
          <div style={{
            position: "absolute", inset: 0,
            opacity: m.old.opacity,
            transform: `translate(${m.old.x}px, ${m.old.y}px) rotate(${m.old.rot}deg)`,
            filter: m.old.blur > 0.05 ? `blur(${m.old.blur}px)` : undefined,
          }}>
            {render(m.old.key, -9999)}
          </div>
        )}
        <div style={{
          position: "absolute", inset: 0, opacity: m.now.opacity,
          transform: `translate(${m.now.x}px, ${m.now.y}px)`,
        }}>
          {render(m.now.key, m.contentStart)}
        </div>
      </Card>

      {SAYS.map((s) => (
        <Say key={s.from} f={f} from={s.from} to={s.to} text={s.text} top={s.top} />
      ))}

      {cur > 0.01 && (
        <div style={{ opacity: cur }}>
          <SmearCursor f={f} legs={LEGS} dark={dark > 0.5} />
        </div>
      )}
    </>
  );
};

const Sfx: React.FC<{ at: number; file: string; v: number; len?: number }> =
({ at, file, v, len = 26 }) => (
  <Sequence from={at} durationInFrames={len}>
    <Audio src={staticFile(file)} volume={v} />
  </Sequence>
);

export const LinkTrailer: React.FC = () => {
  const f = useCurrentFrame();
  const theme = themeAt(f, THEME);
  return (
    <ThemeProvide value={theme}>
      <AbsoluteFill style={{ background: theme.stage }}>
        <Stage theme={theme}>
          <Body />
        </Stage>

        {/* Bed from 33s in. Played at 0.18 rather than the old 0.28 because
            this track is 3.8 dB hotter and peaks at -0.7 dB; matched by
            measurement so it sits exactly where the SFX were balanced. */}
        <Audio
          src={staticFile("bg2.mp3")}
          startFrom={33 * 60}
          volume={(fr) =>
            0.18 * interpolate(fr, [0, 120, TRAILER_FRAMES - 120, TRAILER_FRAMES], [0, 1, 1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />

        <Sequence from={T.slashStart} durationInFrames={T_END.slash - T.slashStart + 10}>
          <Audio src={staticFile("sfx/typing.mp3")} volume={0.34} />
        </Sequence>
        <Sequence from={T.nameStart} durationInFrames={T_END.name - T.nameStart + 10}>
          <Audio src={staticFile("sfx/typing.mp3")} volume={0.38} />
        </Sequence>

        {/* Two weights of click: a soft tap for placing a caret or focusing a
            field, the magnetic snap for the three actions that commit —
            choosing the menu item, creating the Connection, throwing the
            appearance switch. */}
        {LEGS.filter((l) => l.click).map((l) => (
          MAGNETIC.has(l.at)
            ? <Sfx key={l.at} at={l.at} file="sfx/magnetic.mp3" v={0.65} len={14} />
            : <Sfx key={l.at} at={l.at} file="sfx/click.mp3" v={0.40} len={18} />
        ))}

        {/* Things dropping out of the container. The source was peaking at
            -1 dB, so it is baked 12 dB down and played back gently on top —
            it should register as weight, not as a stab. */}
        {FALLS.map((at) => (
          <Sfx key={`fall-${at}`} at={at} file="sfx/granular.mp3" v={0.45} len={22} />
        ))}

        {/* One swoosh per large container move, and one on each card that
            joins the stack, so the cascade is heard as well as seen. */}
        <Sfx at={S[IX.verseB].at - S[IX.verseB].morph} file="sfx/whoosh.mp3" v={0.22} len={36} />
        <Sfx at={S[IX.note].at - S[IX.note].morph} file="sfx/whoosh.mp3" v={0.30} len={48} />
        <Sfx at={S[IX.stack].at - S[IX.stack].morph} file="sfx/whoosh.mp3" v={0.34} len={48} />
        {[1, 2, 3].map((i) => (
          <Sfx key={i} at={S[IX.stack].at - 20 + i * STACK.step} file="sfx/click.mp3" v={0.24} len={16} />
        ))}
        <Sfx at={S[IX.wheel].at - S[IX.wheel].morph} file="sfx/whoosh.mp3" v={0.5} len={60} />
        <Sfx at={S[IX.count].at - S[IX.count].morph} file="sfx/whoosh.mp3" v={0.38} len={52} />
        <Sfx at={S[IX.cta].at - S[IX.cta].morph} file="sfx/whoosh.mp3" v={0.28} len={44} />
      </AbsoluteFill>
    </ThemeProvide>
  );
};

