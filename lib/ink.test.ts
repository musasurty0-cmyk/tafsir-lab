import { describe, it, expect } from "vitest";
import { packStroke, packStrokes, normPts, resample, streamline } from "./ink";

/**
 * The ink codec touches strokes people have already drawn, so the properties
 * that matter are not "is it smaller" but "is anything lost". Every test below
 * is about preservation; the size win is measured separately.
 */

const objPts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ x: i + 0.123456789, y: i * 2 + 0.987654321 }));

describe("normPts — reads both stored shapes", () => {
  it("passes tuples through", () => {
    expect(normPts([[1, 2, 0.5]])).toEqual([[1, 2, 0.5]]);
  });

  it("converts legacy {x,y} objects, defaulting pressure", () => {
    expect(normPts([{ x: 3, y: 4 }])).toEqual([[3, 4, 0.5]]);
  });

  it("survives an empty stroke", () => {
    expect(normPts([])).toEqual([]);
  });
});

describe("packStroke — the thing that must not lose ink", () => {
  it("KEEPS EVERY POINT — nothing is simplified away", () => {
    const s = { id: "a", points: objPts(500) };
    expect((packStroke(s).points as unknown[]).length).toBe(500);
  });

  it("rounds to a tenth of a pixel, no finer", () => {
    const s = { id: "a", points: [{ x: 574.2222290039062, y: 81.33333206176758 }] };
    expect(packStroke(s).points).toEqual([[574.2, 81.3, 0.5]]);
  });

  it("never moves a point by more than 0.05px", () => {
    const src = objPts(200);
    const out = packStroke({ id: "a", points: src }).points as unknown as number[][];
    src.forEach((p, i) => {
      expect(Math.abs(out[i][0] - p.x)).toBeLessThanOrEqual(0.05 + 1e-9);
      expect(Math.abs(out[i][1] - p.y)).toBeLessThanOrEqual(0.05 + 1e-9);
    });
  });

  it("is idempotent — packing twice equals packing once", () => {
    const once  = packStroke({ id: "a", points: objPts(50) });
    const twice = packStroke(once);
    expect(twice.points).toEqual(once.points);
  });

  it("preserves pressure that was already recorded", () => {
    const s = { id: "a", points: [[1.04, 2.06, 0.9]] };
    expect(packStroke(s).points).toEqual([[1, 2.1, 0.9]]);
  });

  it("keeps every non-point field untouched", () => {
    const s = { id: "a", tool: "pen", color: "#18181b", width: 3, opacity: 1,
                mushafPage: 7, surface: "canvas", points: objPts(3) };
    const out = packStroke(s);
    expect({ ...out, points: undefined }).toEqual({ ...s, points: undefined });
  });

  it("leaves an empty or missing points array alone", () => {
    expect(packStroke({ id: "a", points: [] as unknown[] }).points).toEqual([]);
    expect(packStroke({} as { points?: unknown })).toEqual({});
  });
});

describe("packStrokes — a whole drawing", () => {
  it("packs a mix of legacy and already-packed strokes", () => {
    const out = packStrokes([
      { id: "old", points: [{ x: 1.06, y: 2.04 }] },
      { id: "new", points: [[3.06, 4.04, 0.5]] },
    ]);
    expect(out[0].points).toEqual([[1.1, 2, 0.5]]);
    expect(out[1].points).toEqual([[3.1, 4, 0.5]]);
  });

  it("keeps stroke order and count", () => {
    const src = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, points: objPts(5) }));
    const out = packStrokes(src);
    expect(out.length).toBe(40);
    expect(out.map((s) => s.id)).toEqual(src.map((s) => s.id));
  });

  it("actually shrinks the payload it was written for", () => {
    const src = Array.from({ length: 20 }, () => ({ id: "s", points: objPts(60) }));
    const before = JSON.stringify(src).length;
    const after  = JSON.stringify(packStrokes(src)).length;
    expect(after).toBeLessThan(before / 2);
  });
});

/* ── Stroke smoothing ──────────────────────────────────────────────────────
   The reported symptom was a pen that drew polygons: straight facets with a
   corner at every sample. The cause was gap-filling along the CHORD between
   two samples, which lengthens the flat parts and leaves every corner exactly
   as sharp as it was. These pin the property that fixes it — inserted points
   leave the chord — rather than any particular curve maths. */
describe("resample", () => {
  const dist = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]);

  /** How far a point sits from the straight line through a→b. */
  function offChord(a: number[], b: number[], p: number[]): number {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (!len) return dist(a, p);
    return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
  }

  it("bends inserted points away from the chord at a corner", () => {
    // A right angle, sampled sparsely — the shape a quick mouse stroke makes.
    const corner: [number, number, number][] = [
      [0, 0, 0.5], [40, 0, 0.5], [40, 40, 0.5],
    ];
    const out = resample(corner, 4);
    const added = out.filter((p) => !corner.some((c) => dist(c, p) < 1e-9));
    expect(added.length).toBeGreaterThan(10);

    // At least some inserted point must leave the straight line it replaced.
    // Linear interpolation — the bug — puts every one of them exactly on it.
    const worst = Math.max(...added.map((p) => Math.min(
      offChord(corner[0], corner[1], p),
      offChord(corner[1], corner[2], p),
    )));
    expect(worst).toBeGreaterThan(0.5);
  });

  it("leaves the original samples where they were", () => {
    const pts: [number, number, number][] = [[0, 0, 0.5], [30, 10, 0.5], [60, 0, 0.5]];
    const out = resample(pts, 4);
    for (const original of pts) {
      expect(out.some((p) => dist(p, original) < 1e-9)).toBe(true);
    }
  });

  it("adds nothing to an already dense stroke", () => {
    const dense: [number, number, number][] = Array.from({ length: 20 }, (_, i) =>
      [i, 0, 0.5] as [number, number, number]);
    expect(resample(dense, 4)).toHaveLength(dense.length);
  });

  it("keeps a straight line straight", () => {
    const line: [number, number, number][] = [[0, 0, 0.5], [100, 0, 0.5]];
    for (const p of resample(line, 4)) expect(Math.abs(p[1])).toBeLessThan(1e-6);
  });

  it("survives a single point and a pair", () => {
    expect(resample([[1, 2, 0.5]], 4)).toHaveLength(1);
    expect(resample([], 4)).toHaveLength(0);
  });
});

describe("streamline", () => {
  it("ends exactly where the stroke ended", () => {
    // The filter trails its input; the true lift point must be pinned back on
    // or short strokes fall short of the mark the reader made.
    const pts: [number, number, number][] = [[0, 0, 0.5], [10, 10, 0.5], [20, 5, 0.5]];
    const out = streamline(pts);
    const last = out[out.length - 1];
    expect(last[0]).toBeCloseTo(20, 6);
    expect(last[1]).toBeCloseTo(5, 6);
  });

  it("starts exactly where the stroke started", () => {
    const pts: [number, number, number][] = [[3, 7, 0.5], [10, 10, 0.5]];
    expect(streamline(pts)[0]).toEqual([3, 7, 0.5]);
  });

  it("pulls a spike back towards its neighbours", () => {
    const spiky: [number, number, number][] = [
      [0, 0, 0.5], [10, 0, 0.5], [20, 30, 0.5], [30, 0, 0.5], [40, 0, 0.5],
    ];
    const out = streamline(spiky);
    const peak = Math.max(...out.map((p) => p[1]));
    expect(peak).toBeLessThan(30);
  });
});
