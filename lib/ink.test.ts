import { describe, it, expect } from "vitest";
import { packStroke, packStrokes, normPts } from "./ink";

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
