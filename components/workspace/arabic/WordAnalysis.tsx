"use client";

/**
 * The linguistic analysis of an opened word, in an Arabic study workspace.
 *
 * Tapping a word on the Mushaf opens its note space exactly as in Qurʾān
 * study; in an Arabic study workspace this card sits in the corner of that
 * space as well. It says what the word is — meaning, grammar, dictionary
 * form, root, how often — which of your cards it is (or lets you add it),
 * and opens onto its forms and its root's family.
 */

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { statusOf } from "@/lib/arabic/srs";
import { describe, rootLetters } from "@/lib/arabic/morph";
import { loadRoots, type LemmaRow, type MorphWord, type RootIndex } from "@/lib/arabic/quran-index-client";
import RootFamily, { LemmaForms, lemmaKind } from "./RootFamily";
import { lessonLabel } from "./lesson-label";
import type { Known } from "./useArabicWords";

export default function WordAnalysis({
  verseKey, word, mine, onAdd,
}: {
  verseKey: string;
  word: MorphWord | null;
  mine: Known | null;
  onAdd: (lemma: string, english: string) => Promise<boolean>;
}) {
  const [roots, setRoots] = useState<RootIndex | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<"idle" | "busy" | "failed">("idle");

  useEffect(() => {
    let live = true;
    void loadRoots().then((r) => { if (live) setRoots(r); });
    return () => { live = false; };
  }, []);

  if (!word) return null;
  const [rootKey, lemma, pos, tags, meaning] = word;
  const r = rootKey ? roots?.roots[rootKey] : undefined;
  const lemmas = (r?.slice(1) ?? []) as LemmaRow[];
  const lemmaRow = lemmas.find((l) => l[0] === lemma);

  const add = async () => {
    setAdding("busy");
    const english = (lemmaRow?.[4] || meaning).replace(/^\([^)]*\)\s*/, "").trim();
    setAdding((await onAdd(lemma, english)) ? "idle" : "failed");
  };

  return (
    <aside className="wrs" aria-label="This word" onPointerDown={(e) => e.stopPropagation()}>
      <div className="wrs-top">
        {lemma && <span className="wrs-lemma" dir="rtl" lang="ar">{lemma}</span>}
        <span className="wrs-meaning">{meaning}</span>
      </div>
      <p className="wrs-gram">{describe(pos, tags)} · {verseKey}</p>

      {rootKey && (
        <p className="wrs-facts">
          Root <span className="wrs-root-ar" dir="rtl" lang="ar">{rootLetters(rootKey)}</span>
          {lemmaRow && <span> · {lemmaKind(lemmaRow)} · {lemmaRow[1].toLocaleString()}× in the Qurʾān</span>}
        </p>
      )}

      {mine?.cards.length ? (
        <ul className="wa-mine">
          {mine.cards.slice(0, 3).map((c) => (
            <li key={c.id} data-status={statusOf(c.box)}>
              <span className="wa-dot" aria-hidden />
              <span className="wa-en">{c.english}</span>
              <span className="wa-where">{c.lesson.kind === "mine" ? "My words" : lessonLabel(c.lesson)}</span>
            </li>
          ))}
        </ul>
      ) : lemma ? (
        <div className="wa-add">
          <span className="wa-none">Not in your lessons</span>
          <button type="button" className="nw-btn nw-btn--primary wa-add-btn" onClick={add} disabled={adding === "busy"}>
            {adding === "busy" ? "Adding…" : "Add to my words"}
          </button>
          {adding === "failed" && <span className="ar-error">That didn’t save.</span>}
        </div>
      ) : null}

      {rootKey && r && (
        <button type="button" className="wrs-root" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span>Forms and root family</span>
          <ChevronDown size={14} aria-hidden className="wrs-chev" />
        </button>
      )}
      {open && r && rootKey && (
        <div className="wrs-family">
          {lemmaRow && lemmaRow.length > 5 && (
            <>
              <p className="rf-sub">As it appears in the Qurʾān</p>
              <LemmaForms row={lemmaRow} />
            </>
          )}
          <RootFamily root={rootKey} total={r[0]} lemmas={lemmas} current={lemma} limit={5} />
        </div>
      )}
      <p className="wl-credit">Quranic Arabic Corpus · quran.com</p>
    </aside>
  );
}
