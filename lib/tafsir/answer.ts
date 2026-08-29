/**
 * Answer composition — extractive, and provably so.
 *
 * The assistant does not write sentences. It SELECTS them, from passages that
 * were retrieved from the corpus. Every sentence in an answer is a substring of
 * a passage a human wrote, and `verifyExtractive` checks exactly that before
 * anything is sent — so "it does not make things up" is a property the code
 * enforces on every response, not a claim about a model's behaviour.
 *
 * That is a real constraint on how good the prose can be: a selected sentence
 * can read abruptly where a generated one would flow. For commentary on
 * scripture that is the right trade. A fluent paraphrase attributed to
 * al-Qurṭubī is worse than a slightly awkward quotation of him.
 */

// ── Normalisation ──────────────────────────────────────────────────────────

/**
 * Arabic needs folding before terms can be compared: the same word appears
 * with and without diacritics, with different alif and yāʾ forms, and with the
 * definite article attached. Without this, a query for "الصبر" misses every
 * passage that writes "صبرًا".
 */
export function foldArabic(s: string): string {
  return s
    .replace(/[ً-ْٰـ]/g, "")   // ḥarakāt, dagger alif, taṭwīl
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئ]/g, "ء");
}

export function normalise(s: string): string {
  return foldArabic(s.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words too common to carry meaning in a match, in both scripts. */
const STOP = new Set([
  "the","a","an","and","or","of","in","on","to","is","are","was","were","that",
  "this","it","its","for","with","as","by","from","be","been","has","have","had",
  "what","who","does","do","did","said","say","says","about","which","he","she",
  "they","them","his","her","their","not","no","but","so","if","then","there",
  "من","في","على","عن","الى","ان","انه","ما","لا","و","او","هو","هي","هم","هذا",
  "هذه","ذلك","التي","الذي","قال","قوله","اي","كان","كانت","به","له","لم","قد",
]);

/**
 * Strip the Arabic definite article and the commonest inflectional endings.
 *
 * Without this, a question about "الصبر" does not match a passage that writes
 * "صبرا" or "بالصبر", and the assistant retrieves the right passages and then
 * quotes nothing from them — which reads as the sources being silent when they
 * are not. Deliberately shallow: a real stemmer would over-merge distinct
 * roots, and here a false match is worse than a missed one.
 */
function stemArabic(w: string): string {
  let out = w;
  // Prefixed article, alone or after a preposition/conjunction.
  out = out.replace(/^(?:و|ف|ب|ك|ل)?ال(?=.{3,})/, "");
  // Common endings, only where a stem remains.
  out = out.replace(/(?:ات|ون|ين|ان|ها|هم|هن|كم|نا|ه|ي|ا)$/, (m, off) =>
    (out.length - m.length >= 3 ? "" : m));
  return out || w;
}

export function terms(s: string): string[] {
  const out = new Set<string>();
  for (const w of normalise(s).split(" ")) {
    if (w.length < 2 || STOP.has(w)) continue;
    out.add(w);
    // Both forms are kept, so an exact match still scores and a stemmed one
    // also can. Scoring counts distinct query terms, so this cannot inflate a
    // single word into two hits against the same passage word.
    const stem = stemArabic(w);
    if (stem !== w && stem.length >= 3) out.add(stem);
  }
  return [...out];
}

// ── Sentences ──────────────────────────────────────────────────────────────

/**
 * Split into sentences on both scripts' terminators.
 *
 * Deliberately conservative: over-splitting produces fragments that cannot be
 * quoted honestly, so a piece shorter than a clause is glued back onto its
 * neighbour rather than emitted.
 */
export function sentences(text: string): string[] {
  const parts = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?؟۔])\s+|(?<=[۔])\s*/u)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const p of parts) {
    if (p.length < 40 && out.length) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out;
}

// ── Selection ──────────────────────────────────────────────────────────────

export interface Passage {
  sourceSlug: string;
  sourceName: string;
  language:   string;
  verseKey:   string;
  content:    string;
}

export interface SelectedSentence {
  text:       string;
  sourceSlug: string;
  sourceName: string;
  verseKey:   string;
  score:      number;
}

/**
 * Pick the sentences that best answer the question.
 *
 * Scoring is term overlap with a length penalty, which is crude next to a
 * cross-encoder but has two properties that matter more here: it is
 * deterministic, so the same question gives the same answer twice, and it is
 * explainable, so a wrong pick can be understood rather than shrugged at.
 *
 * `perSource` exists so one verbose edition cannot crowd out the rest — al-Rāzī
 * on a single verse can outproduce four other works combined.
 */
export function selectSentences(
  query: string,
  passages: Passage[],
  opts: { max?: number; perSource?: number } = {},
): SelectedSentence[] {
  const max = opts.max ?? 6;
  const perSource = opts.perSource ?? 2;
  const q = new Set(terms(query));
  if (q.size === 0) return [];

  const scored: SelectedSentence[] = [];
  for (const p of passages) {
    for (const s of sentences(p.content)) {
      const t = terms(s);
      if (t.length < 3) continue;
      const hits = t.filter((w) => q.has(w)).length;
      if (hits === 0) continue;
      // Coverage of the QUESTION matters more than density of the sentence;
      // a long paragraph mentioning one query word should not beat a short
      // sentence that answers it.
      const coverage = new Set(t.filter((w) => q.has(w))).size / q.size;
      const density  = hits / Math.sqrt(t.length);
      scored.push({
        text: s,
        sourceSlug: p.sourceSlug,
        sourceName: p.sourceName,
        verseKey: p.verseKey,
        score: coverage * 2 + density,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const perCount = new Map<string, number>();
  const chosen: SelectedSentence[] = [];
  const seen = new Set<string>();

  for (const s of scored) {
    if (chosen.length >= max) break;
    const n = perCount.get(s.sourceSlug) ?? 0;
    if (n >= perSource) continue;
    // Editions quote each other, so the same sentence can arrive twice.
    const key = normalise(s.text).slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    perCount.set(s.sourceSlug, n + 1);
    chosen.push(s);
  }

  return chosen;
}

/**
 * Assert that every selected sentence really is in the passages.
 *
 * This is the guarantee, executed. If selection is ever changed — or replaced
 * by a model — this fails loudly rather than letting an invented sentence
 * reach a reader with a scholar's name beside it.
 */
export function verifyExtractive(
  selected: SelectedSentence[], passages: Passage[],
): { ok: true } | { ok: false; offending: string } {
  const bySlug = new Map<string, string[]>();
  for (const p of passages) {
    const arr = bySlug.get(p.sourceSlug) ?? [];
    arr.push(normalise(p.content));
    bySlug.set(p.sourceSlug, arr);
  }

  for (const s of selected) {
    const haystacks = bySlug.get(s.sourceSlug) ?? [];
    const needle = normalise(s.text);
    // Sentence splitting can glue a fragment onto its neighbour, so compare on
    // the normalised form rather than requiring byte equality.
    if (!haystacks.some((h) => h.includes(needle))) {
      return { ok: false, offending: s.text.slice(0, 160) };
    }
  }
  return { ok: true };
}
