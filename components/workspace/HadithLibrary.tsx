"use client";

/**
 * HadithLibrary — the forty-two as a shelf you move along.
 *
 * One hadith sits in focus at the centre, its narration set in full in the
 * King Fahd Complex's Uthmanic face; its neighbours recede to either side,
 * smaller, quieter and turned a few degrees away. The movement is the
 * scroll itself: every card reads its own distance from the centre on each
 * frame and sets one CSS variable, so the shelf follows a trackpad, a wheel
 * or a finger exactly, settles with native snapping, and React never
 * re-renders while it moves.
 *
 * Press a card off to the side to bring it to the centre; press the one in
 * the centre to open it. ← and → step through, as do the arrows, and the
 * index underneath jumps anywhere. The shelf reopens where it was left.
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

const pad = (n: number) => String(n).padStart(2, "0");

export default function HadithLibrary({ hadiths, started, opening, onOpen, storageKey }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLElement | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  /* The index being restored on mount. Until the shelf has actually scrolled
     there, the scroll position says nothing about where the reader is, so
     paint() must not adopt it (or the saved place would be overwritten). */
  const restoringRef = useRef<number | null>(null);

  /* ── Scroll-linked depth ────────────────────────────────────────────────
     d = how many card-widths a card is from the centre (0 = in focus). */
  const paint = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const mid = track.scrollLeft + track.clientWidth / 2;
    let nearest = 0, best = Infinity;
    cardsRef.current.forEach((el, i) => {
      if (!el) return;
      const centre = el.offsetLeft + el.offsetWidth / 2;
      const step = el.offsetWidth + 28;
      const o = (centre - mid) / step;
      const d = Math.min(Math.abs(o), 3);
      el.style.setProperty("--d", d.toFixed(4));
      el.style.setProperty("--o", Math.max(-1.6, Math.min(1.6, o)).toFixed(4));
      if (Math.abs(o) < best) { best = Math.abs(o); nearest = i; }
    });
    if (restoringRef.current !== null) {
      if (nearest !== restoringRef.current) return;
      restoringRef.current = null;
    }
    if (nearest !== currentRef.current) {
      currentRef.current = nearest;
      setCurrent(nearest);
    }
  }, []);

  const centreOn = useCallback((i: number, smooth = true) => {
    const track = trackRef.current, el = cardsRef.current[i];
    if (!track || !el) return;
    track.scrollTo({
      left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  /* Reopen where the reader left off, else at the first hadith not yet
     studied once study has begun, else at the beginning. */
  useLayoutEffect(() => {
    let start = 0;
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (Number.isInteger(saved) && saved >= 0 && saved < hadiths.length) start = saved;
      else if (started.size) start = Math.max(0, hadiths.findIndex((h) => !started.get(h.number)?.pageCount));
    } catch { /* storage unavailable: start at the beginning */ }
    currentRef.current = start;
    setCurrent(start);
    restoringRef.current = start;
    /* The shelf may not have its final width on the first layout (styles and
       the Arabic face can still be arriving), so place it now and again once
       the page has settled. */
    const place = () => { if (restoringRef.current !== null) { centreOn(start, false); paint(); } };
    place();
    const r1 = requestAnimationFrame(() => requestAnimationFrame(place));
    const t1 = setTimeout(place, 250);
    document.fonts?.ready.then(place).catch(() => {});
    const giveUp = setTimeout(() => { restoringRef.current = null; paint(); }, 2000);
    return () => { cancelAnimationFrame(r1); clearTimeout(t1); clearTimeout(giveUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
    /* A mouse wheel scrolls vertically; on the shelf it should move along it. */
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      track.scrollLeft += e.deltaY;
    };
    const onResize = () => { centreOn(currentRef.current, false); paint(); };
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);
    return () => {
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [paint, centreOn]);

  // Remember the place.
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(storageKey, String(current)); } catch {} }, 300);
    return () => clearTimeout(t);
  }, [current, storageKey]);

  const step = (by: number) => centreOn(Math.max(0, Math.min(hadiths.length - 1, currentRef.current + by)));

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "Home") { e.preventDefault(); centreOn(0); }
    else if (e.key === "End") { e.preventDefault(); centreOn(hadiths.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); onOpen(hadiths[currentRef.current].number); }
  }

  const here = hadiths[current];

  return (
    <section className="hl" aria-label="The forty-two hadith">
      <div className="hl-stage">
        <button type="button" className="hl-arrow hl-arrow--prev" aria-label="Previous hadith"
          data-off={current === 0 ? "true" : undefined} onClick={() => step(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
        </button>

        <div className="hl-track" ref={trackRef} tabIndex={0} onKeyDown={onKey}
          aria-label="Hadith shelf. Use the left and right arrow keys to move, Enter to open.">
          {hadiths.map((h, i) => {
            const s = started.get(h.number);
            const studied = !!s && s.pageCount > 0;
            const isCurrent = i === current;
            return (
              <article
                key={h.number}
                ref={(el) => { cardsRef.current[i] = el; }}
                className="hl-card"
                data-current={isCurrent ? "true" : "false"}
                data-studied={studied ? "true" : "false"}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => (isCurrent ? onOpen(h.number) : centreOn(i))}
              >
                <header className="hl-card-head">
                  <span className="hl-no">{pad(h.number)}</span>
                  <span className="hl-state">
                    {studied ? `${s!.pageCount} page${s!.pageCount === 1 ? "" : "s"}` : "Not yet studied"}
                  </span>
                </header>
                <h2 className="hl-title">{h.title}</h2>
                {/* The whole narration, never cut with an ellipsis: a hadith
                    that stops mid-sentence reads as a misquotation. The card
                    fades it out at the foot instead; the study sheet holds
                    all of it. */}
                <p className="hl-ar" lang="ar" dir="rtl">{h.arabic}</p>
                <footer className="hl-foot">
                  <span className="hl-ref">{h.reference ?? "al-Arbaʿūn an-Nawawiyya"}</span>
                  <button type="button" className="hl-open" tabIndex={isCurrent ? 0 : -1}
                    disabled={opening !== null}
                    onClick={(e) => { e.stopPropagation(); if (isCurrent) onOpen(h.number); else centreOn(i); }}>
                    {opening === h.number ? "Opening…" : studied ? "Continue" : "Begin"}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </button>
                </footer>
              </article>
            );
          })}
        </div>

        <button type="button" className="hl-arrow hl-arrow--next" aria-label="Next hadith"
          data-off={current === hadiths.length - 1 ? "true" : undefined} onClick={() => step(1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      <nav className="hl-index" aria-label="Jump to a hadith">
        <div className="hl-ticks">
          {hadiths.map((h, i) => (
            <button
              key={h.number}
              type="button"
              className="hl-tick"
              data-current={i === current ? "true" : "false"}
              data-studied={started.get(h.number)?.pageCount ? "true" : "false"}
              aria-label={`Hadith ${h.number}: ${h.title}`}
              title={`${h.number}. ${h.title}`}
              onClick={() => centreOn(i)}
            />
          ))}
        </div>
        <p className="hl-where" aria-live="polite">
          <span className="hl-where-n">{here.number}</span> of {hadiths.length}
        </p>
      </nav>
    </section>
  );
}
