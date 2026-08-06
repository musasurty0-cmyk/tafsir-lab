/**
 * Shared shape of the closed-beta application.
 *
 * The form offers these options and the route validates against them, so they
 * live here rather than in both — two copies of a list like this quietly stop
 * matching, and the failure mode is a submission rejected for choosing an
 * option the form itself offered.
 */

export const STUDY_BUCKETS = [
  "Less than 15 minutes",
  "15–30 minutes",
  "30–60 minutes",
  "1–2 hours",
  "More than 2 hours",
  "Not daily yet",
] as const;

export type StudyBucket = typeof STUDY_BUCKETS[number];

/** Widest sensible bounds — a sanity check on a typo, not an entry requirement. */
export const AGE_MIN = 5;
export const AGE_MAX = 120;
