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

/* ── The board ───────────────────────────────────────────────────────────
   A second destination, and a different question: not "file this" but "draw
   this". The two overlap in English — "add that to my notes" and "add that
   to the board" differ by one word — so the board is tested FIRST and the
   notes offer stands down when it matches, rather than two cards appearing
   under one answer and making the reader choose twice. */

/** The surface you draw on. */
const BOARD = String.raw`(?:white-?board|board|canvas|mind[\s-]?map)`;

const BOARD_PATTERNS: RegExp[] = [
  /* "add this to the whiteboard as a mindmap", "put that on the board" —
     the verb, then the board, in that order. */
  new RegExp(String.raw`\b${VERB}\b[\s\S]{0,80}?\b(?:to|in|into|on|onto)\b\s+(?:my|the|our)?\s*${BOARD}\b`, "i"),

  /* Board first: "on my whiteboard, map this out". */
  new RegExp(String.raw`\b(?:my|the)\s+${BOARD}\b[\s\S]{0,40}?\b${VERB}\b`, "i"),

  /* The map is named as the thing wanted, wherever it is going: "make a
     mindmap of this", "turn that into a mind map", "map this out". */
  new RegExp(String.raw`\b(?:make|draw|build|create|generate|turn|render)\b[\s\S]{0,30}?\bmind[\s-]?map\b`, "i"),
  new RegExp(String.raw`\bmind[\s-]?map\b[\s\S]{0,24}?\b(?:this|that|it|of|for)\b`, "i"),
  new RegExp(String.raw`\bmap\s+(?:this|that|it)\s+out\b`, "i"),
];

/**
 * Did the reader ask for this to be drawn on the board?
 *
 * Same contract as `asksForNotes`: mechanical, cheap, testable, and slightly
 * generous, because the result is a card they can dismiss.
 */
export function asksForBoard(question: string): boolean {
  const q = question.trim();
  if (!q) return false;
  if (q.length > 400) return false;
  return BOARD_PATTERNS.some((re) => re.test(q));
}

/* ── Reading the board ───────────────────────────────────────────────────
   The opposite direction of travel: not "put something there" but "look at
   what is already there". Kept explicit rather than inferred from being on
   the board, because reading handwriting costs a call to a vision model and
   sends a picture of the reader's private notes — both are things to do when
   asked, not by default. */

/** What the writing lives on, or is. */
const WRITTEN = String.raw`(?:board|white-?board|canvas|hand-?writing|writing|scribbles?|notes on (?:the|my) board)`;

const READ_PATTERNS: RegExp[] = [
  /* "read my board", "can you read my handwriting", "look at my board" */
  new RegExp(String.raw`\b(?:read|look at|check|see|scan|view)\b[\s\S]{0,24}?\b(?:my|the|this)\s+${WRITTEN}\b`, "i"),

  /* "what did I write", "what have I written", "what does this say" */
  new RegExp(String.raw`\bwhat\b[\s\S]{0,30}?\b(?:did|have)\s+i\s+(?:write|written|scribble|note|jot)`, "i"),
  new RegExp(String.raw`\bwhat\s+does\s+(?:this|that|it|my\s+\w+)\s+say\b`, "i"),

  /* "what's on my board", "whats on my board", "what is on the whiteboard".
     The apostrophe is optional because people typing quickly omit it, and a
     curly one is as common as a straight one on a tablet keyboard. */
  new RegExp(String.raw`\bwhat(?:['’]?s|\s+is|\s+are)?[\s\S]{0,20}?\bon\s+(?:my|the)\s+${WRITTEN}\b`, "i"),

  /* "summarise my board", "explain my handwriting", "tidy up my board" */
  new RegExp(String.raw`\b(?:summar(?:ise|ize)|explain|tidy|clean up|organi[sz]e|go through)\b[\s\S]{0,24}?\b(?:my|the|this)\s+${WRITTEN}\b`, "i"),

  /* "transcribe my board" — the literal ask. */
  new RegExp(String.raw`\btranscribe\b`, "i"),
];

/**
 * Did the reader ask Lab AI to LOOK at their board?
 *
 * Deliberately narrow where the others are generous. A false positive here
 * does not cost a dismissible card — it uploads a picture of someone's notes
 * and spends a vision call, so it has to be something they actually asked
 * for. "Explain the straight path" while a board is open is a question about
 * the Qur'an, not about their handwriting.
 */
export function asksToReadBoard(question: string): boolean {
  const q = question.trim();
  if (!q) return false;
  if (q.length > 300) return false;
  /* "add a mindmap to my board" is putting, not reading — and it matches
     some of the phrasings above, so the writing intent wins outright. */
  if (asksForBoard(q)) return false;
  return READ_PATTERNS.some((re) => re.test(q));
}
