/**
 * The pacing of the typed reveal.
 *
 * This is timing behaviour, which is exactly what a browser check cannot pin
 * down: the preview pane starves both frames and timers, so "it looked smooth"
 * is not something that can be observed there. Driving the pure step function
 * against a synthetic clock can be.
 *
 * What matters is the shape, not the constants. A reveal that lurches is the
 * bug this exists to fix, and a reveal that holds a finished answer back is a
 * worse one — so both are asserted.
 */
import { describe, it, expect } from "vitest";
import { revealStep } from "@/lib/use-typed-text";

const FRAME = 1 / 60;

/** Run the reveal to completion against a fixed target; report the steps. */
function runToEnd(target: number, dt = FRAME, cap = 100_000) {
  let count = 0;
  const steps: number[] = [];
  let frames = 0;
  while (count < target && frames < cap) {
    const next = revealStep(count, target, dt);
    steps.push(next - count);
    count = next;
    frames++;
  }
  return { frames, steps, seconds: frames * dt, done: count >= target };
}

describe("revealStep", () => {
  it("never overshoots the text that has arrived", () => {
    expect(revealStep(99, 100, 10)).toBe(100);
    expect(revealStep(100, 100, 10)).toBe(100);
  });

  it("does not go backwards when the target is already met", () => {
    expect(revealStep(500, 120, FRAME)).toBe(120);
  });

  it("always advances, so a reveal cannot stall short of the end", () => {
    // Fractional rates would otherwise creep forever near the target.
    let count = 0;
    for (let i = 0; i < 10; i++) count = revealStep(count, 3, 0.0001);
    expect(count).toBe(3);
  });

  it("reveals in many small steps rather than one jump", () => {
    const { steps, frames } = runToEnd(1200);
    expect(frames).toBeGreaterThan(20);
    // The largest single frame is a small fraction of the whole answer: that
    // is the difference between typing and the chunked arrival it replaces.
    expect(Math.max(...steps)).toBeLessThan(1200 * 0.2);
  });

  it("finishes a long answer promptly instead of holding it back", () => {
    // A 900-word answer, already fully arrived.
    const { seconds, done } = runToEnd(5400);
    expect(done).toBe(true);
    expect(seconds).toBeLessThan(5);
  });

  it("types a short reply visibly rather than flashing it", () => {
    const { seconds, done } = runToEnd(90);
    expect(done).toBe(true);
    expect(seconds).toBeGreaterThan(0.1);
  });

  it("keeps pace with a stream instead of falling behind it", () => {
    /* 2,700 characters arriving over two seconds, the shape of a real answer.
       The reveal must track it, not queue up behind it. */
    const TOTAL = 2700, ARRIVE_S = 2;
    let arrived = 0, shown = 0, t = 0, worstLag = 0;

    while (shown < TOTAL) {
      t += FRAME;
      arrived = Math.min(TOTAL, Math.round((t / ARRIVE_S) * TOTAL));
      shown = revealStep(shown, arrived, FRAME);
      worstLag = Math.max(worstLag, arrived - shown);
      if (t > 30) break;
    }

    /* Measured on these constants: it settles 275 characters behind and
       finishes 0.63s after the last token. Both are properties worth holding
       — the first says it never lags far enough to feel like waiting, the
       second that the tail is a short ease-out rather than a queue draining
       long after the answer is done. The bounds are loose enough to survive
       tuning and tight enough to catch a regression. */
    expect(worstLag).toBeLessThan(350);
    expect(t).toBeLessThan(ARRIVE_S + 1);
  });

  it("survives a long frame gap without dumping the buffer", () => {
    /* The hook clamps dt to 50ms before calling this, so a tab that was
       backgrounded for ten seconds still advances by one frame's worth. */
    const step = revealStep(0, 5000, 0.05);
    expect(step).toBeLessThan(5000 * 0.05);
  });
});
