/**
 * When a card comes back, and what colour it is.
 *
 * Boxes, not a full memory model: a card climbs a box each time you get it
 * right and drops to the first when you miss it, and each box waits longer
 * than the last. Easy to explain, and enough for a course's vocabulary.
 *
 *   box 0  not known   black   never answered
 *   box 1  learning    red     missed: back in 10 minutes
 *   box 2  learning    red     1 day
 *   box 3  learning    red     3 days    (where the unlock test puts a word you knew)
 *   box 4  learning    red     7 days
 *   box 5+ learnt      green   16, 35, 75 days
 *
 * Three colours only, as the owner asked: there is no "almost there".
 */

export type Status = "unknown" | "learning" | "learnt";
export type Rating = "again" | "good" | "easy";

const MIN = 60_000;
const DAY = 86_400_000;

/** How long each box waits before the card is due again. */
export const WAIT: number[] = [0, 10 * MIN, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY, 75 * DAY];
export const TOP = WAIT.length - 1;
export const LEARNT_FROM = 5;

export function statusOf(box: number | null | undefined): Status {
  if (!box) return "unknown";
  return box >= LEARNT_FROM ? "learnt" : "learning";
}

/**
 * The next box after an answer. A miss always goes back to box 1 — the card
 * is now being learnt, not unknown — and comes back within the session.
 */
export function nextBox(box: number, rating: Rating): number {
  if (rating === "again") return 1;
  const step = rating === "easy" ? 2 : 1;
  return Math.min(TOP, Math.max(1, box) + step);
}

export function dueAfter(box: number, now = Date.now()): Date {
  return new Date(now + WAIT[Math.max(0, Math.min(TOP, box))]);
}

/**
 * The unlock test: one pass over a lesson to say what you already know.
 * Known goes to box 3 (back in three days); missed goes to box 1. Nothing
 * is learnt off a single answer: a known word still needs two more right
 * answers, days apart, to turn green.
 */
export function unlockBox(correct: boolean): number {
  return correct ? 3 : 1;
}
