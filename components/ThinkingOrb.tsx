"use client";

/**
 * ThinkingOrb — the orb, drawn by `thinking-orbs`' own engine, on our loop.
 *
 * The library's React component is not used, and for one reason: it freezes
 * itself to a single still frame when `prefers-reduced-motion: reduce` is set,
 * with no prop to say otherwise. This app does not gate on that preference —
 * that is a standing decision here, not an oversight — so the component's
 * behaviour is the wrong behaviour for this codebase.
 *
 * Everything that draws is still theirs. `resolvePreset` picks the mode and
 * its tuned options for a (state, size) pair and `MODE_DRAWS` paints the
 * frame; this file only owns the canvas, the clock and the theme. The timing
 * convention is copied from their component exactly — `t = now/1000 × speed`,
 * device-pixel-ratio capped at 2 — so the animation is the one they tuned.
 *
 * Kept from their implementation: pausing when scrolled out of view and when
 * the tab is hidden. Those save battery on a canvas nobody is looking at, and
 * have nothing to do with motion preference.
 */

import { useEffect, useRef, useState } from "react";
import { MODE_DRAWS, resolvePreset, type OrbState, type OrbSize } from "thinking-orbs";

interface Props {
  state?: OrbState;
  /** 64 (chat scale) or 20 (inline). They are separate designs, not a scale. */
  size?: OrbSize;
  /** CSS size, when it should not equal the preset. The two presets are tuned
   *  designs with their own dot counts, so this draws at `size` and displays
   *  the result smaller — the dots shrink with everything else and the tuning
   *  is left alone. Rendering into a canvas larger than its box costs nothing
   *  but sharpness. */
  displaySize?: number;
  /** Multiplier on the preset's own tuned speed. */
  speed?: number;
  className?: string;
  "aria-hidden"?: boolean;
  "aria-label"?: string;
}

/** Dark ink on light paper, or the reverse — from the attribute the app sets. */
function useDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => {
      const attr = document.documentElement.getAttribute("data-theme");
      if (attr === "dark" || attr === "light") { setDark(attr === "dark"); return; }
      setDark(typeof matchMedia !== "undefined" &&
              matchMedia("(prefers-color-scheme: dark)").matches);
    };
    read();
    const mq = typeof matchMedia !== "undefined"
      ? matchMedia("(prefers-color-scheme: dark)") : null;
    mq?.addEventListener("change", read);
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => { mq?.removeEventListener("change", read); mo.disconnect(); };
  }, []);
  return dark;
}

export default function ThinkingOrb({
  state = "working", size = 64, displaySize, speed = 1, className, ...aria
}: Props) {
  const box = displaySize ?? size;
  const ref  = useRef<HTMLCanvasElement>(null);
  const dark = useDark();

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);
    cv.width  = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const { mode, speed: preset, opts } = resolvePreset(state, size);
    const draw = MODE_DRAWS[mode];
    const rate = preset * speed;

    const paint = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      draw(ctx, size, t, dark, opts);
    };

    let raf = 0, running = false;
    const tick = () => {
      paint((performance.now() / 1000) * rate);
      if (running) raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(tick); } };
    const stop  = () => { running = false; cancelAnimationFrame(raf); };

    paint((performance.now() / 1000) * rate);

    let visible = true;
    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([e]) => {
          visible = e.isIntersecting;
          if (visible && document.visibilityState !== "hidden") start(); else stop();
        })
      : null;
    io?.observe(cv);
    const onVis = () => {
      if (document.visibilityState === "hidden") stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVis);
    if (!io) start();

    return () => {
      stop();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [state, size, speed, dark]);

  return (
    <canvas
      ref={ref}
      role="img"
      className={className}
      style={{ width: box, height: box, display: "block" }}
      {...aria}
    />
  );
}
