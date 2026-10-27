"use client";

/**
 * The word lens: everything about one card's word, in a panel beside the
 * lesson. Its meaning, how it sits in the Qurʾān (dictionary form, root,
 * part of speech, how often, the forms it takes), the āyāt it appears in,
 * and the rest of its root's family.
 *
 * Only the Arabic workspace opens this. The Mushaf keeps tap-for-notes; its
 * note space shows the same root information in a smaller strip.
 */

import { useEffect, useState } from "react";
import { X, Volume2 } from "lucide-react";
import { useOverlayMotion } from "@/lib/use-overlay-motion";
import { useDismissable } from "@/lib/use-dismissable";
import { cardHeadword, lookup, type QuranHit } from "@/lib/arabic/quran-match";
import { rootLetters } from "@/lib/arabic/morph";
import {
  loadQuranIndex, loadRoots, loadAyah, arabicVoice, speak,
  type Ayah, type LemmaRow,
} from "@/lib/arabic/quran-index-client";
import RootFamily, { LemmaForms, lemmaKind } from "./RootFamily";

export interface LensCard {
  arabic: string; english: string; translit: string | null; gender: string | null; isSentence: boolean;
}

export default function WordLens({ card, onClose }: { card: LensCard | null; onClose: () => void }) {
  const { mounted, state } = useOverlayMotion(!!card, 220);
  const [shown, setShown] = useState<LensCard | null>(card);
  if (card && card !== shown) setShown(card);
  useDismissable(onClose, !!card);
  if (!mounted || !shown) return null;
  return (
    <>
      <div className="wl-scrim" data-state={state} onClick={onClose} />
      <aside className="wl" data-state={state} aria-label="Word" role="dialog">
        <LensBody key={shown.arabic + shown.english} card={shown} onClose={onClose} />
      </aside>
    </>
  );
}

function LensBody({ card, onClose }: { card: LensCard; onClose: () => void }) {
  const [hit, setHit] = useState<QuranHit | null | undefined>(undefined);
  const [root, setRoot] = useState<{ total: number; lemmas: LemmaRow[] } | null>(null);
  const [ayahs, setAyahs] = useState<(Ayah | null)[]>([]);
  // Only ever rendered after a tap, in the browser, so the voice can be read at once.
  const [voice] = useState(() => typeof window !== "undefined" && !!arabicVoice());

  useEffect(() => {
    let live = true;
    void (async () => {
      const index = await loadQuranIndex();
      const h = index ? lookup(index, cardHeadword(card.arabic, card.isSentence), card.english) : null;
      if (!live) return;
      setHit(h);
      if (!h) return;
      const [roots, ...as] = await Promise.all([
        loadRoots(),
        ...h.places.slice(0, 3).map((p) => loadAyah(p.verseKey)),
      ]);
      if (!live) return;
      const r = h.root ? roots?.roots[h.root] : undefined;
      if (r) setRoot({ total: r[0], lemmas: r.slice(1) as LemmaRow[] });
      setAyahs(as);
    })();
    return () => { live = false; };
  }, [card]);

  const lemma = hit && root ? root.lemmas.find((l) => l[0] === hit.lemma) : undefined;

  return (
    <div className="wl-body">
      <header className="wl-head">
        <button type="button" className="wl-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <p className="wl-ar" dir="rtl" lang="ar">{card.arabic}</p>
        <p className="wl-en">{card.english}{card.gender && <span className="ar-g">{card.gender}</span>}</p>
        <p className="wl-tr">
          {card.translit}
          {voice && (
            <button type="button" className="wl-speak" onClick={() => speak(card.arabic)} aria-label="Hear it">
              <Volume2 size={15} />
            </button>
          )}
        </p>
      </header>

      {hit === undefined && <p className="wl-wait">Looking it up…</p>}

      {hit === null && (
        <p className="wl-none">
          {card.isSentence
            ? "Sentences aren’t looked up word by word yet."
            : "This word doesn’t appear in the Qurʾān with this meaning."}
        </p>
      )}

      {hit && (
        <>
          <dl className="wl-facts">
            {/* The word in all its forms, not just this spelling: قَلْب occurs
                far more often as قُلُوبِهِمْ than as قَلْبٌ. */}
            <div>
              <dt>In the Qurʾān</dt>
              <dd>
                {(lemma?.[1] ?? hit.count).toLocaleString()} time{(lemma?.[1] ?? hit.count) === 1 ? "" : "s"}
                {lemma && lemma[1] !== hit.count && (
                  <span className="wl-fact-sub"> · this spelling {hit.count.toLocaleString()}</span>
                )}
              </dd>
            </div>
            {hit.lemma && <div><dt>Dictionary form</dt><dd className="wl-fact-ar" dir="rtl" lang="ar">{hit.lemma}</dd></div>}
            {hit.root && <div><dt>Root</dt><dd className="wl-fact-ar" dir="rtl" lang="ar">{rootLetters(hit.root)}</dd></div>}
            {lemma && <div><dt>Kind</dt><dd>{lemmaKind(lemma)}</dd></div>}
          </dl>

          {lemma && (lemma.length > 5) && (
            <section className="wl-sec">
              <h3 className="wl-h">As it appears in the Qurʾān</h3>
              <LemmaForms row={lemma} />
            </section>
          )}

          {ayahs.some(Boolean) && (
            <section className="wl-sec">
              <h3 className="wl-h">In the āyāt</h3>
              {ayahs.map((a, i) => a && (
                <figure key={a.verseKey} className="wl-ayah">
                  <p className="wl-ayah-ar" dir="rtl" lang="ar">
                    {a.words.filter((w) => w.isWord).map((w) => (
                      <span key={w.position} className={w.position === hit.places[i].word ? "ap-hl" : undefined}>{w.text} </span>
                    ))}
                  </p>
                  {a.translation && <figcaption className="wl-ayah-tr">“{a.translation}” <span className="wl-ref">{a.verseKey}</span></figcaption>}
                </figure>
              ))}
            </section>
          )}

          {root && hit.root && (
            <section className="wl-sec">
              <h3 className="wl-h">Its root</h3>
              <RootFamily root={hit.root} total={root.total} lemmas={root.lemmas} current={hit.lemma} />
            </section>
          )}
        </>
      )}

      <p className="wl-credit">Roots and grammar from the Quranic Arabic Corpus. Meanings in the āyāt from quran.com.</p>
    </div>
  );
}
