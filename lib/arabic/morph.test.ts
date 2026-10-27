import { describe as group, it, expect } from "vitest";
import { describe, verbForm, rootLetters } from "./morph";

group("morph", () => {
  it("reads verbs", () => {
    expect(describe("V", "IMPF|VF:10|1P|MOOD:IND")).toBe("present-tense verb, form X · we");
    expect(describe("V", "PERF|PASS|VF:1|3MS")).toBe("past-tense passive verb, form I · he");
    expect(describe("V", "IMPV|VF:1|2MS|MOOD:JUS")).toBe("command verb, form I · you (m) · jussive");
  });
  it("reads nouns, participles and particles", () => {
    expect(describe("N", "ROOT:رحم|MS|GEN|ADJ|DET")).toBe("masculine singular adjective · genitive · with the article");
    expect(describe("N", "ACT_PCPL|VF:1|M|GEN")).toBe("masculine active participle, form I · genitive");
    expect(describe("P", "P")).toBe("preposition");
  });
  it("spells forms and roots", () => {
    expect(verbForm(4)).toBe("IV");
    expect(verbForm(null)).toBeNull();
    expect(rootLetters("رحم")).toBe("ر ح م");
  });
});
