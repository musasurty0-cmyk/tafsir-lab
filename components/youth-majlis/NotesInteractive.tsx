"use client";

/**
 * The two moving parts of a class-notes page:
 *
 *   • PointsIndex — the list of the ten points beside the notes (a strip
 *     across the top on a phone), marking the point you are reading;
 *   • PassageView — the passage with the translation beneath each āyah, or
 *     the Arabic alone, read as one flowing text.
 */

import { useEffect, useRef, useState } from "react";

export function PointsIndex({ points }: { points: { n: number; title: string }[] }) {
  const [current, setCurrent] = useState<number | null>(null);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.point));
    }, { rootMargin: "-30% 0px -60% 0px" });
    document.querySelectorAll<HTMLElement>("[data-point]").forEach((el) => spy.observe(el));
    return () => spy.disconnect();
  }, []);

  // On a phone the index is a strip: keep the current point in view along it.
  useEffect(() => {
    if (current == null || !list.current || list.current.scrollWidth <= list.current.clientWidth) return;
    const a = list.current.querySelector<HTMLElement>(`[data-n="${current}"]`);
    if (a) list.current.scrollTo({ left: a.offsetLeft - 22, behavior: "smooth" });
  }, [current]);

  return (
    <nav className="yn-index" aria-label="The ten points">
      <p className="yn-index-h">The ten points</p>
      <ol ref={list}>
        {points.map((p) => (
          <li key={p.n}>
            <a href={`#point-${p.n}`} data-n={p.n} aria-current={current === p.n ? "true" : undefined}>
              <span className="yn-index-n">{p.n}</span>
              <span className="yn-index-t">{p.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PassageView({
  verses, basmala,
}: {
  verses: { n: number; ar: string; en: string }[];
  basmala: boolean;
}) {
  const [arabicOnly, setArabicOnly] = useState(false);
  return (
    <div className="yn-passage" data-mode={arabicOnly ? "ar" : "both"}>
      <div className="yn-seg" role="radiogroup" aria-label="How to show the passage">
        <button type="button" role="radio" aria-checked={!arabicOnly} onClick={() => setArabicOnly(false)}>With translation</button>
        <button type="button" role="radio" aria-checked={arabicOnly} onClick={() => setArabicOnly(true)}>Arabic only</button>
      </div>
      {basmala && <p className="yn-basmala" lang="ar" dir="rtl">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</p>}
      {arabicOnly ? (
        <p className="yn-flow" lang="ar" dir="rtl">
          {verses.map((v) => <span key={v.n}>{v.ar} </span>)}
        </p>
      ) : (
        <ol className="yn-verses">
          {verses.map((v) => (
            <li key={v.n}>
              <p className="yn-v-ar" lang="ar" dir="rtl">{v.ar}</p>
              <p className="yn-v-en"><span className="yn-v-n">{v.n}</span>{v.en}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
