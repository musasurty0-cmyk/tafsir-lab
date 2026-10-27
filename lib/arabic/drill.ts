/**
 * Building a multiple-choice question from a card.
 *
 * Wrong answers come from the same lesson first, then the same level, and
 * are the same kind of thing as the right one — a word for a word, a
 * sentence for a sentence, never two with the same meaning — so the answer
 * cannot be found by elimination ("from, Allah, not, Lord" for مِن).
 */

import { foldArabic } from "./parse";

export type Drill = "meaning" | "recall" | "listen" | "context" | "cloze";

export interface DrillCard {
  id: string; lessonId: string; english: string; arabic: string; isSentence: boolean;
}

export interface Option { id: string; text: string; correct: boolean }

const norm = (s: string) => s.toLowerCase().replace(/\s*\((m|f)\)\s*$/i, "").replace(/[^a-z0-9؀-ۿ ]/gi, "").trim();

/** Arabic or English side, depending on what the question asks for. */
export function answerSide(drill: Drill): "english" | "arabic" {
  return drill === "recall" || drill === "cloze" ? "arabic" : "english";
}

/** "هَذِهِ أُذُنٌ" → "أُذُنٌ": the word alone, for filling a one-word gap. */
export function bareWord(arabic: string): string {
  const words = arabic.trim().split(/\s+/);
  const rest = words.filter((w) => !["هذا", "هذه", "ذلك", "تلك"].includes(foldArabic(w)));
  return rest.length ? rest.join(" ") : arabic.trim();
}

export function makeOptions(
  card: DrillCard,
  pool: DrillCard[],
  drill: Drill,
  rand: () => number = Math.random,
  count = 4,
): Option[] {
  const side = answerSide(drill);
  const key = (c: DrillCard) => (side === "english" ? norm(c.english) : foldArabic(c.arabic));
  const right = key(card);
  const taken = new Set([right, side === "english" ? foldArabic(card.arabic) : norm(card.english)]);

  const candidates = pool.filter((c) =>
    c.id !== card.id && c.isSentence === card.isSentence && key(c) && !taken.has(key(c)));
  // Same lesson first, then anything else in the pool, each shuffled.
  const shuffle = <T,>(xs: T[]) => xs.map((x) => [rand(), x] as const).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const ordered = [
    ...shuffle(candidates.filter((c) => c.lessonId === card.lessonId)),
    ...shuffle(candidates.filter((c) => c.lessonId !== card.lessonId)),
  ];

  const picked: DrillCard[] = [];
  const seen = new Set(taken);
  for (const c of ordered) {
    if (picked.length >= count - 1) break;
    const k = key(c);
    if (seen.has(k)) continue;
    seen.add(k);
    picked.push(c);
  }
  const text = (c: DrillCard) =>
    side === "english" ? c.english : drill === "cloze" ? bareWord(c.arabic) : c.arabic;
  const options: Option[] = [
    { id: card.id, text: text(card), correct: true },
    ...picked.map((c) => ({ id: c.id, text: text(c), correct: false })),
  ];
  return shuffle(options);
}
