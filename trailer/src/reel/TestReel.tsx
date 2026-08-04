import React from "react";
import {
  AbsoluteFill, Sequence, Audio, staticFile,
  useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import { typed, typeEnd } from "./parts";
import { Wheel, type Edge } from "./Wheel";
import {
  STAGE, FRAME_W, FRAME_H, morphAt, Card, Words, Rise, Focus, rack,
  SmearCursor, type MState, type Leg,
} from "./morph";

/* ── One container, eight states, back to the start ────────────────────────
   A test of the technique measured in trailer/MOTION-STUDY.md. There is a
   single rounded rectangle on a stage for the whole 15 seconds. It becomes the
   wordmark, the note, the slash menu, the Create Connection form, the saved
   Connection, and the Connections map — resizing and swapping its content
   under a blur, never cutting — then shrinks back to the wordmark it started
   as, so the last frame loops seamlessly into frame 0.

   Every state's height is its CONTENT height plus padding, computed below.
   Sizing a state for what a later state will need is what leaves a card half
   empty, and an empty card is the tell that the UI was cropped rather than
   built for the frame.                                                      */

export const TEST_FRAMES = 910;   // 15.2s @ 60fps
const FPS = 60;

/* Note layout. `slashY` sits directly under the last line of the note, so the
   command line belongs to the document instead of floating in a gap. */
const NOTE = { pad: 40, slashY: 224, lineH: 40, menuGap: 12, menuH: 96 };
const NOTE_H = {
  plain: NOTE.slashY + NOTE.pad,                                    // 264
  slash: NOTE.slashY + NOTE.lineH + NOTE.pad,                       // 304
  menu:  NOTE.slashY + NOTE.lineH + NOTE.menuGap + NOTE.menuH + NOTE.pad, // 412
};

/* Modal layout — field tops, not label tops, so a click target is exact. */
const MOD = {
  pad: 44,
  nameLab: 150, nameFld: 177, nameH: 62,
  commLab: 300, commFld: 327, commH: 100,
  catLab: 470,  catRow: 497,  catH: 62,
  btnY: 590, btnH: 70, btnW: 240,
};
const MOD_H = MOD.btnY + MOD.btnH + MOD.pad;   // 704

const SAVED_H = 180;

/* Morph length is a function of how far the container travels, exactly as
   measured: <200px resolves in 24 frames, <600px in 32, beyond that 40.
   Choosing per transition by feel is what makes a morph chain feel arbitrary.

   S0.morph is never used as a transition (nothing precedes it); it only
   backdates the content arrival so frame 0 is already settled, which the loop
   requires. */
const S: MState[] = [
  { key: "brand", at: 0,   morph: 120, w: 420, h: 132,       r: 66 },
  { key: "note",  at: 84,  morph: 32,  w: 800, h: NOTE_H.plain, r: 22 },
  { key: "slash", at: 190, morph: 24,  w: 800, h: NOTE_H.slash, r: 22 },
  { key: "menu",  at: 300, morph: 24,  w: 800, h: NOTE_H.menu,  r: 22 },
  { key: "modal", at: 410, morph: 32,  w: 840, h: MOD_H,     r: 22 },
  { key: "saved", at: 560, morph: 32,  w: 800, h: SAVED_H,   r: 22 },
  { key: "wheel", at: 700, morph: 40,  w: 900, h: 900,       r: 30 },
  { key: "brand", at: 890, morph: 40,  w: 420, h: 132,       r: 66 },
];

const CMD = "/link";
const NAME = "The seven oft-repeated verses";

const T = {
  slashStart: 206, slashCps: 0.10,
  nameStart:  424, nameCps:  0.40,
  catRack:    506,
} as const;
const T_END = {
  slash: typeEnd(CMD, T.slashStart, T.slashCps),
  name:  typeEnd(NAME, T.nameStart, T.nameCps),
};

const cardLeft = (w: number) => FRAME_W / 2 - w / 2;
const cardTop = (h: number) => FRAME_H / 2 - h / 2;

/** Clicks are derived from the layout constants, never typed in by hand. */
const LEGS: Leg[] = [
  { at: 0,   to: { x: 900, y: 1500 } },
  { at: 150, to: { x: 880, y: 1430 } },
  { at: 196, to: { x: cardLeft(800) + NOTE.pad + 26,
                   y: cardTop(NOTE_H.slash) + NOTE.slashY + NOTE.lineH / 2 }, click: true },
  { at: 336, to: { x: cardLeft(800) + NOTE.pad + 190,
                   y: cardTop(NOTE_H.menu) + NOTE.slashY + NOTE.lineH + NOTE.menuGap + 46 } },
  { at: 378, to: { x: cardLeft(800) + NOTE.pad + 190,
                   y: cardTop(NOTE_H.menu) + NOTE.slashY + NOTE.lineH + NOTE.menuGap + 50 }, click: true },
  { at: 424, to: { x: cardLeft(840) + MOD.pad + 110,
                   y: cardTop(MOD_H) + MOD.nameFld + MOD.nameH / 2 }, click: true },
  { at: 502, to: { x: cardLeft(840) + MOD.pad + 150,
                   y: cardTop(MOD_H) + MOD.catRow + MOD.catH / 2 }, click: true },
  { at: 524, to: { x: cardLeft(840) + 840 - MOD.pad - MOD.btnW / 2,
                   y: cardTop(MOD_H) + MOD.btnY + MOD.btnH / 2 }, click: true },
  { at: 620, to: { x: 890, y: 1420 } },
  { at: 770, to: { x: 930, y: 1540 } },
];

const LINKS: Edge[] = [
  { a: 1, b: 15 },  { a: 2, b: 8 },   { a: 4, b: 24 },  { a: 7, b: 20 },
  { a: 12, b: 40 }, { a: 18, b: 31 }, { a: 55, b: 2 },  { a: 67, b: 29 },
  { a: 36, b: 50 }, { a: 9, b: 47 },  { a: 76, b: 91 }, { a: 22, b: 59 },
  { a: 44, b: 88 }, { a: 6, b: 105 }, { a: 13, b: 72 }, { a: 28, b: 64 },
];
const WHEEL_IN = 700;
const DRAW_FOR = 26;
/** The first chords begin during the morph in, so the map arrives already
 *  alive rather than empty; the last one finishes before the closing morph. */
const STARTS = LINKS.map((_, i) => WHEEL_IN - 8 + i * 8);

/* ── Content for each state ───────────────────────────────────────────────*/

const Brand: React.FC<{ f: number; s: number }> = ({ f, s }) => (
  <div style={{
    height: "100%", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 16,
  }}>
    <Rise f={f} start={s} i={0}>
      <div style={{
        width: 56, height: 56, borderRadius: 15, background: R.ink, color: R.bg,
        display: "grid", placeItems: "center",
        fontFamily: R.fontSans, fontSize: 28, fontWeight: 700,
      }}>T</div>
    </Rise>
    <div style={{ fontFamily: R.fontSerif, fontSize: 44, color: R.ink, letterSpacing: "-0.02em" }}>
      <Words f={f} start={s + 4} text="Tafsir Lab" step={7} />
    </div>
  </div>
);

const Note: React.FC<{
  f: number; s: number; slash?: string; caret?: boolean; menu?: number;
}> = ({ f, s, slash, caret, menu }) => (
  <div style={{ padding: NOTE.pad, position: "relative", height: "100%" }}>
    <div style={{
      fontFamily: R.fontSerif, fontSize: 38, fontWeight: 700,
      color: R.ink, letterSpacing: "-0.01em", lineHeight: 1.2,
    }}>
      <Words f={f} start={s} text="As-Sabʿ al-Mathānī" step={9} />
    </div>

    <Rise f={f} start={s} i={1} style={{
      fontFamily: R.fontSans, fontSize: 23, color: R.ink3, marginTop: 10,
    }}>
      Seven verses, repeated in every rakʿah.
    </Rise>

    <Rise f={f} start={s} i={2} style={{
      borderLeft: `3px solid ${R.line}`, paddingLeft: 18, marginTop: 20,
    }}>
      <div dir="rtl" style={{
        fontFamily: R.fontArabic, fontSize: 32, lineHeight: 1.9,
        color: R.ink, textAlign: "right",
      }}>
        وَلَقَدْ آتَيْنَاكَ سَبْعًا مِّنَ الْمَثَانِي
      </div>
    </Rise>

    {slash !== undefined && (
      <div style={{ position: "absolute", left: NOTE.pad, top: NOTE.slashY, right: NOTE.pad }}>
        <div style={{
          fontFamily: R.fontSans, fontSize: 30, color: R.accentInk,
          height: NOTE.lineH, display: "flex", alignItems: "center",
        }}>
          {slash}
          {caret && (
            <span style={{
              display: "inline-block", width: 2, height: 30, background: R.ink,
              marginLeft: 3,
              opacity: Math.floor(f / 18) % 2 === 0 ? 1 : 0,
            }} />
          )}
        </div>

        {menu !== undefined && menu > 0 && (
          <div style={{
            marginTop: NOTE.menuGap, opacity: menu, width: 520, height: NOTE.menuH,
            background: R.bgElev, border: `1px solid ${R.lineStrong}`,
            borderRadius: R.radiusMd, boxShadow: R.shadowLg, padding: 10,
            boxSizing: "border-box",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 14, height: "100%",
              padding: "0 14px", borderRadius: R.radiusSm, background: R.panel,
              boxSizing: "border-box",
            }}>
              <div style={{ fontSize: 24, color: R.iconLink }}>🔗</div>
              <div>
                <div style={{ fontFamily: R.fontSans, fontSize: 22, fontWeight: 600, color: R.ink }}>
                  Link Qurʾanic passage
                </div>
                <div style={{ fontFamily: R.fontSans, fontSize: 16, color: R.ink3, marginTop: 2 }}>
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

const Lab: React.FC<{ top: number; children: React.ReactNode }> = ({ top, children }) => (
  <div style={{
    position: "absolute", left: MOD.pad, top,
    fontFamily: R.fontSans, fontSize: 14, letterSpacing: "0.09em",
    textTransform: "uppercase", color: R.ink4,
  }}>{children}</div>
);

const CATS = ["Naẓm", "Tafsīr", "Lughah"];

const Modal: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  const name = typed(NAME, f, T.nameStart, T.nameCps);
  const typing = f >= T.nameStart && f < T_END.name + 30;
  /* Rack focus: the fields go soft as attention moves to the category row.
     Blur used to point at something, not to cover a cut. */
  const toCat = rack(f, T.catRack, 20);
  const field: React.CSSProperties = {
    border: `1px solid ${R.lineStrong}`, borderRadius: R.radius,
    background: R.bg, padding: "0 18px", boxSizing: "border-box",
    fontFamily: R.fontSans, color: R.ink,
    display: "flex", alignItems: "center",
  };
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div style={{
        position: "absolute", left: MOD.pad, top: MOD.pad,
        fontFamily: R.fontSerif, fontSize: 34, fontWeight: 700, color: R.ink,
      }}>
        <Words f={f} start={s} text="Create Connection" step={9} />
      </div>

      <Focus on={1 - toCat * 0.75}>
        <Lab top={MOD.nameLab}>Name</Lab>
        <div style={{
          ...field,
          position: "absolute", left: MOD.pad, right: MOD.pad,
          top: MOD.nameFld, height: MOD.nameH, fontSize: 23,
          borderColor: typing ? R.accent : R.lineStrong,
          boxShadow: typing ? `0 0 0 4px ${R.accentSoft}` : "none",
        }}>
          {name}
          {typing && (
            <span style={{
              display: "inline-block", width: 2, height: 25, background: R.ink,
              marginLeft: 3,
              opacity: Math.floor(f / 16) % 2 === 0 ? 1 : 0,
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
          fontSize: 21, color: R.ink2, lineHeight: 1.5,
        }}>
          Al-Fātiḥah is referred to here in Sūrah al-Ḥijr.
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
                background: on ? R.accent : R.panel,
                color: on ? "#fff" : R.ink2,
                border: `1px solid ${on ? R.accent : R.lineStrong}`,
              }}>{c}</div>
            );
          })}
        </div>
      </Focus>

      <div style={{
        position: "absolute", right: MOD.pad, top: MOD.btnY,
        width: MOD.btnW, height: MOD.btnH, borderRadius: R.radius,
        background: R.ink, color: R.bg,
        display: "grid", placeItems: "center",
        fontFamily: R.fontSans, fontSize: 21, fontWeight: 600,
      }}>Create Connection</div>
    </div>
  );
};

const Saved: React.FC<{ f: number; s: number }> = ({ f, s }) => (
  <div style={{ padding: 36, height: "100%", display: "flex", alignItems: "center" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 18, width: "100%" }}>
      <Rise f={f} start={s} i={0}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: R.accentSoft,
          display: "grid", placeItems: "center", fontSize: 26, color: R.iconLink,
        }}>🔗</div>
      </Rise>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: R.fontSans, fontSize: 27, fontWeight: 600, color: R.ink, lineHeight: 1.25,
        }}>
          <Words f={f} start={s} text="The seven oft-repeated verses" step={6} />
        </div>
        <Rise f={f} start={s} i={2} style={{
          display: "flex", gap: 10, marginTop: 12, alignItems: "center",
        }}>
          {["Al-Fātiḥah 1:1", "Al-Ḥijr 15:87"].map((v, i) => (
            <React.Fragment key={v}>
              {i > 0 && <span style={{ color: R.ink4, fontSize: 19 }}>↔</span>}
              <span style={{
                fontFamily: R.fontSans, fontSize: 18, color: R.accentInk,
                background: R.accentSoft, padding: "7px 14px", borderRadius: 999,
              }}>{v}</span>
            </React.Fragment>
          ))}
          <span style={{
            fontFamily: R.fontSans, fontSize: 17, color: R.ink3,
            background: R.panel, padding: "7px 14px", borderRadius: 999, marginLeft: 4,
          }}>Tafsīr</span>
        </Rise>
      </div>
    </div>
  </div>
);

const Map: React.FC<{ f: number; s: number }> = ({ f, s }) => (
  <div style={{ padding: "22px 26px 26px", height: "100%", display: "flex", flexDirection: "column" }}>
    <div style={{
      fontFamily: R.fontSerif, fontSize: 29, fontWeight: 700, color: R.ink,
      textAlign: "center",
    }}>
      <Words f={f} start={s} text="Connections" step={9} />
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>
      <Wheel t={f} edges={LINKS} starts={STARTS} drawFor={DRAW_FOR}
        build={false} ringIn={{ at: WHEEL_IN - 26, over: 34 }}
        linkW={2.6} linkOpacity={0.72} />
    </div>
  </div>
);

/* ── Composition ──────────────────────────────────────────────────────────*/

const Body: React.FC = () => {
  const f = useCurrentFrame();
  const m = morphAt(f, S);

  const render = (key: string, start: number) => {
    switch (key) {
      case "brand": return <Brand f={f} s={start} />;
      case "note":  return <Note f={f} s={start} />;
      case "slash": return (
        <Note f={f} s={start} caret
          slash={typed(CMD, f, T.slashStart, T.slashCps)} />
      );
      case "menu":  return (
        <Note f={f} s={start} caret slash={CMD}
          menu={interpolate(f, [S[3].at - 10, S[3].at + 12], [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      );
      case "modal": return <Modal f={f} s={start} />;
      case "saved": return <Saved f={f} s={start} />;
      case "wheel": return <Map f={f} s={start} />;
      default: return null;
    }
  };

  /* No cursor at the head or tail — the references show none over the
     wordmark, and it keeps the last frame identical to frame 0. */
  const cur = interpolate(f, [96, 130, 780, 812], [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Card m={m}>
        {m.old && m.old.opacity > 0.01 && (
          <div style={{
            position: "absolute", inset: 0,
            opacity: m.old.opacity,
            transform: `translateX(${m.old.x}px)`,
            filter: m.old.blur > 0.05 ? `blur(${m.old.blur}px)` : undefined,
          }}>
            {render(m.old.key, -999)}
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, opacity: m.now.opacity }}>
          {render(m.now.key, m.contentStart)}
        </div>
      </Card>

      {cur > 0.01 && (
        <div style={{ opacity: cur }}>
          <SmearCursor f={f} legs={LEGS} />
        </div>
      )}
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ at: number; file: string; v: number; len?: number }> =
({ at, file, v, len = 26 }) => (
  <Sequence from={at} durationInFrames={len}>
    <Audio src={staticFile(file)} volume={v} />
  </Sequence>
);

export const TestReel: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <Body />

    <Audio
      src={staticFile("bg.mp3")}
      volume={(f) =>
        0.28 * interpolate(f, [0, 120, TEST_FRAMES - 120, TEST_FRAMES], [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />

    <Sequence from={T.slashStart} durationInFrames={T_END.slash - T.slashStart + 10}>
      <Audio src={staticFile("sfx/typing.mp3")} volume={0.34} />
    </Sequence>
    <Sequence from={T.nameStart} durationInFrames={T_END.name - T.nameStart + 10}>
      <Audio src={staticFile("sfx/typing.mp3")} volume={0.38} />
    </Sequence>

    {LEGS.filter((l) => l.click).map((l) => (
      <Sfx key={l.at} at={l.at} file="sfx/click.mp3" v={0.42} len={18} />
    ))}

    <Sfx at={S[6].at - S[6].morph} file="sfx/whoosh.mp3" v={0.46} len={54} />
    <Sfx at={S[7].at - S[7].morph} file="sfx/whoosh.mp3" v={0.34} len={48} />
  </AbsoluteFill>
);
