"use client";

/**
 * The ʿIlmī page's two things to do before the first session.
 *
 *   TermDeck    — the key terms as flashcards: the Arabic on the face, the
 *                 meaning on the back. Tap to turn.
 *   ReadingList — the pre-reading as a checklist, with a running count.
 *
 * The checklist is synced to the student's TafsirLab account.
 */

import { useState } from "react";
import { useLocal } from "./useLocal";
import { Ring } from "./QuestionExplorer";
import SyncNote from "./SyncNote";

type Term = { ar: string; tr: string; en: string };

export function TermDeck({ terms }: { terms: Term[] }) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const order = terms.map((t) => t.tr);
  const byTr = new Map(terms.map((t) => [t.tr, t]));

  function flip(tr: string) {
    setFlipped((s) => { const n = new Set(s); if (n.has(tr)) n.delete(tr); else n.add(tr); return n; });
  }

  return (
    <>
      <div className="y-deck-ctl" data-reveal>
        <span>{flipped.size} of {terms.length} turned</span>
        <button className="y-more" onClick={() => setFlipped(new Set(terms.map((t) => t.tr)))}>Turn all</button>
      </div>
      <div className="y-terms">
        {order.map((tr, i) => {
          const t = byTr.get(tr)!;
          const on = flipped.has(tr);
          return (
            <button
              key={tr}
              className="y-card"
              data-flipped={on ? "" : undefined}
              onClick={() => flip(tr)}
              aria-pressed={on}
              aria-label={on ? `${t.tr}: ${t.en}` : `${t.tr}. Tap to see its meaning`}
              data-reveal data-reveal-i={i % 3}
            >
              <span className="y-card-in">
                <span className="y-card-face">
                  <span className="y-card-ar" lang="ar" dir="rtl">{t.ar}</span>
                  <span className="y-card-tr">{t.tr}</span>
                  <span className="y-card-hint">Tap to turn</span>
                </span>
                <span className="y-card-face y-card-back">
                  <span className="y-card-tr">{t.tr}</span>
                  <span className="y-card-en">{t.en}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

type Read = { title: string; author: string; why: string; level: string };

export function ReadingList({ reading, tiers }: { reading: Read[]; tiers: readonly string[] }) {
  const [done, setDone] = useLocal<string[]>("read", []);
  const toggle = (t: string) => setDone(done.includes(t) ? done.filter((x) => x !== t) : [...done, t]);
  const count = reading.filter((r) => done.includes(r.title)).length;

  return (
    <>
      <div className="y-read-progress" data-reveal>
        <Ring value={count} max={reading.length} label={`${count} of ${reading.length} read`} />
        <span><strong>{count} of {reading.length}</strong> read{count === reading.length ? ". Ready for the first session." : "."}</span>
      </div>
      <SyncNote />
      {tiers.map((tier) => (
        <div key={tier} className="y-tier">
          <h3 className="y-tier-h" data-reveal>{tier}</h3>
          <ul className="y-reads">
            {reading.filter((r) => r.level === tier).map((r, i) => {
              const on = done.includes(r.title);
              return (
                <li key={r.title} data-reveal data-reveal-i={i} data-done={on ? "" : undefined}>
                  <button className="y-check" onClick={() => toggle(r.title)} aria-pressed={on} aria-label={on ? `Mark ${r.title} as not read` : `Mark ${r.title} as read`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  </button>
                  <span className="y-read-title">{r.title}</span>
                  <span className="y-read-author">{r.author}</span>
                  <span className="y-read-why">{r.why}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}
