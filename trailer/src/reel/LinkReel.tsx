import React from "react";
import {
  AbsoluteFill, Sequence, Audio, staticFile,
  useCurrentFrame, interpolate, spring, useVideoConfig,
} from "remotion";
import { R } from "../reelTokens";
import {
  World, Cursor, cursorAt, shotAt, typed, typeEnd, Overlay,
  type Shot, APP_W, APP_H, MAP_TOP,
} from "./parts";
import {
  EditorPage, MapPage, NoteBody, ConnectionModal, SavedCard, MODAL,
} from "./AppUI";
import { Wheel, type Edge } from "./Wheel";

/** Brand open, then the continuous take. */
export const START = 160;
export const REEL_FRAMES = START + 1560;   // 28.7s @ 60fps
const FPS = 60;

/* ── One continuous take ───────────────────────────────────────────────────
   There are no scenes. The editor and the Connections page are stacked in ONE
   world and a single camera travels through it, so the interface never resets,
   re-crops or re-scales between steps — the same document, the same cursor,
   the same product throughout.

     0 –  4s  tight in the editor: cursor moves left, /link, menu opens
     4 –  9s  the modal in ONE shot: name, commentary, category
     9 – 12s  Create is clicked; the Connection lands in the note
    12 – 21s  that link extends out of the note and becomes a chord on the map;
              the SAME wheel stays on screen while the rest draw in
    21 – 24s  slow push into the finished map
    24 – 26s  end card                                                        */

const CMD  = "/link";
const NAME = "The seven oft-repeated verses";
const COMM = "Al-Fātiḥah is referred to here in Sūrah al-Ḥijr.";

const T = {
  clickLine:   58,
  slashStart:  84,  slashCps: 0.075,
  menuIn:      152,
  clickMenu:   206,

  modalOpen:   244,
  clickName:   280, nameStart: 290, nameCps: 0.40,
  clickComm:   372, commStart: 382, commCps: 0.72,
  clickCat:    460, catOn:     470,
  clickCreate: 496,

  savedIn:     538,
  /** The link leaves the note and reaches the ring. */
  bridgeStart: 700, bridgeFor: 260,
  mapArrive:   1030,
  endCard:     1440,
} as const;

const T_END = {
  slash: typeEnd(CMD,  T.slashStart, T.slashCps),
  name:  typeEnd(NAME, T.nameStart,  T.nameCps),
  comm:  typeEnd(COMM, T.commStart,  T.commCps),
};

/* ── Camera — one keyframed move; every beat has a reason ─────────────────
   It follows the cursor to the caret, the menu as it opens, the modal, the
   saved Connection, then the link itself down to the map. */
const CAM: { at: number; shot: Shot }[] = [
  { at: 0,             shot: { x: 300, y: 424, s: 1.66 } },
  { at: T.clickLine,   shot: { x: 292, y: 438, s: 1.70 } },
  { at: T.menuIn,      shot: { x: 330, y: 476, s: 1.52 } },
  { at: T.modalOpen,   shot: { x: 380, y: 560, s: 1.46 } },
  { at: T.clickName,   shot: { x: 380, y: 640, s: 1.50 } },
  { at: T.clickCat,    shot: { x: 380, y: 760, s: 1.48 } },
  { at: T.clickCreate, shot: { x: 380, y: 900, s: 1.46 } },
  { at: T.savedIn,     shot: { x: 380, y: 520, s: 1.44 } },
  { at: T.bridgeStart, shot: { x: 380, y: 580, s: 1.40 } },
  { at: 880,           shot: { x: 400, y: 1320, s: 1.30 } },
  { at: T.mapArrive,   shot: { x: 380, y: 2420, s: 1.44 } },
  { at: 1240,          shot: { x: 380, y: 2450, s: 1.42 } },
  { at: T.endCard,     shot: { x: 380, y: 2450, s: 1.52 } },
];

const LINKS: Edge[] = [
  { a: 1, b: 15 },  { a: 2, b: 8 },   { a: 4, b: 24 },  { a: 7, b: 20 },
  { a: 12, b: 40 }, { a: 18, b: 31 }, { a: 55, b: 2 },  { a: 67, b: 29 },
  { a: 36, b: 50 }, { a: 9, b: 47 },  { a: 3, b: 3 },   { a: 76, b: 91 },
  { a: 22, b: 59 }, { a: 44, b: 88 }, { a: 6, b: 105 }, { a: 13, b: 72 },
  { a: 28, b: 64 }, { a: 19, b: 83 },
];
/** The first is the Connection just made; the rest draw onto the SAME wheel. */
const STARTS = LINKS.map((_, i) => (i === 0 ? T.mapArrive - 24 : T.mapArrive + 46 + (i - 1) * 21));

const WheelSlot: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", left: 26, right: 26, top: 300, height: 708 }}>
    {children}
  </div>
);

/**
 * The link leaving the note.
 *
 * One stroke drawn in WORLD space from the saved Connection down to the ring,
 * so the thing created in the editor is visibly the thing that appears on the
 * map. The two pages are one space, not two screenshots.
 */
const Bridge: React.FC<{ f: number }> = ({ f }) => {
  const p = interpolate(f, [T.bridgeStart, T.bridgeStart + T.bridgeFor], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fade = interpolate(f, [T.mapArrive - 30, T.mapArrive + 24], [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (p <= 0 || fade <= 0) return null;
  const LEN = 2400;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, width: APP_W, height: APP_H, zIndex: 300 }}
      viewBox={`0 0 ${APP_W} ${APP_H}`}>
      <path
        d={`M300 616 C300 1120, 660 1560, 470 ${MAP_TOP + 430}`}
        fill="none" stroke={R.accent} strokeWidth={3} strokeLinecap="round"
        strokeOpacity={0.6 * fade}
        strokeDasharray={LEN} strokeDashoffset={LEN * (1 - p)} />
    </svg>
  );
};

const EndCard: React.FC<{ f: number }> = ({ f }) => {
  const o = interpolate(f, [T.endCard, T.endCard + 24], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (o <= 0) return null;
  const s = spring({ frame: f - T.endCard, fps: FPS, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{
      background: R.bg, opacity: o, zIndex: 980,
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center", transform: `translateY(${(1 - s) * 14}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, justifyContent: "center" }}>
          <div style={{
            width: 86, height: 86, borderRadius: 20, background: R.ink, color: R.bg,
            display: "grid", placeItems: "center",
            fontFamily: R.fontSans, fontSize: 42, fontWeight: 700,
          }}>T</div>
          <div style={{ fontFamily: R.fontSerif, fontSize: 68, color: R.ink, letterSpacing: "-0.02em" }}>
            Tafsir<span style={{ fontStyle: "italic" }}>Lab</span>
          </div>
        </div>
        <div style={{ fontFamily: R.fontSans, fontSize: 32, color: R.ink2, marginTop: 38 }}>
          Connect. Study. Reflect.
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 16, margin: "36px auto 0", width: 330,
        }}>
          <div style={{ flex: 1, height: 1, background: R.line }} />
          <div style={{ color: R.ink4, fontSize: 14 }}>◆</div>
          <div style={{ flex: 1, height: 1, background: R.line }} />
        </div>
        <div style={{ fontFamily: R.fontSans, fontSize: 25, color: R.accent, marginTop: 26 }}>
          Join the waitlist.
        </div>
      </div>
    </AbsoluteFill>
  );
};


/* ── Start screen ─────────────────────────────────────────────────────────
   The product's own opening, in the same language as the trailer: the mark
   springs in, the name follows, then the one line that says what this is.
   It dissolves straight into the editor, so the reel still begins inside
   TafsirLab rather than on an unrelated graphic. */
const StartScreen: React.FC = () => {
  const f = useCurrentFrame();
  const mark  = spring({ frame: f - 6, fps: FPS, config: { damping: 14, stiffness: 120 } });
  const name  = interpolate(f, [30, 56], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line  = interpolate(f, [56, 84], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rule  = interpolate(f, [80, 118], [0, 150], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out   = interpolate(f, [START - 34, START], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: R.bg, opacity: out, zIndex: 970,
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 104, height: 104, borderRadius: 26, background: R.ink, color: R.bg,
          display: "grid", placeItems: "center", margin: "0 auto 40px",
          fontFamily: R.fontSans, fontSize: 50, fontWeight: 700,
          transform: `scale(${mark})`, boxShadow: R.shadowMd,
        }}>T</div>

        <div style={{
          fontFamily: R.fontSerif, fontSize: 76, color: R.ink,
          letterSpacing: "-0.025em", lineHeight: 1,
          opacity: name, transform: `translateY(${(1 - name) * 12}px)`,
        }}>
          Tafsir<span style={{ fontStyle: "italic" }}>Lab</span>
        </div>

        <div style={{
          fontFamily: R.fontSans, fontSize: 30, color: R.ink3,
          marginTop: 26, lineHeight: 1.4, maxWidth: 760,
          opacity: line, transform: `translateY(${(1 - line) * 10}px)`,
        }}>
          Connect any two passages<br />of the Qurʾān.
        </div>

        <div style={{
          width: rule, height: 2, background: R.accent,
          borderRadius: 2, margin: "40px auto 0",
        }} />
      </div>
    </AbsoluteFill>
  );
};

// ── The reel ──────────────────────────────────────────────────────────────

const Reel: React.FC = () => {
  const f = useCurrentFrame();

  const cmd  = typed(CMD,  f, T.slashStart, T.slashCps);
  const name = typed(NAME, f, T.nameStart,  T.nameCps);
  const comm = typed(COMM, f, T.commStart,  T.commCps);

  const menu = f >= T.menuIn && f < T.modalOpen
    ? spring({ frame: f - T.menuIn, fps: FPS, config: { damping: 200 } }) : 0;

  const modal = interpolate(
    f, [T.modalOpen, T.modalOpen + 18, T.clickCreate + 10, T.clickCreate + 26],
    [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const focus =
    f >= T.clickName && f < T.clickComm ? "name" as const
    : f >= T.clickComm && f < T.clickCat ? "comm" as const
    : f >= T.clickCat  && f < T.clickCreate ? "cat" as const
    : null;

  const card = f >= T.savedIn
    ? spring({ frame: f - T.savedIn, fps: FPS, config: { damping: 200 } }) : 0;

  /* Counters read the SAME list the wheel draws from, so the number can never
     disagree with what is on the ring. */
  const drawn = LINKS.filter((_, i) => f >= STARTS[i] + 16).length;
  const surahs = new Set<number>();
  LINKS.forEach((e, i) => { if (f >= STARTS[i] + 16) { surahs.add(e.a); surahs.add(e.b); } });

  const cur = cursorAt(f, [
    { at: 0,                  to: { x: 470, y: 300 } },
    { at: T.clickLine,        to: { x: 96,  y: 438 }, click: true },
    { at: T.clickMenu - 16,   to: { x: 210, y: 500 } },
    { at: T.clickMenu,        to: { x: 210, y: 500 }, click: true },
    { at: T.clickName,        to: { x: 250, y: MODAL.nameY }, click: true },
    { at: T.clickComm,        to: { x: 250, y: MODAL.commY }, click: true },
    { at: T.clickCat,         to: { x: 250, y: MODAL.catY  }, click: true },
    { at: T.clickCreate - 14, to: { x: MODAL.btnX, y: MODAL.btnY } },
    { at: T.clickCreate,      to: { x: MODAL.btnX, y: MODAL.btnY }, click: true },
    { at: T.savedIn + 40,     to: { x: 470, y: 650 } },
  ]);

  /* Depth while the camera TRAVELS, flat while you are reading or typing:
     motion carries weight, stillness stays legible. */
  const tilt = interpolate(f,
    [T.savedIn + 30, 880, T.mapArrive, T.mapArrive + 60],
    [0, 0.55, 0.35, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: R.bg }}>
      <World shot={shotAt(f, CAM)} tilt={tilt}>
        {/* ── The editor ── */}
        <div style={{ position: "absolute", left: 0, top: 0, width: APP_W }}>
          <EditorPage>
            <NoteBody
              f={f}
              slash={f >= T.modalOpen ? CMD : cmd}
              caret={f > T.clickLine && f < T.modalOpen}
              menu={menu}
              saved={card > 0 ? <SavedCard o={card} /> : undefined}
            />
            {modal > 0 && (
              <ConnectionModal
                o={modal} f={f}
                name={name} commentary={comm}
                category={f > T.catOn} tags=""
                focus={focus}
                pressed={f >= T.clickCreate && f < T.clickCreate + 12}
              />
            )}
          </EditorPage>
        </div>

        {/* ── The same link, leaving the note ── */}
        <Bridge f={f} />

        {/* ── The Connections page, below, in the same world ── */}
        <div style={{ position: "absolute", left: 0, top: MAP_TOP, width: APP_W }}>
          <MapPage count={Math.max(1, drawn)} surahs={Math.max(2, surahs.size)}>
            <WheelSlot>
              <Wheel t={f} edges={LINKS} starts={STARTS} drawFor={26}
                build={false} ringIn={{ at: T.mapArrive - 110, over: 70 }} />
            </WheelSlot>
          </MapPage>
        </div>

        <Cursor x={cur.x} y={cur.y} click={cur.click} />
      </World>

      {/* Short labels only — the action carries the meaning */}
      <Overlay f={f} in_={16} out={T.slashStart - 8} text="Connect any two passages." />
      <Overlay f={f} in_={T.clickName - 12} out={T.clickCat - 10} text="Name the relationship." />
      <Overlay f={f} in_={T.mapArrive + 90} out={T.mapArrive + 250} text="Your map of munāsabāt." />

      <EndCard f={f} />
    </AbsoluteFill>
  );
};

// ── Composition ───────────────────────────────────────────────────────────

const Click: React.FC<{ at: number }> = ({ at }) => (
  <Sequence from={at} durationInFrames={24}>
    <Audio src={staticFile("sfx/click.mp3")} volume={0.4} />
  </Sequence>
);
const Swoosh: React.FC<{ at: number; v: number }> = ({ at, v }) => (
  <Sequence from={at} durationInFrames={42}>
    <Audio src={staticFile("sfx/whoosh.mp3")} volume={v} />
  </Sequence>
);
const Typing: React.FC<{ from: number; to: number; v?: number }> = ({ from, to, v = 0.38 }) => (
  <Sequence from={from} durationInFrames={Math.max(1, to - from)}>
    <Audio src={staticFile("sfx/typing.mp3")} volume={v} />
  </Sequence>
);

export const LinkReel: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const FADE = 2 * FPS;
  return (
    <AbsoluteFill style={{ background: R.bg }}>
      {/* The take keeps its own 0-based timing; shifting it here means every
          interaction frame and every sound effect stays exactly as tuned. */}
      <Sequence from={START} durationInFrames={durationInFrames - START}>
        <Reel />
      </Sequence>
      <StartScreen />

      <Audio
        src={staticFile("bg.mp3")}
        volume={(f) => interpolate(
          f, [0, FADE, durationInFrames - FADE, durationInFrames], [0, 0.28, 0.28, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )}
      />

      <Sequence from={START} durationInFrames={durationInFrames - START}>
      <Typing from={T.slashStart} to={T_END.slash} v={0.42} />
      <Typing from={T.nameStart}  to={T_END.name} />
      <Typing from={T.commStart}  to={T_END.comm} />

      {[T.clickLine, T.clickMenu, T.clickName, T.clickComm, T.clickCat, T.clickCreate]
        .map((at) => <Click key={at} at={at} />)}

      <Swoosh at={T.modalOpen} v={0.3} />
      <Swoosh at={T.clickCreate + 8} v={0.44} />
      <Swoosh at={T.bridgeStart} v={0.36} />
      <Swoosh at={T.mapArrive} v={0.5} />
      {STARTS.filter((s) => s > T.mapArrive).map((s) => <Swoosh key={s} at={s} v={0.2} />)}
      <Swoosh at={T.endCard - 20} v={0.46} />
      </Sequence>
    </AbsoluteFill>
  );
};
