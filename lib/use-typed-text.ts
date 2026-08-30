"use client";

/**
 * Reveal streamed text a character at a time, instead of in the chunks it
 * arrives in.
 *
 * The answer already streams — tokens append to the turn as they come — but a
 * token is several characters and they land in bursts, so the text appears in
 * lurches. That reads as a page struggling rather than as something being
 * written. This puts a small buffer between arrival and display and drains it
 * smoothly, which is the whole difference between "loading" and "typing".
 *
 * It is a SMOOTHER, not a throttle. The reveal rate is driven by how far
 * behind it is, so it always finishes just after the stream does and never
 * makes anyone wait to read. A fixed characters-per-second would be pleasant
 * on a greeting and unbearable on a nine-hundred-word answer.
 *
 *     backlog 240 chars  →  ~1090 c/s  →  a quarter second behind
 *     backlog  90 chars  →   ~410 c/s  →  visibly typed, still quick
 *
 * Two things it must not do. It must not jump to the end when the stream
 * closes — `live` going false leaves whatever is buffered still to type, and
 * cutting to the full text there would undo the effect exactly at the moment
 * the reader is watching. And it must not animate for text that was never
 * streamed: a conversation restored from storage is already finished, and
 * typing it out again on every open would be a lie about what is happening.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Aim to clear whatever is buffered in about this long. */
const DRAIN_MS = 220;
/** Slow enough to read as typing on a one-line reply. */
const MIN_CPS = 180;
/**
 * Headroom, not the usual governor. At Groq's ~800-1600 characters a second
 * the drain constant above binds first and this ceiling is never reached — it
 * earns its keep only when a provider bursts faster than that, where a lower
 * cap would let the reveal fall progressively further behind instead of
 * settling at a fixed lag. Well past reading speed either way.
 */
const MAX_CPS = 2600;
/**
 * How long to wait for a frame before giving up on the effect and showing the
 * text outright. requestAnimationFrame does not run in a backgrounded tab, and
 * does not run at all in some embedded webviews — without this, a reader who
 * switches tabs mid-answer comes back to an empty bubble with a cursor in it.
 * Losing the animation is a disappointment; losing the answer is a bug.
 */
const NO_FRAME_MS = 1200;

/**
 * How far the reveal advances in one frame — the whole of the pacing, pulled
 * out of the hook so it can be tested against a clock instead of a browser.
 *
 * `dt` is seconds since the last frame. Returns the new (fractional) count;
 * the caller floors it for display.
 */
export function revealStep(count: number, target: number, dt: number): number {
  const behind = target - count;
  if (behind <= 0) return target;
  const cps = Math.min(MAX_CPS, Math.max(MIN_CPS, behind / (DRAIN_MS / 1000)));
  /* At least one character per frame, so a nearly-caught-up reveal still
     finishes rather than creeping by fractions forever. */
  return Math.min(target, count + Math.max(1, cps * dt));
}

export function useTypedText(full: string, live: boolean): string {
  const [count, setCount] = useState(() => (live ? 0 : full.length));

  const countRef = useRef(count);
  const targetRef = useRef(full.length);
  const rafRef = useRef(0);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Whether this text was ever streamed. A turn read back from localStorage
     arrives complete and must render complete. */
  const everLive = useRef(live);

  const finish = useCallback((n: number) => {
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    countRef.current = n;
    setCount(n);
  }, []);

  /** Restarted by every frame, so it only fires when frames have stopped. */
  const armWatchdog = useCallback(() => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      watchdogRef.current = null;
      if (countRef.current < targetRef.current) {
        countRef.current = targetRef.current;
        setCount(targetRef.current);
      }
    }, NO_FRAME_MS);
  }, []);

  const ensureLoop = useCallback(() => {
    if (rafRef.current) return;
    let last = 0;

    const tick = (now: number) => {
      /* Seconds since the previous frame, clamped: a backgrounded tab can hand
         back a gap of several seconds, which would dump the whole buffer on
         one frame and look like the jump this exists to remove. */
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;

      const target = targetRef.current;
      if (countRef.current < target) {
        const next = revealStep(countRef.current, target, dt);
        countRef.current = next;
        setCount(Math.floor(next));
      }

      /* Stop when caught up rather than idling a frame loop per turn. A later
         token restarts it through the effect below. */
      if (countRef.current < targetRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        armWatchdog();
      } else {
        rafRef.current = 0;
        if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    armWatchdog();
  }, [armWatchdog]);

  useEffect(() => {
    if (live) everLive.current = true;
    const target = full.length;
    targetRef.current = target;

    /* The answer is re-issued empty when generation starts, so the target can
       move backwards. Follow it down rather than showing stale characters. */
    if (countRef.current > target) { finish(target); return; }

    if (!everLive.current) { finish(target); return; }

    if (countRef.current < target) ensureLoop();
  }, [full, live, ensureLoop, finish]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
  }, []);

  return count >= full.length ? full : full.slice(0, count);
}
