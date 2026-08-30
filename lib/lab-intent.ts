/**
 * Did the reader ask for this to go into their notes?
 *
 * "Add to editor" used to sit under every finished answer. That is the wrong
 * default: most questions are asked to be read, not filed, and a button
 * offering to write into someone's document on every turn is clutter at best
 * and an accident waiting to happen at worst. It should appear when it was
 * asked for — "add a mindmap on al-Fātiḥah to my notes", "write that up" —
 * and stay out of the way otherwise.
 *
 * Decided from the question rather than by asking the model: this is a
 * mechanical thing readers phrase in a handful of ways, it costs nothing, it
 * is the same every time, and it can be tested. The classifier in `llm.ts`
 * exists for a judgement a regular expression genuinely cannot make; this is
 * not one of those.
 *
 * Tuned to be slightly generous. The offer is a card the reader can dismiss,
 * so a false positive costs them a glance; a false negative means the feature
 * they just asked for did not appear.
 */

/** Putting something somewhere. */
const VERB = String.raw`(?:add|put|insert|save|write|note|jot|stick|drop|copy|paste|append|record)`;

/** Somewhere being their own document. */
const TARGET = String.raw`(?:not(?:e|es)|editor|page|document|doc|canvas|write-?up|writeup)`;

const PATTERNS: RegExp[] = [
  /* "add a mindmap on al-Fatihah to my notes", "put this in the editor",
     "save that to my page" — the verb and the target, in that order, with
     whatever the reader wants added in between. */
  new RegExp(String.raw`\b${VERB}\b[\s\S]{0,80}?\b(?:to|in|into|on|onto)\b\s+(?:my|the|our)?\s*${TARGET}\b`, "i"),

  /* Target first: "in my notes, add a summary of this". */
  new RegExp(String.raw`\b(?:my|the)\s+${TARGET}\b[\s\S]{0,40}?\b${VERB}\b`, "i"),

  /* No target named, but unmistakable: "write that up", "note this down",
     "jot that down". */
  new RegExp(String.raw`\b(?:write|note|jot|take)\s+(?:this|that|it|these|them)\s+(?:up|down)\b`, "i"),

  /* "make me notes on X", "write me a summary in my notes" — the possessive
     is what separates this from "write a summary" as a request to answer. */
  new RegExp(String.raw`\b(?:make|write|draft|create|build|generate)\b[\s\S]{0,30}?\b(?:me\s+)?(?:some\s+)?${TARGET}\b`, "i"),
];

export function asksForNotes(question: string): boolean {
  const q = question.trim();
  if (!q) return false;
  /* A long paste is a passage to discuss, not an instruction. The phrasings
     this looks for are short by nature. */
  if (q.length > 400) return false;
  return PATTERNS.some((re) => re.test(q));
}
