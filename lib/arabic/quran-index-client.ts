"use client";

/**
 * The Qurʾān word index, fetched once per page load and only when a drill
 * or a result needs it (about 180 KB over the wire).
 */

import type { QuranIndex } from "./quran-match";

let pending: Promise<QuranIndex | null> | null = null;

export function loadQuranIndex(): Promise<QuranIndex | null> {
  pending ??= fetch("/data/quran-word-index.json")
    .then((r) => (r.ok ? (r.json() as Promise<QuranIndex>) : null))
    .catch(() => null);
  return pending;
}

export interface AyahWord { position: number; text: string; isWord: boolean }
export interface Ayah { verseKey: string; words: AyahWord[]; translation: string | null }

const ayahCache = new Map<string, Promise<Ayah | null>>();

/** One āyah's words, in the King Fahd encoding, with its translation. */
export function loadAyah(verseKey: string): Promise<Ayah | null> {
  let p = ayahCache.get(verseKey);
  if (!p) {
    p = fetch(`/api/ayah/${verseKey.replace(":", "_")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { verse?: {
        words?: { position: number; char_type_name: string; text_qpc_hafs?: string; text_uthmani?: string }[];
        translations?: { text: string }[];
      } } | null) => {
        if (!d?.verse?.words) return null;
        return {
          verseKey,
          words: d.verse.words.map((w) => ({
            position: w.position,
            text: w.text_qpc_hafs || w.text_uthmani || "",
            isWord: w.char_type_name === "word",
          })),
          translation: d.verse.translations?.[0]?.text?.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "").trim() ?? null,
        };
      })
      .catch(() => null);
    ayahCache.set(verseKey, p);
  }
  return p;
}

// ── Speech ───────────────────────────────────────────────────────────────

/** An Arabic voice, if this browser has one. Voices load late on some browsers. */
export function arabicVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => /^ar(-|_|$)/i.test(v.lang) && /natural|online/i.test(v.name))
      ?? voices.find((v) => /^ar(-|_|$)/i.test(v.lang))
      ?? null;
}

export function speak(text: string) {
  const voice = arabicVoice();
  if (!voice) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
  return true;
}

// ── Roots and per-word grammar (scripts/build-quran-data.mts) ─────────────

/** [lemma, count, pos, verbForm, meaning, ...[form, count, meaning, "s:a:w"]] */
export type LemmaRow = [string, number, string, string, string, ...[string, number, string, string][]];
export interface RootIndex { roots: Record<string, [number, ...LemmaRow[]]> }

let rootsPending: Promise<RootIndex | null> | null = null;
export function loadRoots(): Promise<RootIndex | null> {
  rootsPending ??= fetch("/data/quran-roots.json")
    .then((r) => (r.ok ? (r.json() as Promise<RootIndex>) : null))
    .catch(() => null);
  return rootsPending;
}

/** One word's [root, lemma, pos, tags, meaning], by āyah, for one sūrah. */
export type MorphWord = [string, string, string, string, string];
const morphCache = new Map<number, Promise<Record<string, MorphWord[]> | null>>();
export function loadMorph(surah: number): Promise<Record<string, MorphWord[]> | null> {
  let p = morphCache.get(surah);
  if (!p) {
    p = fetch(`/data/morph/${surah}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { a?: Record<string, MorphWord[]> } | null) => d?.a ?? null)
      .catch(() => null);
    morphCache.set(surah, p);
  }
  return p;
}
