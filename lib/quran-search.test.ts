/**
 * findReference — pulling a verse out of a question.
 *
 * Asking about a specific verse is the commonest thing anyone does, so a miss
 * here is a silent "found nothing" on the most ordinary request. The negative
 * cases matter as much: turning "the 7 heavens" or "12:30pm" into a verse
 * would send the assistant to the wrong place with total confidence.
 */
import { describe, it, expect } from "vitest";
import { findReference, parseReference } from "@/lib/quran-search";

describe("findReference", () => {
  it("finds a reference inside a question", () => {
    expect(findReference("What does it say about 18:65?")).toEqual({ surah: 18, ayah: 65 });
    expect(findReference("explain 2:255 for me")).toEqual({ surah: 2, ayah: 255 });
  });

  it("still handles a bare reference", () => {
    expect(findReference("7:143")).toEqual({ surah: 7, ayah: 143 });
  });

  it("tolerates spaces around the colon", () => {
    expect(findReference("tell me about 20 : 83")).toEqual({ surah: 20, ayah: 83 });
  });

  it("ignores a bare number", () => {
    // "the 7 heavens" must not become surah 7.
    expect(findReference("the 7 heavens")).toBeNull();
    expect(findReference("18")).toBeNull();
  });

  it("rejects a surah out of range", () => {
    expect(findReference("about 200:1")).toBeNull();
  });

  it("rejects an ayah the surah does not have", () => {
    // Al-Fatihah has 7 verses; 1:99 is not a place.
    expect(findReference("what about 1:99")).toBeNull();
    expect(findReference("2:300")).toBeNull();
  });

  it("reads a number pair as a verse even when it looks like a time", () => {
    // 12:30 IS Surat Yusuf verse 30. In a Qur'an study tool the reference
    // reading is the right default, and guessing otherwise from a nearby "pm"
    // would fail the reader who meant the verse.
    expect(findReference("12:30")).toEqual({ surah: 12, ayah: 30 });
  });

  it("returns null when there is no reference", () => {
    expect(findReference("why did Musa break the tablets")).toBeNull();
  });

  it("leaves parseReference's search-box behaviour alone", () => {
    // A bare number still means a surah THERE, where the whole string is the
    // query — only the sentence case needed different handling.
    expect(parseReference("18")).toEqual({ surah: 18 });
  });
});
