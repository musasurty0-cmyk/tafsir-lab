import { describe, it, expect } from "vitest";
import {
  parseLessonPath, cleanTitle, lessonKind, parseCsvPair, splitArabic,
  parseDeck, numberLessons, foldArabic, type ParsedLesson,
} from "./parse";

describe("parseLessonPath", () => {
  it("reads the level from the folder and the lesson from the file", () => {
    expect(parseLessonPath("English/Level 1/Lesson 12 - Verbs in the Classroom.txt"))
      .toEqual({ level: 1, fileNo: 12, title: "Verbs in the Classroom" });
  });
  it("accepts backslashes and a missing folder with a fallback", () => {
    expect(parseLessonPath("Level 2\\Lesson 3 - X.txt")?.level).toBe(2);
    expect(parseLessonPath("Lesson 4 - Y.txt", 3)).toEqual({ level: 3, fileNo: 4, title: "Y" });
    expect(parseLessonPath("Lesson 4 - Y.txt")).toBeNull();
  });
  it("ignores anything that is not a lesson file", () => {
    expect(parseLessonPath("English/Level 1/notes.txt")).toBeNull();
    expect(parseLessonPath("English/Level 1/Lesson 1.pdf")).toBeNull();
  });
});

describe("cleanTitle", () => {
  it("fixes the course's own title slips", () => {
    expect(cleanTitle("Man und Ma, Hadha und Hadhi")).toBe("Man and Ma, Hadha and Hadhi");
    expect(cleanTitle("The Storey of Omar Ibn Al Khattab (RA) (English)")).toBe("The Story of Omar Ibn Al Khattab (RA)");
    expect(cleanTitle("Getting to know eachother 1 of 2")).toBe("Getting to know each other 1 of 2");
    expect(cleanTitle("Madha Yaf_al")).toBe("Madha Yaf’al");
  });
});

describe("lessonKind", () => {
  it("tells teaching lessons from revision and preparation", () => {
    expect(lessonKind(0, "Additional Preparation")).toBe("prep");
    expect(lessonKind(18, "Revising Numbers, Plurals, and Sentences")).toBe("revision");
    expect(lessonKind(13, "Verbs of the Classroom in Every Form")).toBe("lesson");
  });
});

describe("cards", () => {
  it("parses a quoted pair, including doubled quotes", () => {
    expect(parseCsvPair(`"ear (f)","هَذِهِ أُذُنٌ (hādhihi udhun)"`)).toEqual(["ear (f)", "هَذِهِ أُذُنٌ (hādhihi udhun)"]);
    expect(parseCsvPair(`"he said ""yes""","قَالَ"`)).toEqual([`he said "yes"`, "قَالَ"]);
    expect(parseCsvPair(`"only one"`)).toBeNull();
  });
  it("separates the transliteration, and leaves Arabic without one alone", () => {
    expect(splitArabic("هَذَا أَنْفٌ (hādhā anf)")).toEqual({ arabic: "هَذَا أَنْفٌ", translit: "hādhā anf" });
    expect(splitArabic("مَكْتُوبٌ، مَكْتَبٌ")).toEqual({ arabic: "مَكْتُوبٌ، مَكْتَبٌ", translit: null });
    expect(splitArabic("صِفْرٌ (ṣifr) ٠")).toEqual({ arabic: "صِفْرٌ ٠", translit: "ṣifr" });
  });
  it("splits groups on blank lines, reads gender, and spots sentences", () => {
    const deck = [
      `"Front","Back"`,
      `"ear (f)","هَذِهِ أُذُنٌ (hādhihi udhun)"`,
      `"nose (m)","هَذَا أَنْفٌ (hādhā anf)"`,
      `"one","١ (wāḥid)"`,
      ``, ``,
      `"The teacher wrote on the board with the pen.","كَتَبَ الْمُدَرِّسُ بِالْقَلَمِ عَلَى السَّبُّورَةِ. (kataba…)"`,
    ].join("\r\n");
    const cards = parseDeck("﻿" + deck);
    expect(cards).toHaveLength(4);
    expect(cards[0]).toMatchObject({ english: "ear", gender: "f", group: 0, isSentence: false });
    expect(cards[1].group).toBe(0);
    expect(cards[2]).toMatchObject({ arabic: "١", translit: "wāḥid" });
    expect(cards[3]).toMatchObject({ group: 1, isSentence: true });
  });
});

describe("numberLessons", () => {
  const lesson = (fileNo: number, title: string, level = 1): ParsedLesson =>
    ({ level, fileNo, title, kind: lessonKind(fileNo, title), cards: [] });

  it("numbers teaching lessons only, in file order, per level", () => {
    const files = [
      lesson(0, "Additional Preparation"),
      ...Array.from({ length: 17 }, (_, i) => lesson(i + 1, `L${i + 1}`)),
      lesson(18, "Revising Numbers"),
      lesson(19, "Revising Household"),
      ...Array.from({ length: 9 }, (_, i) => lesson(i + 20, `L${i + 20}`)),
      lesson(1, "Level two first", 2),
    ];
    const n = numberLessons(files.reverse());
    const byFile = (level: number, f: number) => n.find((l) => l.level === level && l.fileNo === f)!.number;
    expect(byFile(1, 0)).toBeNull();
    expect(byFile(1, 13)).toBe(13);
    expect(byFile(1, 18)).toBeNull();
    expect(byFile(1, 20)).toBe(18);
    expect(byFile(1, 28)).toBe(26);
    expect(byFile(2, 1)).toBe(1);
  });
});

describe("foldArabic", () => {
  it("matches with or without ḥarakāt and across letter variants", () => {
    expect(foldArabic("رُكْبَةٌ")).toBe(foldArabic("ركبة"));
    expect(foldArabic("أُذُنٌ")).toBe("اذن");
    expect(foldArabic("مُصْطَفَى")).toBe("مصطفي");
  });
});
