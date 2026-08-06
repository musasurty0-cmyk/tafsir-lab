/**
 * Connection identity.
 *
 * These keys decide whether two Connections are the same relationship, and the
 * pair key is carried by a UNIQUE INDEX in the database. If pairKeyFor stops
 * collapsing A→B and B→A onto one value, the index stops catching reversed
 * duplicates and the same munāsabah can be recorded twice — quietly, and
 * unfixably once users have both.
 */
import { describe, it, expect } from "vitest";
import {
  parseObjectKey, pairKeyFor, isSelfLink, canConnect, otherEnd,
  ayahKey, surahKey, selectionKey,
} from "./quran-objects";

describe("parseObjectKey", () => {
  it("reads the three key shapes", () => {
    expect(parseObjectKey("ayah:2:255")).toMatchObject({ type: "ayah", surah: 2, ayah: 255 });
    expect(parseObjectKey("surah:114")).toMatchObject({ type: "surah", surah: 114 });
    expect(parseObjectKey("selection:abc-123")).toMatchObject({ type: "selection", id: "abc-123" });
  });

  /* The comment on this function promises malformed keys "fail closed rather
     than resolving to Al-Fātiḥah" — i.e. never silently become surah 1. */
  it.each([
    ["ayah:0:1",      "surah 0"],
    ["ayah:115:1",    "surah past 114"],
    ["ayah:1:0",      "ayah 0"],
    ["ayah:x:1",      "non-numeric surah"],
    ["surah:0",       "surah 0"],
    ["surah:115",     "surah past 114"],
    ["selection:",    "empty id"],
    ["",              "empty string"],
    ["nonsense",      "unknown kind"],
    ["ayah:1",        "missing ayah"],
  ])("refuses %s (%s)", (key) => {
    expect(parseObjectKey(key)).toBeNull();
  });

  it("does not coerce a bad key to surah 1", () => {
    for (const bad of ["ayah:0:1", "surah:0", "ayah:x:y"]) {
      expect(parseObjectKey(bad)?.surah).not.toBe(1);
    }
  });

  it("keeps a uuid intact even though it is split on colons", () => {
    const id = "6ec7edaa-f804-4c4c-8c71-7a97862de91c";
    expect(parseObjectKey(selectionKey(id))?.id).toBe(id);
  });
});

describe("pairKeyFor — the dedup invariant", () => {
  it("gives the same key whichever way round the pair is written", () => {
    const a = ayahKey(1, 1), b = ayahKey(15, 87);
    expect(pairKeyFor(a, b)).toBe(pairKeyFor(b, a));
  });

  it("distinguishes genuinely different pairs", () => {
    expect(pairKeyFor(ayahKey(1, 1), ayahKey(15, 87)))
      .not.toBe(pairKeyFor(ayahKey(1, 2), ayahKey(15, 87)));
  });

  it("holds across mixed object types", () => {
    const s = surahKey(1), a = ayahKey(15, 87);
    expect(pairKeyFor(s, a)).toBe(pairKeyFor(a, s));
  });

  it("uses a separator that cannot appear in a key half", () => {
    /* Keys are colon-delimited; the pair separator must not collide, or
       "a|b" and "a" + "|b" could be confused. */
    expect(pairKeyFor(ayahKey(1, 1), surahKey(2))).toContain("|");
    expect(ayahKey(1, 1)).not.toContain("|");
  });
});

describe("canConnect", () => {
  it("refuses an object joined to itself", () => {
    expect(isSelfLink(ayahKey(1, 1), ayahKey(1, 1))).toBe(true);
    expect(canConnect(ayahKey(1, 1), ayahKey(1, 1)).ok).toBe(false);
  });

  /* Documented behaviour: a Surah and one of its own āyāt are different study
     objects, so this pair is deliberately allowed. */
  it("allows a surah joined to one of its own ayat", () => {
    expect(canConnect(surahKey(1), ayahKey(1, 5)).ok).toBe(true);
  });

  it("refuses a pair where either side is unparseable", () => {
    expect(canConnect("ayah:0:1", ayahKey(1, 1)).ok).toBe(false);
    expect(canConnect(ayahKey(1, 1), "junk").ok).toBe(false);
  });

  it("allows an ordinary cross-surah pair", () => {
    expect(canConnect(ayahKey(1, 1), ayahKey(15, 87)).ok).toBe(true);
  });
});

describe("otherEnd — one record, both viewpoints", () => {
  const conn = {
    sourceType: "surah", sourceKey: surahKey(1),
    targetType: "ayah",  targetKey: ayahKey(15, 87),
  };

  it("returns the target when viewed from the source", () => {
    expect(otherEnd(conn, surahKey(1))).toEqual({ type: "ayah", key: ayahKey(15, 87) });
  });

  it("returns the source when viewed from the target", () => {
    expect(otherEnd(conn, ayahKey(15, 87))).toEqual({ type: "surah", key: surahKey(1) });
  });
});
