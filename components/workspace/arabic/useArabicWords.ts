"use client";

/**
 * What the reader knows, for colouring the Mushaf in an Arabic study
 * workspace — and nothing at all anywhere else (pass enabled = false).
 *
 * A word counts as one of yours when a card in your lessons matches it in the
 * Qurʾān with the same meaning (lib/arabic/quran-match); every form of that
 * dictionary word then takes the card's colour, so learning قَلْب colours
 * قُلُوبِهِمْ. Words added from the Qurʾān are stored as their dictionary
 * form and found by it directly.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { QCFVerse } from "@/lib/types";
import { statusOf } from "@/lib/arabic/srs";
import { cardHeadword, lookup } from "@/lib/arabic/quran-match";
import { loadQuranIndex, loadMorph, type MorphWord } from "@/lib/arabic/quran-index-client";

export interface WordCard {
  id: string; english: string; arabic: string; box: number;
  lesson: { id: string; level: number; number: number | null; kind: string; title: string };
}
export type Known = { box: number; cards: WordCard[] };
export type WordStatus = "learning" | "almost" | "learnt";

export function useArabicWords(workspaceId: string, enabled: boolean) {
  const [byLemma, setByLemma] = useState<Map<string, Known>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void (async () => {
      const [res, index] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/arabic/words`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        loadQuranIndex(),
      ]);
      if (!live || !index || !res?.cards) return;
      const m = new Map<string, Known>();
      for (const c of res.cards as WordCard[]) {
        const hit = lookup(index, cardHeadword(c.arabic, false), c.english);
        for (const key of new Set([hit?.lemma, c.lesson.kind === "mine" ? c.arabic : undefined])) {
          if (!key) continue;
          const e = m.get(key) ?? { box: 0, cards: [] };
          e.box = Math.max(e.box, c.box);
          e.cards.push(c);
          m.set(key, e);
        }
      }
      setByLemma(m);
    })();
    return () => { live = false; };
  }, [workspaceId, enabled]);

  /** Save a Qurʾān word to My words, and colour it at once (it goes in as learning). */
  const addWord = useCallback(async (lemma: string, english: string) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/arabic/words`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arabic: lemma, english }),
    });
    const data = await res.json().catch(() => ({})) as { cardId?: string };
    if (!res.ok || !data.cardId) return false;
    setByLemma((m) => {
      const next = new Map(m);
      const e = next.get(lemma) ?? { box: 0, cards: [] };
      const cards = e.cards.some((c) => c.id === data.cardId) ? e.cards : [...e.cards, {
        id: data.cardId!, english, arabic: lemma, box: 1,
        lesson: { id: "", level: 0, number: null, kind: "mine", title: "My words" },
      }];
      next.set(lemma, { box: Math.max(e.box, 1), cards });
      return next;
    });
    return true;
  }, [workspaceId]);

  return { byLemma, addWord };
}

/** The open sūrah's per-word grammar, loaded once per sūrah. */
export function useMorph(surah: number, enabled: boolean) {
  const [loaded, setLoaded] = useState<{ surah: number; a: Record<string, MorphWord[]> | null } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void loadMorph(surah).then((a) => { if (live) setLoaded({ surah, a }); });
    return () => { live = false; };
  }, [surah, enabled]);
  return loaded?.surah === surah ? loaded.a : null;
}

/** Each word on the page you know, keyed "verseKey:position", and your cards among them. */
export function usePageWords(
  verses: QCFVerse[], morph: Record<string, MorphWord[]> | null, byLemma: Map<string, Known>,
) {
  return useMemo(() => {
    const status = new Map<string, WordStatus>();
    const cardIds = new Set<string>();
    if (!morph) return { status, cardIds: [] as string[] };
    for (const v of verses) {
      const ayah = v.verse_key.split(":")[1];
      for (const w of v.words) {
        if (w.char_type_name !== "word") continue;
        const lemma = morph[ayah]?.[w.position - 1]?.[1];
        const known = lemma ? byLemma.get(lemma) : undefined;
        if (!known) continue;
        const s = statusOf(known.box);
        if (s !== "unknown") status.set(`${v.verse_key}:${w.position}`, s);
        for (const c of known.cards) if (c.box > 0) cardIds.add(c.id);
      }
    }
    return { status, cardIds: [...cardIds] };
  }, [verses, morph, byLemma]);
}
