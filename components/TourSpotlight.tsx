"use client";

/**
 * TourSpotlight — dims the interface and cuts a hole around one real control.
 *
 * Additive by design: a step with no `target`, or a target that is not on the
 * page yet, renders nothing at all. The tour then behaves exactly as it did
 * before this existed, so a bad or stale selector can never block the UI.
 *
 * The cutout is a single fixed overlay using `clip-path: evenodd`, rather
 * than four dimming rectangles around the target. Four rects leave hairline
 * seams at fractional device-pixel positions and have to be kept in sync;
 * one path cannot come apart.
 *
 * The overlay never swallows input — pointer-events are off, so the control
 * being explained stays usable while it is spotlit. That matters: the tour
 * demonstrates the real workflow, so the user must be able to actually do
 * the thing being described.
 */

import { useEffect, useState } from "react";

const PAD    = 6;   // breathing room around the target
const RADIUS = 8;

export interface SpotlightRect { x: number; y: number; w: number; h: number }

/** Track a selector's viewport rect, following scroll, resize and layout. */
export function useSpotlightTarget(selector: string | null | undefined) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!selector) { setRect(null); return; }

    let raf = 0;
    const measure = () => {
      const el = document.querySelector(selector);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      // A zero-size box means the element is present but not laid out yet
      // (still mounting, or inside a collapsed panel) — treat as absent
      // rather than cutting a hole at 0,0.
      if (r.width === 0 || r.height === 0) { setRect(null); return; }
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    };

    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };

    measure();
    // The target may mount after the step does — poll briefly rather than
    // requiring the tour to know about every component's load timing.
    const poll = window.setInterval(measure, 250);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(poll);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [selector]);

  return rect;
}

export default function TourSpotlight({ rect }: { rect: SpotlightRect | null }) {
  if (!rect) return null;

  const x = rect.x - PAD, y = rect.y - PAD;
  const w = rect.w + PAD * 2, h = rect.h + PAD * 2;
  const r = Math.min(RADIUS, w / 2, h / 2);

  /* Outer rect (the whole viewport) then the rounded cutout, wound so the
     even-odd fill rule leaves the target clear. */
  const path =
    `M0 0 H${window.innerWidth} V${window.innerHeight} H0 Z ` +
    `M${x + r} ${y} ` +
    `H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
    `V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} ` +
    `H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
    `V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;

  return (
    <div className="tr-spotlight" aria-hidden>
      <svg width="100%" height="100%">
        <path d={path} fillRule="evenodd" className="tr-spotlight-veil" />
        <rect
          x={x} y={y} width={w} height={h} rx={r}
          className="tr-spotlight-ring"
        />
      </svg>
    </div>
  );
}
