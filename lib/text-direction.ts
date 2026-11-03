/**
 * Which way a line of text reads, from its letters: right to left when it is
 * mostly Arabic, left to right when it is mostly Latin, and null (left to the
 * browser's own "auto") when it is genuinely both or has no letters at all.
 *
 * "Mostly" is 60%. The browser's auto picks a block's direction from its
 * first strong character, so an English line opening with an Arabic word, or
 * an Arabic one opening with a number or a transliteration, came out the
 * wrong way round; counting every letter does not.
 *
 * Letters, not code points: the vowel and Qur'anic marks are left out. A
 * fully vowelled phrase is nearly two code points a letter, so a gloss like
 * "كَأَنَّهُم بُنْيَانٌ مَّرْصُوصٌ: like a structure joined firmly" counted as
 * half Arabic, fell to the browser, and was laid out right to left.
 */

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const LATIN = /[A-Za-zÀ-ɏḀ-ỿ]/g;
// Harakat, tanwin, shadda, sukun, dagger alif, Qur'anic annotation marks.
const ARABIC_MARKS = /[ً-ٰٟۖ-ۭ࣓-ࣿ]/g;

export function directionOf(text: string): "rtl" | "ltr" | null {
  const a = text.replace(ARABIC_MARKS, "").match(ARABIC)?.length ?? 0;
  const l = text.match(LATIN)?.length ?? 0;
  if (a + l === 0) return null;
  const share = a / (a + l);
  return share >= 0.6 ? "rtl" : share <= 0.4 ? "ltr" : null;
}
