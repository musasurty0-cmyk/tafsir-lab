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
/** Fast enough that a long answer is never held back. */
const MAX_CPS = 1400;

export function useTypedText(full: string, live: boolean): string {
  const [count, setCount] = useState(() => (live ? 0 : full.length));

  const countRef = useRef(count);
  const targetRef = useRef(full.length);
  const rafRef = useRef(0);
  /* Whether this text was ever streamed. A turn read back from localStorage
     arrives complete and must render complete. */
  const everLive = useRef(live);

  const finish = useCallback((n: number) => {
    countRef.current = n;
    setCount(n);
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
      const behind = target - countRef.current;

      if (behind > 0) {
        const cps = Math.min(MAX_CPS, Math.max(MIN_CPS, behind / (DRAIN_MS / 1000)));
        const next = Math.min(target, countRef.current + Math.max(1, cps * dt));
        countRef.current = next;
        setCount(Math.floor(next));
      }

      /* Stop when caught up rather than idling a frame loop per turn. A later
         token restarts it through the effect below. */
      rafRef.current = countRef.current < targetRef.current
        ? requestAnimationFrame(tick)
        : 0;
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

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

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return count >= full.length ? full : full.slice(0, count);
}
