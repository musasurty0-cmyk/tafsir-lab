/**
 * Static Qurʾān metadata.
 *
 * Ayah counts are fixed and universally agreed for the Hafs muṣḥaf, so they
 * are a constant rather than a fetch: range validation must work on the server
 * without a network round-trip, and a segment saved past the end of a surah
 * would render as a marker spanning nothing.
 */

/** Number of āyāt in each surah, indexed 0 = Al-Fātiḥah … 113 = An-Nās. */
export const SURAH_AYAH_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6,
];

/** Ayah count for a surah number (1-based). 0 when out of range. */
export function ayahCount(surahNumber: number): number {
  return SURAH_AYAH_COUNTS[surahNumber - 1] ?? 0;
}

/** Total āyāt in the muṣḥaf — used as a sanity check on the table above. */
export const TOTAL_AYAT = 6236;

/**
 * Where each juzʾ begins, as [surah, ayah].
 *
 * The standard Ḥafṣ division. Held as start points rather than ranges because
 * a juzʾ ends exactly where the next one begins, and storing both invites the
 * two to disagree — juzEnd() derives the end from the following entry, and the
 * last one ends at the end of the muṣḥaf.
 */
export const JUZ_STARTS: readonly (readonly [number, number])[] = [
  [1, 1],   [2, 142], [2, 253], [3, 93],  [4, 24],  [4, 148], [5, 82],  [6, 111],
  [7, 88],  [8, 41],  [9, 93],  [11, 6],  [12, 53], [15, 1],  [17, 1],  [18, 75],
  [21, 1],  [23, 1],  [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32],
  [41, 47], [46, 1],  [51, 31], [58, 1],  [67, 1],  [78, 1],
];

/** Inclusive end of a juzʾ (1-based), as [surah, ayah]. */
export function juzEnd(juz: number): readonly [number, number] {
  const next = JUZ_STARTS[juz];                  // JUZ_STARTS[juz] is juz+1's start
  if (!next) return [114, ayahCount(114)];       // the last juzʾ runs to the end
  const [s, a] = next;
  return a > 1 ? [s, a - 1] : [s - 1, ayahCount(s - 1)];
}
