/**
 * The streak rules, which are all edge case.
 *
 * The one that matters: a streak must not break at midnight. Someone with a
 * 40-day run who opens the app at 00:05 has not lost it — they simply have not
 * written today yet. So a run ending yesterday still counts as current, and
 * only a gap of two days or more ends it.
 */
import { describe, it, expect } from "vitest";
import { streakFromDays } from "@/lib/services/analytics.service";

describe("streakFromDays", () => {
  it("is zero with no activity", () => {
    expect(streakFromDays([], "2026-08-29")).toEqual({ current: 0, best: 0 });
  });

  it("counts a run that ends today", () => {
    expect(streakFromDays(["2026-08-27", "2026-08-28", "2026-08-29"], "2026-08-29"))
      .toEqual({ current: 3, best: 3 });
  });

  it("keeps the run alive when today has nothing yet", () => {
    expect(streakFromDays(["2026-08-27", "2026-08-28"], "2026-08-29"))
      .toEqual({ current: 2, best: 2 });
  });

  it("ends the run once a whole day is missed", () => {
    expect(streakFromDays(["2026-08-26", "2026-08-27"], "2026-08-29").current).toBe(0);
  });

  it("remembers the best run after the current one breaks", () => {
    const days = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-29"];
    expect(streakFromDays(days, "2026-08-29")).toEqual({ current: 1, best: 4 });
  });

  it("counts a single day as a streak of one", () => {
    expect(streakFromDays(["2026-08-29"], "2026-08-29")).toEqual({ current: 1, best: 1 });
  });

  it("crosses a month boundary", () => {
    expect(streakFromDays(["2026-07-30", "2026-07-31", "2026-08-01"], "2026-08-01").current).toBe(3);
  });

  it("crosses a leap day", () => {
    expect(streakFromDays(["2028-02-28", "2028-02-29", "2028-03-01"], "2028-03-01").current).toBe(3);
  });
});
