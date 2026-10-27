/**
 * The Quranic Arabic Corpus's grammar tags, said in plain English.
 *
 * A word's tags come from its stem segment ("IMPF|VF:10|1P|MOOD:IND") plus
 * whatever prefixes it carries. This turns them into what a student wants to
 * read: "present-tense verb, form X, we".
 *
 * Morphology: Quranic Arabic Corpus v0.4 (corpus.quran.com), GNU GPL, via
 * github.com/mustafa0x/quran-morphology. Used unaltered; credited wherever
 * it is shown.
 */

const POS: Record<string, string> = {
  N: "noun", PN: "proper noun", ADJ: "adjective", V: "verb",
  PRON: "pronoun", DEM: "demonstrative", REL: "relative pronoun",
  P: "preposition", CONJ: "conjunction", NEG: "negative particle",
  INTG: "question word", T: "time adverb", LOC: "place adverb",
  COND: "conditional particle", EMPH: "emphatic particle", ACC: "particle",
  VOC: "vocative particle", RES: "restriction particle", SUB: "subordinating particle",
  INL: "initial letters", ANS: "answer particle", CERT: "particle of certainty",
  EXP: "exceptive particle", FUT: "future particle", INC: "inceptive particle",
  REM: "resumption particle", RSLT: "result particle", AMD: "amendment particle",
  CIRC: "circumstantial particle", PRO: "prohibition particle", SUP: "supplemental particle",
};

const ASPECT: Record<string, string> = { PERF: "past-tense", IMPF: "present-tense", IMPV: "command" };
const DERIVED: Record<string, string> = {
  ACT_PCPL: "active participle", PASS_PCPL: "passive participle", VN: "verbal noun",
};
const PERSON: Record<string, string> = {
  "1S": "I", "1P": "we",
  "2MS": "you (m)", "2FS": "you (f)", "2D": "you two", "2MD": "you two (m)", "2FD": "you two (f)",
  "2MP": "you all (m)", "2FP": "you all (f)",
  "3MS": "he", "3FS": "she", "3D": "they two", "3MD": "they two (m)", "3FD": "they two (f)",
  "3MP": "they (m)", "3FP": "they (f)",
};
const NUMBER: Record<string, string> = {
  MS: "masculine singular", FS: "feminine singular", MD: "masculine dual", FD: "feminine dual",
  MP: "masculine plural", FP: "feminine plural", M: "masculine", F: "feminine", P: "plural", D: "dual",
};
const CASE: Record<string, string> = { NOM: "nominative", ACC: "accusative", GEN: "genitive" };
const MOOD: Record<string, string> = { SUBJ: "subjunctive", JUS: "jussive", IND: "" };

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function verbForm(vf: number | string | null | undefined): string | null {
  const n = Number(vf);
  return n >= 1 && n < ROMAN.length ? ROMAN[n] : null;
}

/**
 * One line for a word: "present-tense verb, form X · we", "masculine
 * singular noun · genitive · with the article".
 */
export function describe(pos: string, tags: string): string {
  const t = tags.split("|").filter(Boolean);
  const has = (x: string) => t.includes(x);
  const val = (k: string) => t.find((x) => x.startsWith(k + ":"))?.slice(k.length + 1);
  const parts: string[] = [];

  if (pos === "V") {
    const aspect = t.map((x) => ASPECT[x]).find(Boolean);
    const form = verbForm(val("VF"));
    parts.push([aspect, has("PASS") ? "passive" : null, "verb"].filter(Boolean).join(" ") + (form ? `, form ${form}` : ""));
    const who = t.map((x) => PERSON[x]).find(Boolean);
    if (who) parts.push(who);
    const mood = MOOD[val("MOOD") ?? ""];
    if (mood) parts.push(mood);
  } else if (pos === "N") {
    const derived = t.map((x) => DERIVED[x]).find(Boolean);
    const kind = has("PN") ? "proper noun" : has("ADJ") ? "adjective" : derived ?? "noun";
    const num = t.map((x) => NUMBER[x]).find(Boolean);
    const form = derived ? verbForm(val("VF")) : null;
    parts.push([num, kind].filter(Boolean).join(" ") + (form ? `, form ${form}` : ""));
    const c = t.map((x) => CASE[x]).find(Boolean);
    if (c) parts.push(c);
  } else {
    const kind = t.map((x) => POS[x]).find(Boolean) ?? POS[pos] ?? "particle";
    parts.push(kind);
  }
  if (has("DET")) parts.push("with the article");
  return parts.join(" · ");
}

/** "رحم" → "ر ح م": a root's letters, spaced so they read as letters. */
export function rootLetters(root: string): string {
  return [...root].join(" ");
}
