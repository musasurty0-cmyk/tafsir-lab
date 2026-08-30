"use client";

/**
 * Onboarding — the three-screen explainer shown once, on first arrival.
 *
 * The diagrams are drawn in SVG rather than screenshotted. A screenshot of the
 * app inside the app is stale the moment either changes, and it was already
 * wrong for anyone on the other theme; a schematic stays true because it shows
 * the SHAPE of each screen — where things are and what they are for — which is
 * the only thing an explainer needs to convey.
 *
 * Shown when "tl-onboarding" is absent. Skippable from every screen, because a
 * tour you cannot leave is a wall. Re-openable from Settings, so skipping it is
 * not a one-way door.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const KEY = "tl-onboarding";

export function markOnboarded()  { try { localStorage.setItem(KEY, "done"); } catch { /* ignore */ } }
export function clearOnboarded() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

// ── Diagrams ───────────────────────────────────────────────────────────────
// One shared frame so the three screens feel like three views of one device
// rather than three unrelated pictures.

const F = { w: 720, h: 430 };   // inner screen box inside the bezel

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${F.w + 40} ${F.h + 40}`} className="ob-svg" role="img" aria-hidden>
      <rect x="6" y="6" width={F.w + 28} height={F.h + 28} rx="22"
            fill="var(--ink)" opacity="0.9" />
      <rect x="20" y="20" width={F.w} height={F.h} rx="8" fill="var(--bg-elev)" />
      {children}
    </svg>
  );
}

/** A callout: a dot on the thing, a line out, and a label. */
function Tag({ x, y, tx, ty, text, anchor = "start" }: {
  x: number; y: number; tx: number; ty: number; text: string; anchor?: "start" | "end";
}) {
  return (
    <g className="ob-tag">
      <circle cx={x} cy={y} r="4.5" fill="var(--accent)" />
      <path d={`M ${x} ${y} Q ${(x + tx) / 2} ${y} ${tx} ${ty}`}
            fill="none" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round" />
      <text x={tx + (anchor === "start" ? 8 : -8)} y={ty + 4}
            textAnchor={anchor} className="ob-tag-text">{text}</text>
    </g>
  );
}

const box = (x: number, y: number, w: number, h: number, fill = "var(--panel)") =>
  <rect x={x} y={y} width={w} height={h} rx="6" fill={fill} />;

function DashboardDiagram() {
  /* Drawn from the real page, not from memory. Reading order down the middle
     column is: Lab AI, the greeting, "Continue studying", "Your workspaces",
     and bookmarks along the bottom. There is no third column — an earlier
     version of this drawing invented a right-hand rail labelled "what you
     wrote last", and that section no longer exists at all. */
  return (
    <Frame>
      {/* Left nav */}
      {box(20, 20, 56, F.h, "var(--panel-2)")}
      <circle cx={48} cy={48} r="11" fill="var(--ink-4)" opacity="0.45" />
      {[92, 130, 168, 206, 244, 282].map((y) =>
        <circle key={y} cx={48} cy={y} r="7" fill="var(--ink-4)" opacity="0.42" />)}

      {/* Streak strip */}
      {box(96, 24, 150, 12)}

      {/* Lab AI, above everything else in the column */}
      {box(96, 52, 604, 46, "var(--accent-soft)")}

      {/* Greeting */}
      {box(96, 116, 240, 16)}
      {box(96, 140, 150, 10)}

      {/* Continue studying */}
      {box(96, 166, 604, 62)}

      {/* Your workspaces — a header row, then cards. No pink: the real cards
          are muted tones in the accent family. */}
      {box(96, 248, 140, 12)}
      {box(96, 272, 190, 78, "oklch(0.62 0.06 165 / 0.28)")}
      {box(303, 272, 190, 78, "oklch(0.60 0.05 230 / 0.24)")}
      {box(510, 272, 190, 78)}

      {/* Bookmarks, full width along the bottom */}
      {box(96, 368, 604, 44, "var(--panel-2)")}

      <Tag x={48}  y={170} tx={-4}  ty={300} text="Everything, one click" anchor="end" />
      <Tag x={300} y={74}  tx={320} ty={-2}  text="Ask about any verse" />
      <Tag x={200} y={196} tx={-4}  ty={392} text="Pick up where you left off" anchor="end" />
      <Tag x={600} y={310} tx={716} ty={330} text="Your workspaces" />
    </Frame>
  );
}

function AnnotationsDiagram() {
  return (
    <Frame>
      {box(36, 34, F.w - 32, 26)}
      {/* mushaf lines */}
      {[96, 130, 164, 198, 232, 266, 300, 334].map((y, i) =>
        <rect key={y} x={200 + (i % 2) * 14} y={y} width={340 - (i % 3) * 26} height={9}
              rx="4.5" fill="var(--ink-3)" opacity="0.32" />)}
      {/* highlighted word + verse */}
      <rect x="300" y="160" width="72" height="14" rx="4" fill="oklch(0.85 0.14 95 / 0.6)" />
      <rect x="200" y="262" width="290" height="13" rx="4" fill="oklch(0.62 0.11 160 / 0.28)" />

      <Tag x={560} y={47}  tx={640} ty={-2}  text="A whole page" />
      <Tag x={336} y={167} tx={-4}  ty={110} text="Any single word" anchor="end" />
      <Tag x={345} y={268} tx={-4}  ty={392} text="A full āyah" anchor="end" />
      <Tag x={430} y={96}  tx={640} ty={330} text="The sūrah itself" />
    </Frame>
  );
}

function CanvasDiagram() {
  return (
    <Frame>
      {box(36, 34, F.w - 32, 26)}
      {/* mushaf column */}
      {[100, 130, 160, 190, 220, 250, 280].map((y, i) =>
        <rect key={y} x={250} y={y} width={210 - (i % 3) * 18} height={8} rx="4"
              fill="var(--ink-3)" opacity="0.3" />)}
      {/* handwriting to the left and right */}
      {[104, 122, 140, 158].map((y) =>
        <path key={y} d={`M 70 ${y} q 30 -7 60 0 t 60 0`} fill="none"
              stroke="oklch(0.55 0.11 250)" strokeWidth="2" strokeLinecap="round" opacity="0.75" />)}
      {[110, 128, 146].map((y) =>
        <path key={y} d={`M 500 ${y} q 26 -6 52 0 t 52 0`} fill="none"
              stroke="oklch(0.62 0.13 65)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />)}
      {box(492, 190, 150, 62, "oklch(0.88 0.12 95 / 0.35)")}
      {/* tool rail */}
      {box(280, 372, 170, 26, "var(--panel-2)")}
      {[296, 320, 344, 368, 392, 416].map((x) => <circle key={x} cx={x} cy={385} r="5" fill="var(--ink-4)" opacity="0.6" />)}
      {/* colour column */}
      {box(660, 90, 40, 120)}

      <Tag x={130} y={130} tx={-4}  ty={80}  text="Write anywhere" anchor="end" />
      <Tag x={560} y={215} tx={640} ty={-2}  text="Room that never runs out" />
      <Tag x={680} y={150} tx={716} ty={250} text="Every tool, tuned" />
      <Tag x={365} y={385} tx={-4}  ty={392} text="Pen, text, shapes" anchor="end" />
    </Frame>
  );
}

// ── Screens ────────────────────────────────────────────────────────────────

const SCREENS = [
  {
    title:    "Your dashboard",
    subtitle: "Lab AI, where you left off, and every workspace you keep.",
    cta:      "See annotations →",
    Diagram:  DashboardDiagram,
  },
  {
    title:    "Annotations",
    subtitle: "Attach a note to a whole page, a sūrah, a single āyah — or one word.",
    cta:      "See the canvas →",
    Diagram:  AnnotationsDiagram,
  },
  {
    title:    "The canvas",
    subtitle: "Infinite space around the mushaf, with a pen, text, and shapes.",
    cta:      "Start studying →",
    Diagram:  CanvasDiagram,
  },
];

interface Props {
  /** Force it open regardless of storage — how Settings replays it. */
  open?:     boolean;
  onClose?:  () => void;
}

export default function Onboarding({ open, onClose }: Props) {
  const [show, setShow] = useState(false);
  const [i, setI]       = useState(0);

  // Checked after hydration; reading storage during render would make the
  // server's HTML and the first client paint disagree.
  useEffect(() => {
    if (open) { setShow(true); return; }
    try { setShow(localStorage.getItem(KEY) !== "done"); }
    catch { setShow(false); }
  }, [open]);

  const finish = useCallback(() => {
    markOnboarded();
    setShow(false);
    setI(0);
    onClose?.();
  }, [onClose]);

  const next = useCallback(() => {
    setI((n) => (n >= SCREENS.length - 1 ? (finish(), n) : n + 1));
  }, [finish]);
  const prev = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")     finish();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft")  prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, finish, next, prev]);

  if (!show) return null;

  const s = SCREENS[i];
  const Diagram = s.Diagram;

  return (
    <div className="ob" role="dialog" aria-modal="true" aria-label="Welcome to Tafsir Lab">
      <div className="ob-progress" aria-hidden>
        <span className="ob-progress-fill" style={{ width: `${((i + 1) / SCREENS.length) * 100}%` }} />
      </div>

      <button className="ob-nav ob-nav--prev" onClick={prev} disabled={i === 0} aria-label="Previous">
        <ChevronLeft size={22} />
      </button>
      <button className="ob-nav ob-nav--next" onClick={next} aria-label="Next">
        <ChevronRight size={22} />
      </button>
      <button className="ob-skip" onClick={finish}>
        Skip <X size={14} aria-hidden />
      </button>

      {/* Keyed so each screen animates in rather than swapping text in place. */}
      <div className="ob-screen" key={i}>
        <h1 className="ob-title">{s.title}</h1>
        <p className="ob-sub">{s.subtitle}</p>
        <div className="ob-figure"><Diagram /></div>
        <button className="ob-cta" onClick={next}>{s.cta}</button>
      </div>

      <div className="ob-dots" role="tablist" aria-label="Screens">
        {SCREENS.map((sc, n) => (
          <button
            key={sc.title} role="tab" aria-selected={n === i}
            aria-label={sc.title}
            className="ob-dot" data-active={n === i ? "true" : "false"}
            onClick={() => setI(n)}
          />
        ))}
      </div>
    </div>
  );
}
