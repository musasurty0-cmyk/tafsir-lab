/**
 * The per-instance throttle.
 *
 * It is the only brake on /api/beta/start, which mints a real account without
 * asking for any code, and on the public waitlist and beta-request forms. If
 * it stops counting, a script can run up demo accounts and outbound email at
 * will.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { memoryLimit } from "./rate-limit";

/* Fake timers so the window can be crossed without the suite sleeping, and so
   each test gets its own keys — the bucket map is module-level state. */
beforeEach(() => { vi.useFakeTimers(); });
afterEach(()  => { vi.useRealTimers(); });

let n = 0;
const freshKey = () => `test-key-${Date.now()}-${n++}`;

describe("memoryLimit", () => {
  it("allows exactly max calls, then refuses", () => {
    const k = freshKey();
    expect([1, 2, 3].map(() => memoryLimit(k, 3, 60_000))).toEqual([true, true, true]);
    expect(memoryLimit(k, 3, 60_000)).toBe(false);
  });

  it("keeps refusing while still inside the window", () => {
    const k = freshKey();
    for (let i = 0; i < 3; i++) memoryLimit(k, 3, 60_000);
    vi.advanceTimersByTime(59_000);
    expect(memoryLimit(k, 3, 60_000)).toBe(false);
  });

  it("lets the caller through again once the window has passed", () => {
    const k = freshKey();
    for (let i = 0; i < 3; i++) memoryLimit(k, 3, 60_000);
    vi.advanceTimersByTime(60_001);
    expect(memoryLimit(k, 3, 60_000)).toBe(true);
  });

  it("counts each key separately, so one caller cannot lock out another", () => {
    const a = freshKey(), b = freshKey();
    for (let i = 0; i < 3; i++) memoryLimit(a, 3, 60_000);
    expect(memoryLimit(a, 3, 60_000)).toBe(false);
    expect(memoryLimit(b, 3, 60_000)).toBe(true);
  });

  it("slides rather than resetting on a fixed boundary", () => {
    /* Two hits, wait most of the window, one more — the first two should age
       out individually rather than the whole bucket clearing at once. */
    const k = freshKey();
    expect(memoryLimit(k, 2, 10_000)).toBe(true);
    vi.advanceTimersByTime(6_000);
    expect(memoryLimit(k, 2, 10_000)).toBe(true);
    expect(memoryLimit(k, 2, 10_000)).toBe(false);   // both still inside
    vi.advanceTimersByTime(4_500);                   // first has now expired
    expect(memoryLimit(k, 2, 10_000)).toBe(true);
  });

  it("treats max of 1 as one call then nothing", () => {
    const k = freshKey();
    expect(memoryLimit(k, 1, 60_000)).toBe(true);
    expect(memoryLimit(k, 1, 60_000)).toBe(false);
  });
});
