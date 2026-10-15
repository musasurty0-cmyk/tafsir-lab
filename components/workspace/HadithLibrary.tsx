"use client";

/**
 * HadithLibrary — the forty-two on a shelf.
 *
 * Like a bookshelf, not a carousel: every card is the same size and sits
 * flat, side by side, with the next one always peeking in from the edge.
 * Moving along is just the shelf sliding under your hand: native scrolling
 * and snapping, nothing tilting, shrinking or fading as it goes.
 *
 * A card is the narration itself, set in the King Fahd Complex's Uthmanic
 * face under its number, with the English title and source at its foot.
 * Press any card to open it. The arrows above page along the shelf, so do
 * ← and →, and the index underneath shows which hadith are in view and
 * jumps anywhere. The shelf reopens where it was left.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Hadith } from "@/lib/hadith";

export interface ShelfState {
  pageCount: number;
}

interface Props {
  hadiths: Hadith[];
  started: Map<number, ShelfState>;
  opening: number | null;
  onOpen: (n: number) => void;
  /** Where to remember the reader's place on this device. */
  storageKey: string;
}

export default function HadithLibrary({ hadiths, started, opening, onOpen, storageKey }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLButtonElement | null)[]>([]);
  /** The first and last hadith (indexes) wholly or mostly in view. */
  const [view, setView] = useState<[number, number]>([0, 0]);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const left = track.scrollLeft, right = left + track.clientWidth;
    let first = -1, last = -1;
    cardsRef.current.forEach((el, i) => {
      if (!el) return;
      const a = el.offsetLeft, b = a + el.offsetWidth;
      const seen = Math.min(b, right) - Math.max(a, left);
      if (seen >= el.offsetWidth * 0.6) { if (first < 0) first = i; last = i; }
    });
    if (first < 0) return;
    setView((v) => (v[0] === first && v[1] === last ? v : [first, last]));
  }, []);

  /** Slide so that hadith `i` is the first on the shelf. */
  const showFrom = useCallback((i: number, smooth = true) => {
    const track = trackRef.current, el = cardsRef.current[i];
    if (!track || !el) return;
    const inset = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    track.scrollTo({ left: el.offsetLeft - inset, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Reopen where the reader left off.
  useLayoutEffect(() => {
    let start = 0;
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (Number.isInteger(saved) && saved > 0 && saved < hadiths.length) start = saved;
    } catch { /* storage unavailable */ }
    const place = () => { showFrom(start, false); measure(); };
    place();
    const r = requestAnimationFrame(() => requestAnimationFrame(place));
    document.fonts?.ready.then(place).catch(() => {});
    return () => cancelAnimationFrame(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; measure(); }); };
    /* A mouse wheel scrolls vertically; on the shelf it should slide along it. */
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      track.scrollLeft += e.deltaY;
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", measure);
    return () => {
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", measure);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [measure]);

  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(storageKey, String(view[0])); } catch {} }, 300);
    return () => clearTimeout(t);
  }, [view, storageKey]);

  const perPage = Math.max(1, view[1] - view[0] + 1);
  const page = (dir: 1 | -1) => showFrom(Math.max(0, Math.min(hadiths.length - 1, view[0] + dir * perPage)));
  const atStart = view[0] === 0;
  const atEnd = view[1] === hadiths.length - 1;

  /* ← and → move between cards; the shelf follows the focus on its own. */
  function onKey(e: React.KeyboardEvent, i: number) {
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (to === null || to < 0 || to >= hadiths.length) return;
    e.preventDefault();
    const el = cardsRef.current[to];
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }

  return (
    <section className="hl" aria-label="The forty-two hadith">
      <div className="hl-bar">
        <p className="hl-range">
          {view[0] + 1}–{view[1] + 1} <span>of {hadiths.length}</span>
        </p>
        <div className="hl-arrows">
          <button type="button" className="hl-arrow" aria-label="Previous hadith" disabled={atStart} onClick={() => page(-1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button type="button" className="hl-arrow" aria-label="Next hadith" disabled={atEnd} onClick={() => page(1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <div className="hl-track" ref={trackRef}>
        {hadiths.map((h, i) => {
          const s = started.get(h.number);
          const studied = !!s && s.pageCount > 0;
          return (
            <button
              key={h.number}
              type="button"
              ref={(el) => { cardsRef.current[i] = el; }}
              className="hl-card"
              data-studied={studied ? "true" : "false"}
              data-busy={opening === h.number ? "true" : undefined}
              disabled={opening !== null}
              onClick={() => onOpen(h.number)}
              onKeyDown={(e) => onKey(e, i)}
              aria-label={`Hadith ${h.number}: ${h.title}${studied ? `, ${s!.pageCount} page${s!.pageCount === 1 ? "" : "s"}` : ""}`}
            >
              <span className="hl-head">
                <span className="hl-no">{h.number}</span>
                <span className="hl-state">
                  {opening === h.number ? "Opening…" : studied ? `${s!.pageCount} page${s!.pageCount === 1 ? "" : "s"}` : ""}
                </span>
              </span>
              {/* The whole narration, never cut with an ellipsis: it fades
                  out at the foot of the card instead. */}
              <span className="hl-ar" lang="ar" dir="rtl">{h.arabic}</span>
              <span className="hl-foot">
                <span className="hl-title">{h.title}</span>
                {h.reference && <span className="hl-ref">{h.reference}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <nav className="hl-index" aria-label="Jump to a hadith">
        {hadiths.map((h, i) => (
          <button
            key={h.number}
            type="button"
            className="hl-tick"
            data-in-view={i >= view[0] && i <= view[1] ? "true" : "false"}
            data-studied={started.get(h.number)?.pageCount ? "true" : "false"}
            aria-label={`Hadith ${h.number}: ${h.title}`}
            title={`${h.number}. ${h.title}`}
            onClick={() => showFrom(i)}
          />
        ))}
      </nav>
    </section>
  );
}
