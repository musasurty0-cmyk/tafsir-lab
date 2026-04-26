import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { T } from "../tokens";
import { Rail, Sidebar, Topbar } from "../components/UIShell";
import { SceneCaption } from "../components/SceneCaption";

const FontLoader: React.FC = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&display=swap');
  `}</style>
);

// The four annotations, each with position, timing, and character width for pen tracking
const ANNOTATIONS = [
  { text: "Ever-Living ✓",               left: 268, top: 152, size: 22, cw: 11,   startFrame: 40,  cps: 1.6, color: T.accentInk   },
  { text: "Sustainer of all existence",  left: 245, top: 194, size: 20, cw: 10,   startFrame: 76,  cps: 1.5, color: "#7C6FF7"      },
  { text: "No sleep.  No drowsiness.",   left: 580, top: 242, size: 20, cw: 10.2, startFrame: 106, cps: 1.4, color: T.ink          },
  { text: "= Throne Verse",              left: 212, top: 355, size: 19, cw: 9.8,  startFrame: 136, cps: 1.8, color: T.ink3         },
] as const;

// Returns how many chars of this annotation have been written at `frame`
const charsAt = (ann: typeof ANNOTATIONS[number], frame: number) =>
  Math.min(ann.text.length, Math.max(0, Math.floor((frame - ann.startFrame) * ann.cps)));

// End-x of an annotation at full length
const endX = (ann: typeof ANNOTATIONS[number]) =>
  ann.left + ann.text.length * ann.cw;

// Reveals text character by character
const WriteText: React.FC<{
  text: string;
  startFrame: number;
  cps: number;
  style: React.CSSProperties;
}> = ({ text, startFrame, cps, style }) => {
  const frame = useCurrentFrame();
  const n = Math.min(text.length, Math.max(0, Math.floor((frame - startFrame) * cps)));
  if (n === 0) return null;
  const writing = n < text.length;
  return (
    <div style={{ position: "absolute", fontFamily: "'Caveat', cursive", ...style }}>
      {text.slice(0, n)}
      {writing && (
        <span style={{ display: "inline-block", width: 2, height: "0.85em", background: style.color as string ?? T.ink, marginLeft: 1, verticalAlign: "middle", opacity: 0.9 }} />
      )}
    </div>
  );
};

// Pen nib SVG — sits at the tip of the stroke
const PenCursor: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <div style={{ position: "absolute", left: x - 3, top: y - 20, pointerEvents: "none", zIndex: 60 }}>
    <svg width="20" height="26" viewBox="0 0 20 26" fill="none">
      {/* barrel */}
      <rect x="6" y="1" width="8" height="16" rx="3" fill={T.ink} opacity="0.88" />
      {/* nib */}
      <path d="M8 17 L10 24 L12 17 Z" fill={T.ink} opacity="0.88" />
      {/* shine */}
      <rect x="8" y="3" width="2" height="8" rx="1" fill="white" opacity="0.25" />
    </svg>
  </div>
);

// Word note panel that slides up after tap
const WordNotePanel: React.FC<{ progress: number }> = ({ progress }) => {
  const panelH = 260;
  const translateY = interpolate(progress, [0, 1], [panelH, 0]);
  const op = interpolate(progress, [0, 0.25], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", bottom: 0, left: "50%", transform: `translateX(-50%) translateY(${translateY}px)`, width: 500, background: T.bgElev, border: `1px solid ${T.lineStrong}`, borderRadius: `${T.radiusLg}px ${T.radiusLg}px 0 0`, boxShadow: T.shadowLg, opacity: op, zIndex: 40 }}>
      <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
        <div style={{ width: 32, height: 4, borderRadius: 2, background: T.lineStrong }} />
      </div>
      {/* Header */}
      <div style={{ padding: "8px 20px 14px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontFamily: T.fontArabic, fontSize: 30, color: T.ink, direction: "rtl" }}>ٱلْقَيُّومُ</div>
        <div>
          <div style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 600, color: T.ink }}>Al-Qayyūm — Word Notes</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink3, marginTop: 2, letterSpacing: "0.03em" }}>Word 5 · 2:255 · Al-Baqarah</div>
        </div>
      </div>
      {/* Notes */}
      <div style={{ padding: "14px 20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ padding: "11px 14px", background: "#FFF8ED", border: `1px solid rgba(245,158,11,0.25)`, borderRadius: T.radiusLg }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: "#92400E", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 5 }}>Linguistic</div>
          <div style={{ fontFamily: T.fontSerif, fontSize: 13.5, lineHeight: 1.6, color: T.ink2 }}>
            "Al-Qayyūm" — the Self-Subsisting One on whom all creation depends for its continued existence.
          </div>
        </div>
        <div style={{ padding: "11px 14px", background: "#EDFAF4", border: `1px solid rgba(45,158,116,0.22)`, borderRadius: T.radiusLg }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.accentInk, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 5 }}>Commentary</div>
          <div style={{ fontFamily: T.fontSerif, fontSize: 13.5, lineHeight: 1.6, color: T.ink2 }}>
            Ibn Abbas: "He who does not sleep and upon whom all else is sustained."
          </div>
        </div>
      </div>
    </div>
  );
};

export const Scene3bDrawing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn  = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = Math.min(fadeIn, fadeOut);

  // ── Pen cursor position ──────────────────────────────────────────────────
  // The pen stays at the tip of whichever annotation is currently being written.
  // Between annotations it glides to the next start position.
  const [a0, a1, a2, a3] = ANNOTATIONS;

  const c0 = charsAt(a0, frame); // chars written for each annotation
  const c1 = charsAt(a1, frame);
  const c2 = charsAt(a2, frame);
  const c3 = charsAt(a3, frame);

  const a0End = a0.startFrame + a0.text.length / a0.cps; // frame each annotation finishes
  const a1End = a1.startFrame + a1.text.length / a1.cps;
  const a2End = a2.startFrame + a2.text.length / a2.cps;
  const a3End = a3.startFrame + a3.text.length / a3.cps;

  let penX: number;
  let penY: number;

  if (frame < a0.startFrame) {
    // glide to first annotation start
    penX = interpolate(frame, [5, a0.startFrame], [a0.left - 30, a0.left], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    penY = interpolate(frame, [5, a0.startFrame], [a0.top + 10, a0.top], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  } else if (frame <= a0End) {
    penX = a0.left + c0 * a0.cw;
    penY = a0.top;
  } else if (frame < a1.startFrame) {
    penX = interpolate(frame, [a0End, a1.startFrame], [endX(a0), a1.left], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    penY = interpolate(frame, [a0End, a1.startFrame], [a0.top, a1.top], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  } else if (frame <= a1End) {
    penX = a1.left + c1 * a1.cw;
    penY = a1.top;
  } else if (frame < a2.startFrame) {
    penX = interpolate(frame, [a1End, a2.startFrame], [endX(a1), a2.left], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    penY = interpolate(frame, [a1End, a2.startFrame], [a1.top, a2.top], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  } else if (frame <= a2End) {
    penX = a2.left + c2 * a2.cw;
    penY = a2.top;
  } else if (frame < a3.startFrame) {
    penX = interpolate(frame, [a2End, a3.startFrame], [endX(a2), a3.left], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    penY = interpolate(frame, [a2End, a3.startFrame], [a2.top, a3.top], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  } else if (frame <= a3End) {
    penX = a3.left + c3 * a3.cw;
    penY = a3.top;
  } else {
    // glide toward the highlighted word after writing is done
    penX = interpolate(frame, [a3End, a3End + 20], [endX(a3), 430], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    penY = interpolate(frame, [a3End, a3End + 20], [a3.top, 168], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }

  // ── Highlighter ──────────────────────────────────────────────────────────
  const hlStart = Math.round(a3End) + 22;
  const hlProgress = interpolate(frame, [hlStart, hlStart + 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Tap + panel ──────────────────────────────────────────────────────────
  const tapFrame   = hlStart + 40;
  const tapOpacity = interpolate(frame, [tapFrame, tapFrame + 10, tapFrame + 28], [0, 0.65, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tapScale   = interpolate(frame, [tapFrame, tapFrame + 28], [0.4, 2.2], { extrapolateRight: "clamp" });
  const panelSpring = spring({ frame: frame - (tapFrame + 8), fps, config: { damping: 24, stiffness: 110 } });

  // ── Captions ─────────────────────────────────────────────────────────────
  const cap1op = interpolate(frame, [15, 30, hlStart - 15, hlStart], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cap2op = interpolate(frame, [hlStart + 5, hlStart + 20, tapFrame - 5, tapFrame + 5], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cap3op = interpolate(frame, [tapFrame + 10, tapFrame + 25, durationInFrames - 35, durationInFrames - 20], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const penVisible = frame >= 5 && frame < tapFrame + 5;

  return (
    <div style={{ position: "absolute", inset: 0, background: T.bg, display: "flex", opacity: sceneOpacity, overflow: "hidden" }}>
      <FontLoader />
      <Rail />
      <Sidebar />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        <Topbar title="Ayat al-Kursi — Drawing Mode" />

        <div style={{ flex: 1, position: "relative", background: T.bg, overflow: "hidden" }}>

          {/* Dot-grid */}
          <svg style={{ position: "absolute", inset: 0, opacity: 0.28, pointerEvents: "none" }} width="100%" height="100%">
            <defs>
              <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="12" cy="12" r="0.9" fill={T.ink4} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>

          {/* Embedded verse card */}
          <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", width: 540, padding: "20px 24px", background: T.bgElev, border: `1px solid ${T.lineStrong}`, borderRadius: T.radiusLg, boxShadow: T.shadowMd }}>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink3, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent }} />
              2:255 · Al-Baqarah
            </div>
            <div style={{ fontFamily: T.fontArabic, fontSize: 30, lineHeight: 2.2, direction: "rtl", textAlign: "right", color: T.ink }}>
              ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ
            </div>
            <div style={{ fontFamily: T.fontSerif, fontStyle: "italic", fontSize: 13, color: T.ink3, marginTop: 8 }}>
              Allāhu lā ilāha illā huwa l-ḥayyu l-qayyūm
            </div>
          </div>

          {/* Highlighter over القيّوم */}
          {hlProgress > 0 && (
            <div style={{ position: "absolute", top: 142, left: 385, width: 125 * hlProgress, height: 44, background: "#F59E0B", opacity: 0.26, borderRadius: 4, pointerEvents: "none" }} />
          )}

          {/* Tap ripple */}
          {tapOpacity > 0 && (
            <div style={{ position: "absolute", top: 150, left: 430, width: 30, height: 30, borderRadius: "50%", border: `2px solid ${T.accent}`, transform: `scale(${tapScale})`, opacity: tapOpacity, pointerEvents: "none", transformOrigin: "center" }} />
          )}

          {/* Handwritten annotations */}
          {ANNOTATIONS.map((ann, i) => (
            <WriteText
              key={i}
              text={ann.text}
              startFrame={ann.startFrame}
              cps={ann.cps}
              style={{ left: ann.left, top: ann.top, fontSize: ann.size, color: ann.color, fontWeight: 600, whiteSpace: "nowrap" }}
            />
          ))}

          {/* Pen cursor tracking the writing */}
          {penVisible && <PenCursor x={penX} y={penY} />}

          {/* Drawing toolbar */}
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", background: T.bgElev, border: `1px solid ${T.lineStrong}`, borderRadius: T.radiusLg, padding: 6, display: "flex", flexDirection: "column", gap: 3, boxShadow: T.shadowMd }}>
            {([["✏️", frame < hlStart], ["🖊️", frame >= hlStart && frame < tapFrame], ["↗", false], ["□", false]] as [string, boolean][]).map(([icon, active], i) => (
              <div key={i} style={{ width: 32, height: 32, borderRadius: 7, display: "grid", placeItems: "center", fontSize: 13, background: active ? T.accentSoft : "transparent", border: `1px solid ${active ? T.accent : "transparent"}`, color: active ? T.accentInk : T.ink3 }}>
                {icon}
              </div>
            ))}
          </div>

          {/* Word note panel slides up */}
          {frame >= tapFrame + 4 && <WordNotePanel progress={panelSpring} />}

        </div>
      </div>

      {/* Captions */}
      <div style={{ opacity: cap1op }}>
        <SceneCaption tag="Drawing Mode" headline="Write and annotate directly on top of the Quranic text" body="Freehand pen on a full-page overlay — notes appear right where you need them" appearAt={0} disappearAt={9999} />
      </div>
      <div style={{ opacity: cap2op }}>
        <SceneCaption tag="Highlight" headline="Highlight any word with the highlighter tool" appearAt={0} disappearAt={9999} />
      </div>
      <div style={{ opacity: cap3op }}>
        <SceneCaption tag="Word Notes" headline="Tap a highlighted word to open its dedicated note space" body="Add commentary, linguistic observations, and cross-references word by word" appearAt={0} disappearAt={9999} />
      </div>
    </div>
  );
};
