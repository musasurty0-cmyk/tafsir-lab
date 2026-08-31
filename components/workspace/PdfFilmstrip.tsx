"use client";

/**
 * PdfFilmstrip — page-by-page access to a book.
 *
 * A long book was previously only reachable by scrolling the canvas, which
 * means hunting: there is no way to get to page 94 except by dragging past
 * ninety-three others. This is the index that was missing.
 *
 * The tiles carry real page previews, rendered LAZILY: only the tiles
 * scrolled into the strip's view ask for a thumbnail, and those requests ride
 * a lower-priority lane of the document's own raster queue — behind page
 * renders, behind the pointer's quiet-time rule — so a preview never costs
 * the page being read or a stroke being drawn. Until its image lands, a tile
 * shows the page number on the page's real proportions.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PdfPageBox, PdfThumbApi } from "./PdfPages";

interface Props {
  pages:   PdfPageBox[];
  current: number;
  onGo:    (index: number) => void;
  thumbs?: PdfThumbApi | null;
}

export default function PdfFilmstrip({ pages, current, onGo, thumbs }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  /* Bumped whenever a thumbnail lands, so tiles re-read the cache. The
     version number itself is meaningless; changing is its whole job. */
  const [, setThumbTick] = useState(0);

  useEffect(() => {
    if (!thumbs) return;
    return thumbs.subscribe(() => setThumbTick((t) => t + 1));
  }, [thumbs]);

  /* Ask for previews only for tiles actually visible in the strip (plus a
     margin), in strip order. The requests queue behind page rasters, so
     scrolling the strip through a long book stays cheap. */
  useEffect(() => {
    if (!thumbs || !stripRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const idx = Number((e.target as HTMLElement).dataset.tile);
          if (Number.isFinite(idx)) thumbs.request(idx);
        }
      },
      { root: stripRef.current, rootMargin: "0px 240px" },
    );
    for (const el of stripRef.current.querySelectorAll("[data-tile]")) io.observe(el);
    return () => io.disconnect();
  }, [thumbs, pages.length]);

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
            data-tile={p.index}
            data-active={p.index === current ? "true" : "false"}
            onClick={() => onGo(p.index)}
            aria-label={`Page ${p.index + 1}`}
            aria-current={p.index === current ? "true" : undefined}
          >
            {/* The tile carries the page's own proportions, so a landscape
                plate in a portrait book is visibly a different shape. The
                preview fills it once the lazy raster lands. */}
            <span className="film-sheet" style={{ aspectRatio: `${p.w} / ${p.h}` }}>
              {thumbs?.get(p.index) && (
                <img className="film-thumb" src={thumbs.get(p.index)} alt="" draggable={false} />
              )}
            </span>
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
