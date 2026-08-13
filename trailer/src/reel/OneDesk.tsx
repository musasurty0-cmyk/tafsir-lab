import React from "react";
import {
  AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate,
} from "remotion";
import { R } from "../reelTokens";
import { clamp, smoothstep } from "./searchCurves";

/* ── One Desk ──────────────────────────────────────────────────────────────
   Third cut. The first two were structurally sound and told nothing; §13a of
   MOTION-STUDY records why, measured against the original trailer:

     product area of frame     original 100%   cut 2  39%
     ink density INSIDE it     original 1.07%  cut 2  1.17%   ← identical
     ink pixels on screen      original 22,108 cut 2  9,527
     dwell per screen          original 10.0s  cut 2  3.3s

   The surfaces were never sparse. They were SMALL and BRIEF. Content × time,
   the crude original delivered about seven times the information.

   Three changes, all structural. None of them is an effect.

   1. THE APP FILLS THE FRAME. §1's "float the object on a stage at a quarter
      to a half of frame area" was measured from reels whose subject is a pill
      or a chip holding two words. This subject is a page of Arabic with a
      translation and two scholars' notes — a READING TOOL. At 39% its own text
      has to shrink until the thing that proves the product exists no longer
      fits. Stage-to-object ratio is a function of how much the object has to
      say, and that is the rule I did not have.

   2. ONE PAGE THAT ACCUMULATES. Cut 2's headline was a single container with
      no cut in thirty seconds — but its CONTENTS reset every beat: nine
      unrelated screens inside one rectangle. A morph between two unrelated
      screens is a very smooth way of changing the subject. Here nothing is
      ever replaced. The āyah that arrives at 0:05 is still on screen at 0:40,
      with ink on it, two notes anchored to it, a tafsīr open beside it and a
      Connection hanging off it. Continuity belongs to the SUBJECT.
      Dwell stops being per-beat and becomes cumulative: the āyah gets 35
      seconds of reading time, not 3.3.

   3. CAPTION AND EVIDENCE SIMULTANEOUS. Every line appears only once the frame
      behind it already proves it. "Anchored to the word, not the page" waits
      for the note to be anchored. When the caption outruns the screen it stops
      describing and starts advertising.

   Kept from the measured work, now operating on a page that stays put: the
   never-still cursor (§4), rack focus as a pointer (§5), per-word catch-up
   (§3), ink drawn rather than faded, and the click as the spine of the mix.  */

const FPS = 60;
export const DESK_FRAMES = 43 * FPS;          // 2580

const W = 1080, H = 1920;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const at = (f: number, a: number, b: number) => ease(interpolate(f, [a, b], [0, 1], clamp));

/* ── The score ────────────────────────────────────────────────────────────
   Every entry ADDS to the page. Nothing here removes anything.             */
const T = {
  title:    40,     // the page is named
  slash:   150,     // /ayah
  ayah:    260,     // the āyah lands — and stays for the rest of the reel
  transl:  380,
  ink:     560,     // the word is marked
  ling:    720,     // linguistic note anchors to it
  tafsir:  980,     // the drawer opens beside it, page keeps its place
  them:   1320,     // thematic note joins
  conn:   1560,     // the Connection attaches
  people: 1840,     // the ḥalaqa arrives on the same page
  back:   2120,     // pull back — everything at once, still there
  mark:   2360,
};

// ── Chrome ─────────────────────────────────────────────────────────────────
// Full-bleed. This is the app, not a picture of the app.

const TopBar: React.FC<{ f: number }> = ({ f }) => (
  <div style={{ flexShrink: 0 }}>
    <div style={{
      height: 92, display: "flex", alignItems: "center", gap: 16, padding: "0 26px",
      borderBottom: `1px solid ${R.line}`,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: R.ink, color: R.bg,
                    display: "grid", placeItems: "center",
                    fontFamily: R.fontSans, fontSize: 21, fontWeight: 700 }}>T</div>
      <div style={{ fontFamily: R.fontSans, fontSize: 25, fontWeight: 600, color: R.ink }}>
        Tafsir Study Group
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 8 }}>
        {["Mode A", "Mode B"].map((m, i) => (
          <div key={m} style={{
            fontFamily: R.fontSans, fontSize: 18, padding: "8px 14px", borderRadius: 8,
            color: i === 1 ? R.ink : R.ink3, background: i === 1 ? R.panel : "transparent",
          }}>{m}</div>
        ))}
      </div>
      <div style={{ fontFamily: R.fontSans, fontSize: 18, padding: "9px 18px", borderRadius: 8,
                    background: R.ink, color: R.bg }}>Share</div>
    </div>
    <div style={{
      height: 62, display: "flex", alignItems: "center", gap: 10, padding: "0 26px",
      borderBottom: `1px solid ${R.line}`,
      fontFamily: R.fontSans, fontSize: 19,
    }}>
      <span style={{ color: R.ink3 }}>Al-Baqarah</span>
      <span style={{ color: R.ink4 }}>/</span>
      <span style={{ color: R.ink, fontWeight: 600 }}>Āyat al-Kursī (2:255)</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: R.fontMono, fontSize: 16, color: R.ink4 }}>
        {f > T.people ? "5 online" : f > T.conn ? "2 online" : ""}
      </span>
    </div>
  </div>
);

const SideRail: React.FC<{ f: number }> = ({ f }) => {
  const surahs: [string, string, number][] = [
    ["Al-Fātiḥah", "الفاتحة", 4],
    ["Al-Baqarah", "البقرة", 12],
    ["Āl ʿImrān", "آل عمران", 3],
    ["An-Nisāʾ", "النساء", 0],
    ["Al-Māʾidah", "المائدة", 0],
  ];
  return (
    <div style={{
      width: 300, borderRight: `1px solid ${R.line}`, background: R.panel,
      padding: "18px 12px", flexShrink: 0,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "11px 12px",
        background: R.bgElev, border: `1px solid ${R.line}`, borderRadius: 8,
        fontFamily: R.fontSans, fontSize: 17, color: R.ink4, marginBottom: 18,
      }}>
        <span>⌕</span><span>Search pages…</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: R.fontMono, fontSize: 14 }}>⌘K</span>
      </div>
      <div style={{ fontFamily: R.fontMono, fontSize: 14, color: R.ink4,
                    letterSpacing: "0.08em", padding: "0 12px 8px" }}>SURAHS</div>
      {surahs.map(([n, ar, c], i) => (
        <div key={n}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
            borderRadius: 7, background: i === 1 ? R.hover : "transparent",
            fontFamily: R.fontSans, fontSize: 18,
            color: i === 1 ? R.ink : R.ink2,
          }}>
            <span style={{ color: R.ink4, fontSize: 13 }}>{i === 1 ? "⌄" : "›"}</span>
            <span>{n}</span>
            <div style={{ flex: 1 }} />
            {c > 0 && <span style={{ fontFamily: R.fontMono, fontSize: 13, color: R.ink4 }}>{c}</span>}
            <span style={{ fontFamily: R.fontSerif, fontSize: 16, color: R.ink3 }}>{ar}</span>
          </div>
          {i === 1 && ["Overview", "Āyat al-Kursī (2:255)", "Verses 256–286"].map((p, k) => (
            <div key={p} style={{
              padding: "9px 12px 9px 34px", borderRadius: 7,
              background: k === 1 ? R.accentSoft : "transparent",
              fontFamily: R.fontSans, fontSize: 17,
              color: k === 1 ? R.accentInk : R.ink3,
            }}>{p}</div>
          ))}
        </div>
      ))}
    </div>
  );
};

// ── Notes that anchor to the text and stay ─────────────────────────────────

const Note: React.FC<{
  kind: string; tint: string; ink: string; body: string; born: number; f: number; top: number;
}> = ({ kind, tint, ink, body, born, f, top }) => {
  if (f < born) return null;
  const q = at(f, born, born + 90);
  return (
    <div style={{
      position: "absolute", right: 26, top,
      width: 300, background: tint, borderRadius: 10, padding: "14px 16px",
      opacity: q, transform: `translateX(${(1 - q) * 34}px)`,
      boxShadow: R.shadowSm,
    }}>
      <div style={{ fontFamily: R.fontMono, fontSize: 14, color: ink,
                    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>
        {kind}
      </div>
      <div style={{ fontFamily: R.fontSans, fontSize: 18, color: R.ink2, lineHeight: 1.5 }}>
        {body}
      </div>
    </div>
  );
};

// ── The page — everything on it persists ───────────────────────────────────

/* Where the page has scrolled to. Rises whenever content lands below the fold,
   so the frame is always drifting gently rather than freezing between events. */
const scrollY = (f: number) =>
  -( at(f, T.transl, T.transl + 150) * 22
   + at(f, T.ling,   T.ling   + 200) * 38
   + at(f, T.them,   T.them   + 220) * 48
   + at(f, T.conn,   T.conn   + 240) * 58
   + at(f, T.people, T.people + 200) * 30 );

const Page: React.FC<{ f: number }> = ({ f }) => {
  const typed = "On al-Qayyūm".slice(0, Math.floor(interpolate(f, [T.title, T.title + 46], [0, 13], clamp)));
  const slashOn = f >= T.slash && f < T.ayah;
  const cmd = "/ayah 2:255".slice(0, Math.floor(interpolate(f, [T.slash, T.slash + 44], [0, 11], clamp)));

  return (
    <div style={{ flex: 1, minWidth: 0, position: "relative", padding: "26px 30px",
                  transform: `translateY(${scrollY(f)}px)` }}>
      <div style={{ fontFamily: R.fontMono, fontSize: 15, color: R.ink4, letterSpacing: "0.08em" }}>
        MODE B · MUSHAF CANVAS
      </div>
      <div style={{ fontFamily: R.fontSerif, fontSize: 46, fontWeight: 700, color: R.ink,
                    marginTop: 10, minHeight: 58 }}>
        {typed}<span style={{ opacity: f < T.title + 46 && Math.floor(f / 16) % 2 ? 1 : 0 }}>▌</span>
      </div>

      {/* the slash command — the only thing here that is ever removed, because
          it becomes the āyah it summoned */}
      {slashOn && (
        <div style={{ fontFamily: R.fontMono, fontSize: 25, color: R.accentInk, marginTop: 20 }}>
          {cmd}<span style={{ opacity: Math.floor(f / 14) % 2 ? 1 : 0.2 }}>▌</span>
        </div>
      )}

      {/* THE ĀYAH. Arrives at 0:04 and is still here at 0:43. */}
      {f >= T.ayah && (() => {
        const q = at(f, T.ayah, T.ayah + 80);
        return (
          <div style={{
            marginTop: 22, border: `1px solid ${f >= T.ink ? R.accent : R.lineStrong}`,
            borderRadius: 10, padding: "20px 22px", background: R.bgElev,
            opacity: q, transform: `translateY(${(1 - q) * 18}px)`, position: "relative",
          }}>
            <div style={{ fontFamily: R.fontMono, fontSize: 15, color: R.ink3,
                          letterSpacing: "0.05em", marginBottom: 14 }}>
              ● 2:255 · AL-BAQARAH
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: R.fontSerif, fontSize: 40, color: R.ink,
                            direction: "rtl", textAlign: "right", lineHeight: 2.0 }}>
                ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ ۚ
                لَّهُۥ مَا فِى ٱلسَّمَـٰوَٰتِ وَمَا فِى ٱلْأَرْضِ ۗ مَن ذَا ٱلَّذِى يَشْفَعُ عِندَهُۥٓ
                إِلَّا بِإِذْنِهِۦ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ
              </div>
              {/* ink drawn ON the word, not faded in */}
              {f >= T.ink && (
                <svg width="100%" height="60" style={{ position: "absolute", left: 0, top: 8 }}>
                  <path d="M250 34 C310 12, 400 10, 470 26"
                        stroke={R.highlight} strokeWidth="20" fill="none" strokeLinecap="round"
                        opacity={0.5} strokeDasharray={240}
                        strokeDashoffset={240 * (1 - at(f, T.ink, T.ink + 90))} />
                </svg>
              )}
            </div>
            {f >= T.transl && (() => {
              const t = at(f, T.transl, T.transl + 90);
              return (
                <>
                  <div style={{ fontFamily: R.fontSerif, fontSize: 20, fontStyle: "italic",
                                color: R.ink3, marginTop: 16, opacity: t }}>
                    Allāhu lā ilāha illā huw, al-ḥayyu l-qayyūm…
                  </div>
                  <div style={{ fontFamily: R.fontSans, fontSize: 21, color: R.ink,
                                marginTop: 12, lineHeight: 1.55, opacity: t }}>
                    Allah — there is no deity except Him, the Ever-Living, the Sustainer of
                    existence. Neither drowsiness overtakes Him nor sleep. To Him belongs
                    whatever is in the heavens and whatever is on the earth. Who is it that
                    can intercede with Him except by His permission? He knows what is
                    before them and what will be after them…
                  </div>
                </>
              );
            })()}
          </div>
        );
      })()}

      {/* the Connection, hanging off the same āyah */}
      {f >= T.conn && (() => {
        const q = at(f, T.conn, T.conn + 90);
        return (
          <div style={{
            marginTop: 18, border: `1px solid ${R.lineStrong}`, borderRadius: 10,
            background: R.bgElev, padding: "16px 18px", boxShadow: R.shadowSm,
            opacity: q, transform: `translateY(${(1 - q) * 14}px)`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontFamily: R.fontSans, fontSize: 21, fontWeight: 600, color: R.ink }}>
                The One who sustains
              </div>
              <div style={{ fontSize: 18, color: R.iconLink }}>🔗</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9,
                          fontFamily: R.fontSans, fontSize: 18, color: R.ink2 }}>
              <span>Al-Baqarah 2:255</span>
              <span style={{ color: R.iconLink }}>↔</span>
              <span>Āl ʿImrān 3:2</span>
            </div>
            <div style={{ fontFamily: R.fontSans, fontSize: 17, color: R.ink3, marginTop: 9,
                          opacity: at(f, T.conn + 70, T.conn + 130) }}>
              The same two names open both āyāt.
            </div>
          </div>
        );
      })()}

      {/* the next āyah, dimmed — the page continues past what we are reading */}
      {f >= T.transl + 40 && (
        <div style={{ marginTop: 20, padding: "16px 20px", opacity: 0.34 }}>
          <div style={{ fontFamily: R.fontMono, fontSize: 14, color: R.ink3 }}>● 2:256 · AL-BAQARAH</div>
          <div style={{ fontFamily: R.fontSerif, fontSize: 32, color: R.ink, direction: "rtl",
                        textAlign: "right", lineHeight: 1.9, marginTop: 8 }}>
            لَآ إِكْرَاهَ فِى ٱلدِّينِ ۖ قَد تَّبَيَّنَ ٱلرُّشْدُ مِنَ ٱلْغَىِّ
          </div>
          <div style={{ fontFamily: R.fontSans, fontSize: 19, color: R.ink2, marginTop: 10,
                        lineHeight: 1.5 }}>
            There shall be no compulsion in religion. The right course has become clear
            from error…
          </div>
        </div>
      )}

      {/* notes anchored to the word — they arrive and they stay */}
      <Note f={f} born={T.ling} top={300} kind="Linguistic Note"
            tint="#FEF6E7" ink="#92400E"
            body="'Al-Ḥayy' and 'Al-Qayyūm' form a pair — the Living and the Self-Subsisting. Ibn Taymiyyah considered this the greatest name of Allah." />
      <Note f={f} born={T.them} top={690} kind="Thematic" tint={R.accentSoft} ink={R.accentInk}
            body="This verse encapsulates divine attributes: Ḥayy (alive), Qayyūm (sustaining), omniscience, and absolute sovereignty." />
    </div>
  );
};

// ── The tafsīr drawer — opens BESIDE the page, does not replace it ─────────

const Drawer: React.FC<{ f: number }> = ({ f }) => {
  if (f < T.tafsir) return null;
  const q = at(f, T.tafsir, T.tafsir + 90);
  const shut = f > T.back ? at(f, T.back, T.back + 40) : 0;
  const open = q * (1 - shut);
  if (open <= 0.01) return null;
  const entries: [string, string, string][] = [
    ["Ibn Kathīr", "TAFSIR IBN KATHIR · 774 AH",
     "The Ever-Living who never dies, the Sustainer of all that exists — nothing subsists without Him."],
    ["Al-Qurṭubī", "AL-JĀMIʿ LI-AḤKĀM AL-QURʾĀN · 671 AH",
     "Al-Qayyūm: the One who stands over every soul in what it earns."],
    ["Al-Ṭabarī", "JĀMIʿ AL-BAYĀN · 310 AH",
     "He is the One who manages the creation and is not managed by it."],
    ["Al-Saʿdī", "TAYSĪR AL-KARĪM · 1376 AH",
     "Perfect in His life, perfect in His self-subsistence — and every creature stands only by Him."],
    ["Al-Baghawī", "MAʿĀLIM AL-TANZĪL · 516 AH",
     "Al-Ḥayy: the One to whom death does not attach, whose life had no beginning."],
    ["Ibn ʿĀshūr", "AL-TAḤRĪR WA-L-TANWĪR · 1393 AH",
     "The pairing is deliberate: life without dependency, and sustaining without fatigue."],
  ];
  return (
    <div style={{
      position: "absolute", right: 0, top: 0, bottom: 0, width: 470,
      background: R.panel, borderLeft: `1px solid ${R.lineStrong}`,
      transform: `translateX(${(1 - open) * 100}%)`, padding: "22px 20px",
      boxShadow: "-8px 0 28px rgba(30,26,20,0.06)", zIndex: 20, overflow: "hidden",
    }}>
      <div style={{ fontFamily: R.fontSans, fontSize: 22, fontWeight: 600, color: R.ink }}>
        Tafsīr · al-Qayyūm
      </div>
      <div style={{ fontFamily: R.fontMono, fontSize: 14, color: R.ink4, marginTop: 5 }}>
        67 COMMENTARIES
      </div>
      {entries.map(([n, src, body], k) => (
        <div key={n} style={{
          marginTop: 20, paddingTop: 16, borderTop: `1px solid ${R.line}`,
          opacity: at(f, T.tafsir + 50 + k * 34, T.tafsir + 100 + k * 34),
        }}>
          <div style={{ fontFamily: R.fontSans, fontSize: 19, fontWeight: 500, color: R.ink }}>{n}</div>
          <div style={{ fontFamily: R.fontMono, fontSize: 13, color: R.ink3, marginTop: 3 }}>{src}</div>
          <div style={{ fontFamily: R.fontSans, fontSize: 17, color: R.ink2, marginTop: 9,
                        lineHeight: 1.5 }}>{body}</div>
        </div>
      ))}
    </div>
  );
};

// ── Presence — the same page, with other people on it ──────────────────────

const Presence: React.FC<{ f: number }> = ({ f }) => {
  if (f < T.people) return null;
  const who: [string, string][] = [["Y", "#448061"], ["A", "#695ba9"],
                                   ["B", "#b07d3a"], ["S", "#3a6fb0"]];
  return (
    <div style={{ position: "absolute", left: 320, bottom: 26, display: "flex",
                  alignItems: "center", gap: 10, zIndex: 30 }}>
      {who.map(([c, col], k) => {
        const q = at(f, T.people + k * 26, T.people + k * 26 + 46);
        return (
          <div key={c} style={{
            width: 40, height: 40, borderRadius: 20, background: col, color: "#fff",
            display: "grid", placeItems: "center", fontFamily: R.fontSans, fontSize: 18,
            border: "2px solid #fff", marginLeft: k ? -12 : 0,
            opacity: q, transform: `translateY(${(1 - q) * 16}px)`,
          }}>{c}</div>
        );
      })}
      <div style={{ fontFamily: R.fontSans, fontSize: 17, color: R.ink3, marginLeft: 8,
                    opacity: at(f, T.people + 130, T.people + 170) }}>
        editing together
      </div>
    </div>
  );
};

// ── Caption — appears only once the frame behind it proves the claim ───────

const LINES: { at: number; till: number; text: string }[] = [
  { at: T.ayah + 40,   till: T.ink - 10,     text: "Type / and the āyah is in your note." },
  { at: T.ling + 40,   till: T.tafsir - 20,  text: "Anchored to the word, not the page." },
  { at: T.tafsir + 90, till: T.them - 20,    text: "Sixty-seven commentaries, beside the verse." },
  { at: T.conn + 60,   till: T.people - 20,  text: "The link you noticed, kept." },
  { at: T.people + 90, till: T.back - 10,    text: "And none of it is yours alone." },
];

const Caption: React.FC<{ f: number }> = ({ f }) => {
  const live = LINES.find((l) => f >= l.at && f < l.till);
  if (!live) return null;
  const q = interpolate(f, [live.at, live.at + 16, live.till - 22, live.till], [0, 1, 1, 0], clamp);
  const words = live.text.split(" ");
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 132, display: "flex",
      justifyContent: "center", zIndex: 60, opacity: q,
    }}>
      <div style={{
        background: "rgba(255,255,255,0.94)", borderRadius: 14, padding: "18px 30px",
        boxShadow: R.shadowMd, display: "flex", gap: 11, flexWrap: "wrap",
        maxWidth: 880, justifyContent: "center",
      }}>
        {words.map((w, k) => {
          const s = live.at + 8 + k * 3;
          const e = ease(interpolate(f, [s, s + 7], [0, 1], clamp));
          return (
            <span key={k} style={{
              fontFamily: R.fontSerif, fontSize: 34, color: "#221f19",
              transform: `translate(${(1 - e) * 18}px, ${(1 - e) * 5}px)`,
              opacity: e, display: "inline-block",
            }}>{w}</span>
          );
        })}
      </div>
    </div>
  );
};

// ── Cursor ─────────────────────────────────────────────────────────────────

const LEGS = [
  { at:    0, x: 700, y: 1500 },
  { at:  120, x: 540, y: 300 },
  { at:  250, x: 520, y: 372 },
  { at:  540, x: 620, y: 520 },
  { at:  700, x: 880, y: 560 },
  { at:  960, x: 700, y: 470 },
  { at: 1300, x: 840, y: 700 },
  { at: 1540, x: 560, y: 900 },
  { at: 1820, x: 420, y: 1560 },
  { at: 2100, x: 700, y: 1200 },
];

const Cursor: React.FC = () => {
  const f = useCurrentFrame();
  if (f > T.back + 40) return null;
  let a = LEGS[0], b = LEGS[0];
  for (let k = 0; k < LEGS.length; k++)
    if (f >= LEGS[k].at) { a = LEGS[k]; b = LEGS[Math.min(k + 1, LEGS.length - 1)]; }
  const span = Math.max(1, b.at - a.at);
  const p = ease(Math.min(1, (f - a.at) / Math.min(46, span)));
  const idle = Math.max(0, f - a.at - 46);
  const x = a.x + (b.x - a.x) * p + Math.sin(idle / 37) * 5 + Math.sin(idle / 13) * 1.5;
  const y = a.y + (b.y - a.y) * p + Math.cos(idle / 29) * 4 + Math.cos(idle / 17) * 1.2;
  const v = Math.abs(b.x - a.x + b.y - a.y) * (p < 1 ? 1 - p : 0) / 42;
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 70,
                  filter: `blur(${Math.min(6, v * 1.5)}px)` }}>
      <svg viewBox="0 0 26 34" width="26" height="34">
        <path d="M2 1 L2 26 L8.5 20 L12.5 30 L17 28 L13 18.5 L21 18 Z"
              fill="#1e1a14" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ── Composition ────────────────────────────────────────────────────────────

export const OneDesk: React.FC = () => {
  const f = useCurrentFrame();

  /* The ONE camera move in the piece, and it is at the end: the frame pulls
     back to show the whole page at once — everything that was built, still
     there. Smoothstep because it repaints the entire frame (§11.11). */
  const pull = smoothstep(interpolate(f, [T.back, T.back + 90], [0, 1], clamp));
  const scale = 1 - 0.14 * pull;

  /* Rack focus (§5): while the drawer is open the page behind it softens, so
     the blur says "read this" rather than covering a cut. */
  const rack = interpolate(
    f,
    [T.tafsir + 30, T.tafsir + 90, T.tafsir + 330, T.tafsir + 400],
    [0, 3.2, 3.2, 0], clamp);

  const markQ = at(f, T.mark, T.mark + 40);

  return (
    <AbsoluteFill style={{ background: "#dedce3" }}>
      <div style={{
        position: "absolute", inset: 0, transform: `scale(${scale})`,
        transformOrigin: "50% 46%",
      }}>
        {/* full bleed: the app IS the frame */}
        <div style={{ position: "absolute", inset: 0, background: R.bg,
                      display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <TopBar f={f} />
          <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
            <div style={{ display: "flex", flex: 1, minWidth: 0,
                          filter: rack ? `blur(${rack}px)` : undefined }}>
              <SideRail f={f} />
              <Page f={f} />
            </div>
            <Drawer f={f} />
            <Presence f={f} />
          </div>
        </div>
      </div>

      <Caption f={f} />
      <Cursor />

      {/* the mark, last, over the finished page */}
      {f >= T.mark && (
        <AbsoluteFill style={{
          background: `rgba(222,220,227,${0.93 * markQ})`,
          display: "grid", placeItems: "center", zIndex: 80,
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                        gap: 14, opacity: markQ }}>
            <div style={{ fontFamily: R.fontSerif, fontSize: 88, color: R.ink, lineHeight: 1 }}>ت</div>
            <div style={{ width: 130, height: 2, background: R.ink4, overflow: "hidden" }}>
              <div style={{ width: `${at(f, T.mark + 16, T.mark + 56) * 100}%`, height: "100%",
                            background: R.ink3 }} />
            </div>
            <div style={{ fontFamily: R.fontMono, fontSize: 20, color: R.ink3,
                          letterSpacing: "0.24em" }}>TAFSIR LAB</div>
            <div style={{ fontFamily: R.fontSerif, fontSize: 30, color: R.ink2, marginTop: 22,
                          opacity: at(f, T.mark + 40, T.mark + 80) }}>
              A desk for that work.
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Sound — the click is the spine; it fires where the cursor acts. */}
      <Audio src={staticFile("bg.mp3")} volume={0.14} />
      <Sequence from={T.title - 8}   durationInFrames={70}><Audio src={staticFile("sfx/typing.mp3")} volume={0.30} /></Sequence>
      <Sequence from={T.slash - 6}   durationInFrames={64}><Audio src={staticFile("sfx/typing.mp3")} volume={0.34} /></Sequence>
      <Sequence from={T.ayah - 6}    durationInFrames={44}><Audio src={staticFile("sfx/click.mp3")} volume={0.44} /></Sequence>
      <Sequence from={T.ayah + 4}    durationInFrames={80}><Audio src={staticFile("sfx/land.mp3")} volume={0.46} /></Sequence>
      <Sequence from={T.ink - 4}     durationInFrames={80}><Audio src={staticFile("sfx/granular-select.mp3")} volume={0.30} /></Sequence>
      <Sequence from={T.ling - 6}    durationInFrames={44}><Audio src={staticFile("sfx/click.mp3")} volume={0.38} /></Sequence>
      <Sequence from={T.tafsir - 8}  durationInFrames={70}><Audio src={staticFile("sfx/whoosh.mp3")} volume={0.28} /></Sequence>
      <Sequence from={T.them - 6}    durationInFrames={44}><Audio src={staticFile("sfx/click.mp3")} volume={0.36} /></Sequence>
      <Sequence from={T.conn - 6}    durationInFrames={44}><Audio src={staticFile("sfx/click.mp3")} volume={0.42} /></Sequence>
      <Sequence from={T.conn + 10}   durationInFrames={70}><Audio src={staticFile("sfx/magnetic.mp3")} volume={0.34} /></Sequence>
      <Sequence from={T.people - 6}  durationInFrames={80}><Audio src={staticFile("sfx/granular.mp3")} volume={0.26} /></Sequence>
      <Sequence from={T.back - 6}    durationInFrames={90}><Audio src={staticFile("sfx/whoosh.mp3")} volume={0.22} /></Sequence>
      <Sequence from={T.mark - 4}    durationInFrames={110}><Audio src={staticFile("sfx/land.mp3")} volume={0.54} /></Sequence>
    </AbsoluteFill>
  );
};

export default OneDesk;
