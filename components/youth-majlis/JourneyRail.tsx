"use client";

/**
 * The journey, as a row you can move through: swipe or scroll it, or use the
 * arrows beneath it, which dim at either end. Each module's tile carries the
 * ring from the question explorer, so progress made there shows here.
 */

import { useEffect, useRef, useState } from "react";
import { useLocal, exploredKey } from "./useLocal";
import { Ring } from "./QuestionExplorer";

type M = { n: number; surahAr: string; surahEn: string; title: string };
type L = { n: number; name: string };

function Tile({ m, current, total }: { m: M; current: number; total: number }) {
  const [explored] = useLocal<number[]>(exploredKey(m.n), []);
  const state = m.n < current ? "Completed" : m.n === current ? "Now studying" : "Coming up";
  return (
    <a href={`#module-${m.n}`} className="y-tile" role="listitem" data-current={m.n === current ? "" : undefined} data-reveal data-reveal-i={m.n - 1}>
      <span className="y-tile-top">
        <span className="y-tile-state">{state}</span>
        <Ring value={explored.length} max={total} size={34} stroke={3.5} label={`${explored.length} of ${total} questions explored`} />
      </span>
      <span className="y-tile-ar" lang="ar" dir="rtl">{m.surahAr}</span>
      <span className="y-tile-name">{m.surahEn}</span>
      <span className="y-tile-title">{m.title}</span>
      <span className="y-tile-n">Level 1 · Module {m.n}</span>
    </a>
  );
}

export default function JourneyRail({ modules, levels, current, total }: {
  modules: M[]; levels: L[]; current: number; total: number;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ start: true, end: false });

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () => setEnds({
      start: el.scrollLeft < 8,
      end:   el.scrollLeft + el.clientWidth > el.scrollWidth - 8,
    });
    update();
    el.addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); removeEventListener("resize", update); };
  }, []);

  function page(dir: 1 | -1) {
    const el = rail.current;
    if (!el) return;
    const tile = el.querySelector<HTMLElement>(".y-tile");
    el.scrollBy({ left: dir * ((tile?.offsetWidth ?? 300) + 20) * 2, behavior: "smooth" });
  }

  return (
    <>
      <div className="y-rail" role="list" ref={rail}>
        {modules.map((m) => <Tile key={m.n} m={m} current={current} total={total} />)}
        {levels.slice(1).map((lv, i) => (
          <div key={lv.n} className="y-tile y-tile--locked" role="listitem" data-reveal data-reveal-i={modules.length + i}>
            <span className="y-tile-top"><span className="y-tile-state">Later</span></span>
            <span className="y-tile-level">{lv.n}</span>
            <span className="y-tile-name">{lv.name}</span>
            <span className="y-tile-title">Opens after {levels[lv.n - 2].name}.</span>
            <span className="y-tile-n">Level {lv.n}</span>
          </div>
        ))}
      </div>
      <div className="y-wrap y-rail-ctl">
        <button onClick={() => page(-1)} disabled={ends.start} aria-label="Scroll the journey back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <button onClick={() => page(1)} disabled={ends.end} aria-label="Scroll the journey forward">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </>
  );
}
