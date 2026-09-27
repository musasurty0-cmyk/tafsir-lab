import { describe, it, expect } from "vitest";
import { pushSample, velocityOf, project, FLICK_MIN, type Sample } from "./glide";

/**
 * The physics of a thrown canvas. What matters is not "does it move" but the
 * properties that make a throw read as a throw: velocity taken from the END of
 * the gesture, a stop that stays stopped, and distance proportional to effort.
 */

const drag = (pts: [number, number, number][]): Sample[] => {
  const h: Sample[] = [];
  for (const [x, y, t] of pts) pushSample(h, { x, y, t });
  return h;
};

describe("velocityOf — what the hand was doing at the end", () => {
  it("reads a steady drag", () => {
    // 10px every 10ms = 1 px/ms
    const h = drag([[0, 0, 0], [10, 0, 10], [20, 0, 20], [30, 0, 30]]);
    const { vx, vy } = velocityOf(h);
    expect(vx).toBeCloseTo(1, 5);
    expect(vy).toBeCloseTo(0, 5);
  });

  it("IGNORES the slow start of a drag that ends in a flick", () => {
    // Crawls for 200ms, then flicks. The window is 80ms, so the crawl is gone
    // by the time we ask -- which is the whole point: intent lives at the end.
    const h = drag([
      [0, 0, 0], [1, 0, 100], [2, 0, 200],
      [40, 0, 220], [80, 0, 240], [120, 0, 260],
    ]);
    expect(velocityOf(h).vx).toBeGreaterThan(1.5);
  });

  it("reports a STOP when the hand halted before letting go", () => {
    // Fast across, then held still for 100ms. Releasing should not throw it.
    const h = drag([
      [0, 0, 0], [100, 0, 50],
      [100, 0, 120], [100, 0, 180], [100, 0, 240],
    ]);
    expect(Math.abs(velocityOf(h).vx)).toBeLessThan(FLICK_MIN);
  });

  it("carries both axes independently", () => {
    const h = drag([[0, 0, 0], [10, -5, 10], [20, -10, 20]]);
    const { vx, vy } = velocityOf(h);
    expect(vx).toBeCloseTo(1, 5);
    expect(vy).toBeCloseTo(-0.5, 5);
  });

  it("is zero for a tap", () => {
    expect(velocityOf(drag([[5, 5, 0]]))).toEqual({ vx: 0, vy: 0 });
  });

  it("cannot divide by zero when two samples share a timestamp", () => {
    expect(velocityOf(drag([[0, 0, 7], [40, 0, 7]]))).toEqual({ vx: 0, vy: 0 });
  });
});

describe("pushSample — the window", () => {
  it("drops samples older than the window but never falls below two", () => {
    const h: Sample[] = [];
    for (let t = 0; t <= 400; t += 20) pushSample(h, { x: t, y: 0, t });
    expect(h.length).toBeGreaterThanOrEqual(2);
    expect(h[h.length - 1].t - h[0].t).toBeLessThanOrEqual(100);
  });

  it("keeps a pair even when the two samples are far apart in time", () => {
    const h: Sample[] = [];
    pushSample(h, { x: 0, y: 0, t: 0 });
    pushSample(h, { x: 9, y: 0, t: 5000 });
    expect(h.length).toBe(2);
  });
});

describe("project — distance is what the throw earned", () => {
  it("grows with velocity", () => {
    expect(project(2)).toBeGreaterThan(project(1));
    expect(project(1)).toBeGreaterThan(project(0.1));
  });

  it("is linear in velocity: twice the flick goes twice as far", () => {
    expect(project(2) / project(1)).toBeCloseTo(2, 6);
  });

  it("keeps its sign, so a throw never doubles back", () => {
    expect(project(-1)).toBeCloseTo(-project(1), 6);
  });

  it("puts a brisk 1 px/ms flick in the hundreds of px, not millimetres or miles", () => {
    const d = project(1);
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(1000);
  });
});
