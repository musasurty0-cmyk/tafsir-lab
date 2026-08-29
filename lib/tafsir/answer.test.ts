/**
 * Answer composition tests.
 *
 * The one that matters most is `verifyExtractive`: it is the executable form of
 * "the assistant does not make things up". If selection ever starts emitting a
 * sentence that is not in the corpus, this must fail — so the suite includes a
 * deliberately fabricated sentence to prove the check can actually catch one,
 * rather than only testing that honest input passes.
 */
import { describe, it, expect } from "vitest";
import {
  foldArabic, normalise, terms, sentences,
  selectSentences, verifyExtractive, type Passage,
} from "@/lib/tafsir/answer";

const P: Passage[] = [
  {
    sourceSlug: "ar-tafsir-ibn-kathir", sourceName: "Ibn Kathīr", language: "ar",
    verseKey: "2:153",
    content:
      "يقول تعالى آمرا عباده المؤمنين بالاستعانة على أمورهم بالصبر والصلاة. " +
      "والصبر نوعان صبر على ترك المناهي وصبر على فعل الطاعات. " +
      "وهذه الآية فيها بشارة عظيمة لأهل الصبر بمعية الله لهم.",
  },
  {
    sourceSlug: "en-tafisr-ibn-kathir", sourceName: "Ibn Kathīr (English)", language: "en",
    verseKey: "2:153",
    content:
      "Allah commands the believers to seek help through patience and prayer. " +
      "Patience is of two kinds, patience in avoiding what is forbidden and patience in performing acts of obedience. " +
      "This verse contains great glad tidings for the patient, that Allah is with them.",
  },
];

describe("foldArabic", () => {
  it("strips diacritics so the same word matches itself", () => {
    expect(foldArabic("الصَّبْرِ")).toBe(foldArabic("الصبر"));
  });
  it("folds alif and ya variants", () => {
    expect(foldArabic("إبراهيم")).toBe(foldArabic("ابراهيم"));
    expect(foldArabic("على")).toBe(foldArabic("علي"));
  });
});

describe("terms", () => {
  it("drops stop words in both scripts", () => {
    expect(terms("what does it say about patience")).toEqual(["patience"]);
  });

  it("keeps both the written form and its stem for Arabic", () => {
    // Both, not just the stem: an exact match should still score, and a
    // passage that writes the word without the article should also be findable.
    expect(terms("ما قال في الصبر").sort()).toEqual(["الصبر", "صبر"].sort());
  });

  it("strips a prefixed preposition with the article", () => {
    expect(terms("بالصبر")).toContain("صبر");
  });

  it("does not over-strip a short word into nothing", () => {
    // Three letters must survive; stripping here would merge unrelated roots.
    for (const w of terms("نار")) expect(w.length).toBeGreaterThanOrEqual(3);
  });

  it("returns nothing for a query of only stop words", () => {
    expect(terms("what is that")).toEqual([]);
  });
});

describe("sentences", () => {
  it("splits on Arabic and Latin terminators", () => {
    expect(sentences(P[1].content)).toHaveLength(3);
    expect(sentences(P[0].content)).toHaveLength(3);
  });
  it("does not emit fragments", () => {
    // A stray short piece is glued to its neighbour rather than standing alone.
    const out = sentences("A full sentence that runs on for a while here. No.");
    expect(out.every((s) => s.length >= 40)).toBe(true);
  });
});

describe("selectSentences", () => {
  it("finds the sentences that answer the question", () => {
    const out = selectSentences("What are the two kinds of patience?", P);
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((s) => s.text.includes("two kinds"))).toBe(true);
  });

  it("carries the citation with every sentence", () => {
    for (const s of selectSentences("patience and prayer", P)) {
      expect(s.verseKey).toBe("2:153");
      expect(s.sourceName).toBeTruthy();
    }
  });

  it("caps how much any one source contributes", () => {
    const out = selectSentences("patience", P, { max: 10, perSource: 1 });
    const bySource = new Map<string, number>();
    for (const s of out) bySource.set(s.sourceSlug, (bySource.get(s.sourceSlug) ?? 0) + 1);
    expect([...bySource.values()].every((n) => n <= 1)).toBe(true);
  });

  it("returns nothing rather than something irrelevant", () => {
    expect(selectSentences("photosynthesis in tomato plants", P)).toEqual([]);
  });

  it("returns nothing for a query with no meaningful terms", () => {
    expect(selectSentences("what is that", P)).toEqual([]);
  });

  it("matches Arabic across diacritics", () => {
    const out = selectSentences("الصَّبْر", P);
    expect(out.some((s) => s.sourceSlug === "ar-tafsir-ibn-kathir")).toBe(true);
  });

  it("matches a definite-article query against an unprefixed passage", () => {
    // The failure this stemming exists for: retrieving the right passage and
    // then quoting nothing from it, which reads as the source being silent.
    const unprefixed: Passage[] = [{
      sourceSlug: "x", sourceName: "X", language: "ar", verseKey: "2:250",
      content: "توجهوا إلى الله بالدعاء قائلين ربنا أفرغ علينا صبرا وثبت أقدامنا وانصرنا على القوم الكافرين.",
    }];
    expect(selectSentences("الصبر", unprefixed).length).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const a = selectSentences("patience and prayer", P);
    const b = selectSentences("patience and prayer", P);
    expect(a.map((s) => s.text)).toEqual(b.map((s) => s.text));
  });
});

describe("verifyExtractive", () => {
  it("passes when every sentence came from the corpus", () => {
    const sel = selectSentences("patience and prayer", P);
    expect(verifyExtractive(sel, P)).toEqual({ ok: true });
  });

  it("CATCHES a fabricated sentence", () => {
    // The case the whole design exists to prevent: fluent, plausible, and
    // attributed to a named scholar who never wrote it.
    const forged = [{
      text: "Ibn Kathīr states that patience is the highest of all the stations of the wayfarers.",
      sourceSlug: "ar-tafsir-ibn-kathir", sourceName: "Ibn Kathīr",
      verseKey: "2:153", score: 99,
    }];
    const res = verifyExtractive(forged, P);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.offending).toContain("highest of all the stations");
  });

  it("catches a sentence attributed to the wrong source", () => {
    // Real text, wrong scholar — a subtler failure than invention, and just as
    // damaging when the output is a citation.
    const misattributed = [{
      text: "Patience is of two kinds, patience in avoiding what is forbidden and patience in performing acts of obedience.",
      sourceSlug: "ar-tafsir-ibn-kathir",       // this is the ENGLISH edition's text
      sourceName: "Ibn Kathīr", verseKey: "2:153", score: 5,
    }];
    expect(verifyExtractive(misattributed, P).ok).toBe(false);
  });

  it("passes an empty selection", () => {
    expect(verifyExtractive([], P)).toEqual({ ok: true });
  });
});
