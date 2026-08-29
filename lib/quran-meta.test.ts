/**
 * The juzʾ table, checked against the two facts that make it wrong if broken:
 * every juzʾ must end immediately before the next one starts, and the thirty
 * must cover the muṣḥaf exactly once.
 */
import { describe, it, expect } from "vitest";
import { JUZ_STARTS, juzEnd, ayahCount, TOTAL_AYAT, SURAH_AYAH_COUNTS } from "@/lib/quran-meta";

const flat = (s: number, a: number) => {
  let n = 0;
  for (let i = 1; i < s; i++) n += ayahCount(i);
  return n + a;
};

describe("quran-meta", () => {
  it("has 114 surahs totalling 6236 ayat", () => {
    expect(SURAH_AYAH_COUNTS).toHaveLength(114);
    expect(SURAH_AYAH_COUNTS.reduce((a, b) => a + b, 0)).toBe(TOTAL_AYAT);
  });

  it("has 30 juz starting at 1:1", () => {
    expect(JUZ_STARTS).toHaveLength(30);
    expect(JUZ_STARTS[0]).toEqual([1, 1]);
  });

  it("ends each juz exactly one ayah before the next begins", () => {
    for (let j = 1; j < 30; j++) {
      const [es, ea] = juzEnd(j);
      const [ns, na] = JUZ_STARTS[j];
      expect(flat(es, ea) + 1).toBe(flat(ns, na));
    }
  });

  it("runs the last juz to the end of the mushaf", () => {
    expect(juzEnd(30)).toEqual([114, 6]);
    expect(flat(114, 6)).toBe(TOTAL_AYAT);
  });
});
