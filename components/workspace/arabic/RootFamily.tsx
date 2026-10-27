"use client";

/**
 * A root's family in the Qurʾān: every word built on it, how often each
 * occurs, what it means, and — for the word you came from — the forms it
 * takes, with counts (قَالَ ×525, قَالُوا ×236, قُلْ ×235).
 *
 * Shared by the Arabic workspace's word lens and the Qurʾān study note space.
 */

import { useState } from "react";
import { rootLetters, verbForm } from "@/lib/arabic/morph";
import type { LemmaRow } from "@/lib/arabic/quran-index-client";

const POS_WORD: Record<string, string> = { N: "noun", V: "verb", P: "particle" };

export function lemmaKind(row: LemmaRow): string {
  const form = verbForm(row[3]);
  if (row[2] === "V") return form ? `verb, form ${form}` : "verb";
  return POS_WORD[row[2]] ?? "word";
}

/** The forms a dictionary word takes in the Qurʾān. */
export function LemmaForms({ row }: { row: LemmaRow }) {
  const forms = row.slice(5) as [string, number, string, string][];
  if (forms.length === 0) return null;
  return (
    <ul className="rf-forms">
      {forms.map(([form, n, meaning]) => (
        <li key={form}>
          <span className="rf-ar" dir="rtl" lang="ar">{form}</span>
          <span className="rf-n">×{n}</span>
          <span className="rf-m">{meaning}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RootFamily({
  root, total, lemmas, current, limit = 6,
}: {
  root: string; total: number; lemmas: LemmaRow[]; current?: string; limit?: number;
}) {
  const [all, setAll] = useState(false);
  const others = lemmas.filter((l) => l[0] !== current);
  const shown = all ? others : others.slice(0, limit);
  const verbs = lemmas.filter((l) => l[2] === "V" && verbForm(l[3]));

  return (
    <div className="rf">
      <p className="rf-head">
        <span className="rf-root" dir="rtl" lang="ar">{rootLetters(root)}</span>
        <span className="rf-total">{total.toLocaleString()} time{total === 1 ? "" : "s"} in the Qurʾān</span>
      </p>

      {verbs.length > 1 && (
        <div className="rf-verbs" aria-label="Verb forms">
          {verbs.sort((a, b) => Number(a[3]) - Number(b[3])).map((v) => (
            <span key={v[0]} className="rf-verb">
              <span className="rf-verb-f">{verbForm(v[3])}</span>
              <span className="rf-ar" dir="rtl" lang="ar">{v[0]}</span>
              <span className="rf-m">{v[4]}</span>
            </span>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <>
          <p className="rf-sub">Other words from this root</p>
          <ul className="rf-list">
            {shown.map((l) => (
              <li key={l[0]}>
                <span className="rf-ar" dir="rtl" lang="ar">{l[0]}</span>
                <span className="rf-m">{l[4]}<span className="rf-kind"> · {lemmaKind(l)}</span></span>
                <span className="rf-n">×{l[1]}</span>
              </li>
            ))}
          </ul>
          {others.length > limit && (
            <button type="button" className="rf-more" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all ${others.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
