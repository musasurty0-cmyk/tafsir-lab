"use client";

/**
 * PdfFilmstrip — page-by-page access to a book.
 *
 * A long book was previously only reachable by scrolling the canvas, which
 * means hunting: there is no way to get to page 94 except by dragging past
 * ninety-three others. This is the index that was missing.
 *
 * The tiles are numbered rather than rasterised. A 129-page book would be 129
 * extra MuPDF rasters to draw thumbnails nobody can read at 44px wide, on the
 * same main thread that renders the page you are actually looking at — the
 * cost lands on the reading, and buys a picture too small to recognise. The
 * tile keeps the page's real proportions so the strip still looks like the
 * book it belongs to.
 */

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PdfPageBox } from "./PdfPages";

interface Props {
  pages:   PdfPageBox[];
  current: number;
  onGo:    (index: number) => void;
}

export default function PdfFilmstrip({ pages, current, onGo }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  /* Keep the current page in view when it changes from outside the strip —
     the arrows, or a keyboard shortcut — so the strip never shows a selection
     that has scrolled off it. */
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    /* Follow focus to the new tile, but only if focus was already inside the
       strip — otherwise clicking a tile would steal focus from whatever the
       reader was doing on the page. */
    const strip = stripRef.current;
    if (strip && strip.contains(document.activeElement)) activeRef.current?.focus();
  }, [current]);

  if (pages.length === 0) return null;

  const go = (i: number) => onGo(Math.max(0, Math.min(pages.length - 1, i)));

  /* Arrow keys walk the strip. Without this, reaching page 93 of a 93-page
     book means ninety-three presses of Tab — the strip is a single control for
     choosing a page, so it behaves like one rather than like ninety-three
     separate stops. Home and End jump to the covers. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step =
      e.key === "ArrowRight" ? 1 :
      e.key === "ArrowLeft"  ? -1 :
      e.key === "PageDown"   ? 10 :
      e.key === "PageUp"     ? -10 : 0;
    if (step) { e.preventDefault(); go(current + step); return; }
    if (e.key === "Home") { e.preventDefault(); go(0); return; }
    if (e.key === "End")  { e.preventDefault(); go(pages.length - 1); }
  };

  return (
    <div className="film" role="group" aria-label="Pages" onKeyDown={onKeyDown}>
      <button
        type="button" className="film-arrow" onClick={() => go(current - 1)}
        disabled={current <= 0} aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="film-strip" ref={stripRef}>
        {pages.map((p) => (
          <button
            key={p.index}
            ref={p.index === current ? activeRef : undefined}
            className="film-tile"
            type="button"
            tabIndex={p.index === current ? 0 : -1}
            data-active={p.index === current ? "true" : "false"}
            onClick={() => onGo(p.index)}
            aria-label={`Page ${p.index + 1}`}
            aria-current={p.index === current ? "true" : undefined}
          >
            {/* The tile carries the page's own proportions, so a landscape
                plate in a portrait book is visibly a different shape. */}
            <span className="film-sheet" style={{ aspectRatio: `${p.w} / ${p.h}` }} />
            <span className="film-num">{p.index + 1}</span>
          </button>
        ))}
      </div>

      <button
        type="button" className="film-arrow" onClick={() => go(current + 1)}
        disabled={current >= pages.length - 1} aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>

      <span className="film-count" aria-live="polite">
        {current + 1}/{pages.length}
      </span>
    </div>
  );
}
