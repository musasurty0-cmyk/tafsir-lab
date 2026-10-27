"use client";

/**
 * The root of the word you have opened, inside its note space.
 *
 * Tapping a word on the Mushaf opens a place to write about it; this sits in
 * the corner of that space and says what the word is — its dictionary form,
 * meaning, grammar and root, and how often each occurs — with the root's
 * family a tap away. It appears only once you have opened a word, so the
 * Mushaf itself stays as clean as it was.
 */

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { describe, rootLetters } from "@/lib/arabic/morph";
import { loadMorph, loadRoots, type LemmaRow, type MorphWord } from "@/lib/arabic/quran-index-client";
import RootFamily, { LemmaForms } from "./arabic/RootFamily";

export default function WordRootStrip({ verseKey, wordPos }: { verseKey: string; wordPos: number }) {
  const [word, setWord] = useState<MorphWord | null | undefined>(undefined);
  const [root, setRoot] = useState<{ total: number; lemmas: LemmaRow[] } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    const [s, a] = verseKey.split(":");
    void (async () => {
      const [m, roots] = await Promise.all([loadMorph(Number(s)), loadRoots()]);
      if (!live) return;
      const w = m?.[a]?.[wordPos - 1] ?? null;
      setWord(w);
      const r = w?.[0] ? roots?.roots[w[0]] : undefined;
      setRoot(r ? { total: r[0], lemmas: r.slice(1) as LemmaRow[] } : null);
    })();
    return () => { live = false; };
  }, [verseKey, wordPos]);

  if (!word) return null;
  const [rootKey, lemma, pos, tags, meaning] = word;
  const lemmaRow = root?.lemmas.find((l) => l[0] === lemma);

  return (
    <aside className="wrs" aria-label="This word" onPointerDown={(e) => e.stopPropagation()}>
      <div className="wrs-top">
        {lemma && <span className="wrs-lemma" dir="rtl" lang="ar">{lemma}</span>}
        <span className="wrs-meaning">{meaning}</span>
      </div>
      <p className="wrs-gram">{describe(pos, tags)}</p>
      {rootKey && (
        <button type="button" className="wrs-root" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span>Root <span className="wrs-root-ar" dir="rtl" lang="ar">{rootLetters(rootKey)}</span></span>
          <span className="wrs-counts">
            {root ? `${root.total.toLocaleString()}×` : ""}
            {lemmaRow ? ` · this word ${lemmaRow[1].toLocaleString()}×` : ""}
          </span>
          <ChevronDown size={14} aria-hidden className="wrs-chev" />
        </button>
      )}
      {open && root && rootKey && (
        <div className="wrs-family">
          {lemmaRow && lemmaRow.length > 5 && (
            <>
              <p className="rf-sub">As it appears in the Qurʾān</p>
              <LemmaForms row={lemmaRow} />
            </>
          )}
          <RootFamily root={rootKey} total={root.total} lemmas={root.lemmas} current={lemma} limit={5} />
          <p className="wl-credit">From the Quranic Arabic Corpus.</p>
        </div>
      )}
    </aside>
  );
}
