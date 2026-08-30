/**
 * Which sūrah a reader meant.
 *
 * The first case here is the one that shipped broken: "Surah saf main maqsad"
 * resolved to nothing, so retrieval was never scoped and the answer was drawn
 * from al-Baqarah on poetry and an-Naḥl on mules.
 *
 * The negative cases matter as much. Scoping to the wrong sūrah is worse than
 * not scoping at all — an unscoped search returns weak passages the model will
 * say are weak, while a wrongly scoped one returns confident commentary on
 * something nobody asked about.
 */
import { describe, it, expect } from "vitest";
import { findSurahInText } from "@/lib/tafsir/surah-names";

describe("findSurahInText", () => {
  it("resolves the case that failed: a bare name after 'surah'", async () => {
    expect(await findSurahInText("Surah saf main maqsad")).toBe(61);
  });
  it("resolves a full name with its article", async () => {
    expect(await findSurahInText("what does surah al-baqarah say")).toBe(2);
  });
  it("resolves a name with no introducing word", async () => {
    expect(await findSurahInText("what is al-fatihah about")).toBe(1);
  });
  it("resolves an explicit number", async () => {
    expect(await findSurahInText("surah 61 purpose")).toBe(61);
  });
  it("rejects an out-of-range number", async () => {
    expect(await findSurahInText("surah 900")).toBe(null);
  });
  it("does not scope an ordinary question to a short name", async () => {
    expect(await findSurahInText("who was al-Khidr and what did Musa learn")).toBe(null);
    expect(await findSurahInText("what does the Quran say about patience")).toBe(null);
    expect(await findSurahInText("tell me about the people")).toBe(null);
  });
  it("tolerates the spellings readers actually use", async () => {
    // The dataset says "As-Saf"; nearly everyone writes "As-Saff".
    expect(await findSurahInText("surah saff main maqsad")).toBe(61);
    expect(await findSurahInText("what is al-baqara about")).toBe(2);
    expect(await findSurahInText("surah fatiha")).toBe(1);
    expect(await findSurahInText("as-saff")).toBe(61);
  });

  it("returns null for nothing", async () => {
    expect(await findSurahInText("")).toBe(null);
  });
});
