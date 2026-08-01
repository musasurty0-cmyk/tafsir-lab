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
