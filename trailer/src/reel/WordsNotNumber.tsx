import React from "react";
import {
  AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import { typed, Caret, Cursor } from "./parts";

/* ── Reel 08: "You remember the words, not the number" ─────────────────────
   Problem  a person remembers how an ayah SOUNDS, never its reference.
   Message  search the Qur'an the way you actually remember it.

   Every measurement here is the app's own. The panel is .qs-panel (380px,
   --bg-elev, 1px --line-strong, --radius-lg, --shadow-lg); the match highlight
   is .qs-mark's rgba(255,208,80,0.42); the rows are .qs-row/.qs-row-arabic at
   the app's 13px/1.95 line-height. Reel space runs at 1.9x the app's CSS px so
   a 380px panel reads at 722 — large enough to understand on a phone, which is
   the one constraint every one of these has to meet.

   The chosen ayah is 94:5, which people remember by its sound and almost never
   by its number. That is the whole argument of the reel, so the content has to
   carry it: a verse nobody can cite is worth more here than a famous one.   */

const FPS = 60;
export const WORDS_FRAMES = 28 * FPS;      // 1680

const S = 2.45;                              // app px -> reel px
const px = (n: number) => Math.round(n * S);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/* Beat boundaries, in frames. Named so the timeline is readable as prose. */
const B = {
  hook:     0,
  hookTwo:  110,
  guessing: 240,
  editor:   480,
  slash:    560,
  arabic:   720,
  picked:   1080,
  message:  1380,
  logo:     1560,
};

/** The verse, and the fragment a person would actually type from memory. */
const AYAH_AR   = "إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا";
const AYAH_PLAIN = "ان مع العسر يسرا";        // no tashkil — how it gets typed
const QUERY      = "مع العسر";                 // what they remember
const AYAH_REF   = "Ash-Sharḥ 94:5";
const AYAH_EN    = "Indeed, with hardship comes ease.";

// ── Beat 1: the hook ───────────────────────────────────────────────────────

const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const a = easeOut(interpolate(f, [6, 26], [0, 1], clamp));
  const b = easeOut(interpolate(f, [B.hookTwo, B.hookTwo + 20], [0, 1], clamp));
  const out = interpolate(f, [B.guessing - 26, B.guessing], [1, 0], clamp);

  return (
    <AbsoluteFill style={{
      background: R.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 26, opacity: out,
    }}>
      <div style={{
        fontFamily: R.fontSerif, fontSize: 66, color: R.ink,
        letterSpacing: "-0.02em",
        opacity: a, transform: `translateY(${(1 - a) * 14}px)`,
      }}>
        You remember the āyah.
      </div>
      <div style={{
        fontFamily: R.fontSerif, fontSize: 66, color: R.ink3,
        letterSpacing: "-0.02em",
        opacity: b, transform: `translateY(${(1 - b) * 14}px)`,
      }}>
        Just not the number.
      </div>
    </AbsoluteFill>
  );
};

// ── Beat 2: guessing at references ─────────────────────────────────────────

/* Three attempts, each typed then rejected. The rejection is a 3px shake and
   the field clearing — no red, no cross. A reference that does not resolve is
   not an error state in the product, it is just a dead end in someone's head. */
const GUESSES = ["2:", "18:", "39:"];

const Guessing: React.FC = () => {
  const f = useCurrentFrame() - B.guessing;
  const each = 74;
  const i = Math.min(GUESSES.length - 1, Math.floor(f / each));
  const local = f - i * each;
  const text = typed(GUESSES[i], local, 0, 11);
  const shake = local > 46 && local < 60 ? Math.sin((local - 46) * 2.2) * 3 : 0;
  const clear = local > 52 ? interpolate(local, [52, 62], [1, 0], clamp) : 1;
  const out = interpolate(f, [B.editor - B.guessing - 24, B.editor - B.guessing], [1, 0], clamp);

  return (
    <AbsoluteFill style={{
      background: R.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: px(26), opacity: out,
    }}>
      <div style={{
        width: px(300), background: R.bgElev,
        border: `1px solid ${R.lineStrong}`, borderRadius: px(14),
        boxShadow: R.shadowMd, padding: `${px(13)}px ${px(16)}px`,
        transform: `translateX(${shake}px)`,
        display: "flex", alignItems: "center",
      }}>
        <span style={{
          fontFamily: R.fontMono, fontSize: px(15), color: R.ink,
          opacity: clear,
        }}>{text}</span>
        <Caret f={f} h={px(17)} />
      </div>
      <div style={{ fontFamily: R.fontSans, fontSize: 34, color: R.ink4 }}>
        Which sūrah was it?
      </div>
    </AbsoluteFill>
  );
};

// ── Beat 3-4: the real editor, /ayah, and the live Arabic search ───────────

/** One result row, built to .qs-row-- ayah's real geometry. */
const Row: React.FC<{ active?: boolean; num: string; ar: React.ReactNode; en: string }> =
  ({ active, num, ar, en }) => (
  <div style={{
    display: "flex", flexDirection: "row", alignItems: "baseline", gap: px(9),
    padding: `${px(7)}px ${px(9)}px`, borderRadius: px(6),
    background: active ? R.hover : "transparent",
  }}>
    <div style={{
      fontFamily: R.fontMono, fontSize: px(11), color: R.ink4, flexShrink: 0,
    }}>{num}</div>
    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: px(2) }}>
      <div style={{
        fontFamily: R.fontArabic, fontSize: px(15), lineHeight: 1.95,
        color: R.ink, direction: "rtl", textAlign: "right",
      }}>{ar}</div>
      <div style={{ fontFamily: R.fontSans, fontSize: px(11.5), color: R.ink3 }}>{en}</div>
    </div>
  </div>
);

const Mark: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{
    background: "rgba(255, 208, 80, 0.42)", borderRadius: 2, padding: "0 2px",
  }}>{children}</span>
);

const Search: React.FC = () => {
  const f = useCurrentFrame();

  // the slash command, then the Arabic query, typed character by character
  const slash = typed("/ayah", f, B.slash, 13);
  const q     = typed(QUERY, f, B.arabic + 16, 7);
  const menuO = easeOut(interpolate(f, [B.slash + 40, B.slash + 58], [0, 1], clamp));
  const panelO = easeOut(interpolate(f, [B.arabic, B.arabic + 16], [0, 1], clamp));

  /* Results narrow as the query grows — the point of the beat is that the
     list responds to WORDS, so it has to visibly respond while typing. */
  const chars = q.replace(/\s/g, "").length;
  const shown = chars === 0 ? 0 : chars < 3 ? 3 : chars < 5 ? 2 : 1;
  const picked = f > B.picked;

  const appear = easeOut(interpolate(f, [B.editor, B.editor + 22], [0, 1], clamp));
  const out = interpolate(f, [B.message - 30, B.message], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ background: R.bg, opacity: out }}>
      {/* The note the search is happening inside — the search never floats
          free of the document in the product, so it must not here either. */}
      <div style={{
        position: "absolute", left: 76, right: 76, top: 612,
        opacity: appear, transform: `translateY(${(1 - appear) * 18}px)`,
      }}>
        <div style={{
          fontFamily: R.fontSerif, fontSize: 52, fontWeight: 700, color: R.ink,
          letterSpacing: "-0.01em", marginBottom: 26,
        }}>
          On hardship
        </div>

        <div style={{
          fontFamily: R.fontSans, fontSize: 34, lineHeight: 1.7, color: R.ink2,
          position: "relative",
        }}>
          {picked ? (
            <span style={{ color: R.ink3 }}>The promise is repeated twice — </span>
          ) : (
            <>
              <span>{slash}</span>
              {f > B.slash && !picked && <Caret f={f} h={38} />}
            </>
          )}

          {/* Slash menu, hanging off the line, as in the product */}
          {menuO > 0 && f < B.arabic && (
            <div style={{
              position: "absolute", top: "100%", left: 0, marginTop: 10,
              width: px(380), background: R.bgElev,
              border: `1px solid ${R.lineStrong}`, borderRadius: px(14),
              boxShadow: R.shadowLg, padding: px(6),
              opacity: menuO, transform: `translateY(${(1 - menuO) * 10}px)`,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: px(11),
                padding: `${px(10)}px ${px(11)}px`, borderRadius: px(5),
                background: R.panel,
              }}>
                <div style={{ fontSize: px(17) }}>◆</div>
                <div>
                  <div style={{ fontFamily: R.fontSans, fontSize: px(14), fontWeight: 600, color: R.ink }}>
                    Insert āyah
                  </div>
                  <div style={{ fontFamily: R.fontSans, fontSize: px(11.5), color: R.ink3, marginTop: 2 }}>
                    Search the Qurʾān and embed the verse
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* The inserted āyah block — the real thing has reference, Arabic and
            translation, which is exactly the argument against a bare "94:5". */}
        {picked && (
          <AyahBlock f={f} />
        )}
      </div>

      {/* The search panel — .qs-panel, at the app's own metrics */}
      {panelO > 0 && !picked && (
        <div style={{
          position: "absolute", left: 76, top: 884,
          width: px(380), background: R.bgElev,
          border: `1px solid ${R.lineStrong}`, borderRadius: px(14),
          boxShadow: R.shadowLg, overflow: "hidden",
          opacity: panelO, transform: `translateY(${(1 - panelO) * 12}px)`,
        }}>
          <div style={{
            borderBottom: `1px solid ${R.line}`,
            padding: `${px(11)}px ${px(14)}px`,
            display: "flex", alignItems: "center",
          }}>
            <span style={{
              fontFamily: R.fontArabic, fontSize: px(15), color: R.ink,
              direction: "rtl",
            }}>{q}</span>
            {!q && (
              <span style={{ fontFamily: R.fontSans, fontSize: px(14), color: R.ink4 }}>
                Search the Qurʾān…
              </span>
            )}
            <Caret f={f} h={px(17)} />
          </div>

          <div style={{ padding: px(4), minHeight: px(90) }}>
            {shown === 0 && (
              <div style={{
                padding: px(14), fontFamily: R.fontSans, fontSize: px(12.5),
                color: R.ink4, textAlign: "center",
              }}>
                Type a word you remember
              </div>
            )}
            {shown >= 1 && (
              <Row active num="94:5"
                   ar={<>إِنَّ{" "}<Mark>مَعَ ٱلْعُسْرِ</Mark>{" "}يُسْرًا</>}
                   en="Ash-Sharḥ · Indeed, with hardship comes ease" />
            )}
            {shown >= 2 && (
              <Row num="94:6"
                   ar={<>فَإِنَّ{" "}<Mark>مَعَ ٱلْعُسْرِ</Mark>{" "}يُسْرًا</>}
                   en="Ash-Sharḥ · So indeed, with hardship comes ease" />
            )}
            {shown >= 3 && (
              <Row num="65:7"
                   ar={<>سَيَجْعَلُ ٱللَّهُ بَعْدَ عُسْرٍ يُسْرًا</>}
                   en="Aṭ-Ṭalāq · Allah will bring ease after hardship" />
            )}
          </div>
        </div>
      )}

      <SearchCursor />
    </AbsoluteFill>
  );
};

/** The embedded block: reference, Arabic, translation — a Qur'anic object,
 *  not a string of digits. */
const AyahBlock: React.FC<{ f: number }> = ({ f }) => {
  const a = easeOut(interpolate(f, [B.picked, B.picked + 20], [0, 1], clamp));
  return (
    <div style={{
      marginTop: 26, borderLeft: `3px solid ${R.accent}`,
      background: R.panel, borderRadius: px(8),
      padding: `${px(14)}px ${px(16)}px`,
      opacity: a, transform: `translateY(${(1 - a) * 16}px) scale(${0.985 + a * 0.015})`,
    }}>
      <div style={{
        fontFamily: R.fontMono, fontSize: px(11), color: R.accentInk,
        letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: px(9),
      }}>{AYAH_REF}</div>
      <div style={{
        fontFamily: R.fontArabic, fontSize: px(23), lineHeight: 2.0,
        color: R.ink, direction: "rtl", textAlign: "right", marginBottom: px(8),
      }}>{AYAH_AR}</div>
      <div style={{ fontFamily: R.fontSerif, fontSize: px(13.5), color: R.ink2 }}>
        {AYAH_EN}
      </div>
    </div>
  );
};

/** Cursor arrives before the click and lingers after — never parked. */
const SearchCursor: React.FC = () => {
  const f = useCurrentFrame();
  if (f < B.arabic + 120 || f > B.picked + 60) return null;
  const t = interpolate(f, [B.arabic + 120, B.picked - 10], [0, 1], clamp);
  const e = easeOut(t);
  const x = 640 + (300 - 640) * e;
  const y = 1460 + (1120 - 1460) * e;
  const click = f > B.picked - 12 && f < B.picked + 10 ? 1 : 0;
  return <Cursor x={x} y={y + Math.sin(f / 9) * 2} click={click} />;
};

// ── Beat 5: the message, and the mark ──────────────────────────────────────

const Message: React.FC = () => {
  const f = useCurrentFrame() - B.message;
  const a = easeOut(interpolate(f, [8, 30], [0, 1], clamp));
  const rule = interpolate(f, [34, 72], [0, 300], clamp);
  const logo = easeOut(interpolate(f, [B.logo - B.message, B.logo - B.message + 24], [0, 1], clamp));

  return (
    <AbsoluteFill style={{
      background: R.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        fontFamily: R.fontSerif, fontSize: 68, color: R.ink,
        textAlign: "center", letterSpacing: "-0.02em", textWrap: "balance",
        maxWidth: 820, lineHeight: 1.28,
        opacity: a, transform: `translateY(${(1 - a) * 16}px)`,
      }}>
        Search by the words<br />you remember.
      </div>

      <div style={{ width: rule, height: 2, background: R.accent, borderRadius: 2, marginTop: 54 }} />

      <div style={{
        marginTop: 54, display: "flex", alignItems: "center", gap: 16,
        opacity: logo, transform: `translateY(${(1 - logo) * 10}px)`,
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13,
          border: `2px solid ${R.ink2}`, color: R.ink2,
          display: "grid", placeItems: "center",
          fontFamily: R.fontSans, fontSize: 24, fontWeight: 700,
        }}>T</div>
        <div style={{ fontFamily: R.fontSerif, fontSize: 38, color: R.ink }}>
          TafsirLab
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Assembly ───────────────────────────────────────────────────────────────

/* The beats read ABSOLUTE frames — every B.* above is a position on the reel's
   own timeline, which is what makes the file readable as a storyboard. Wrapping
   them in <Sequence> would rebase useCurrentFrame() to zero inside each one and
   silently shift every cue, so the visual beats are gated by window instead.
   The audio below stays in Sequences, where `from` is exactly the right idea. */
const Beat: React.FC<{ from: number; to: number; children: React.ReactNode }> =
  ({ from, to, children }) => {
    const f = useCurrentFrame();
    if (f < from || f >= to) return null;
    return <AbsoluteFill>{children}</AbsoluteFill>;
  };

export const WordsNotNumber: React.FC = () => (
  <AbsoluteFill style={{ background: R.bg }}>
    <Beat from={0} to={B.guessing}><Hook /></Beat>
    <Beat from={B.guessing} to={B.editor}><Guessing /></Beat>
    <Beat from={B.editor} to={B.message}><Search /></Beat>
    <Beat from={B.message} to={WORDS_FRAMES}><Message /></Beat>

    {/* Sound: every cue lands on a visible action, nothing decorative. */}
    <Sequence from={B.guessing} durationInFrames={240}>
      <Audio src={staticFile("sfx/typing.mp3")} volume={0.22} />
    </Sequence>
    <Sequence from={B.slash} durationInFrames={80}>
      <Audio src={staticFile("sfx/typing.mp3")} volume={0.26} />
    </Sequence>
    <Sequence from={B.slash + 40} durationInFrames={30}>
      <Audio src={staticFile("sfx/click.mp3")} volume={0.3} />
    </Sequence>
    <Sequence from={B.arabic + 16} durationInFrames={180}>
      <Audio src={staticFile("sfx/typing.mp3")} volume={0.24} />
    </Sequence>
    <Sequence from={B.picked - 10} durationInFrames={40}>
      <Audio src={staticFile("sfx/granular-select.mp3")} volume={0.34} />
    </Sequence>
    <Sequence from={B.message} durationInFrames={60}>
      <Audio src={staticFile("sfx/land.mp3")} volume={0.28} />
    </Sequence>
  </AbsoluteFill>
);
