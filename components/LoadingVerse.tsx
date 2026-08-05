"use client";

/**
 * LoadingVerse — the screen a route shows while it loads.
 *
 * It may be the SECOND loading screen of a single navigation: nav-splash puts
 * an identical one up on click, and this replaces it once Next commits the
 * route. So it does not choose a verse of its own — it adopts whichever one is
 * already on screen and removes that overlay without a fade, which turns two
 * screens into one. Picking independently is what made the verse change
 * mid-load and read as a second splash starting.
 */

import { useEffect, useState } from "react";
import { LOADING_VERSES } from "@/lib/loading-verses";
import { adoptNavSplash } from "@/lib/nav-splash";

export default function LoadingVerse() {
  /* Deterministic on the server. Randomising in the initial state would differ
     between the server render and hydration, and this component IS server
     rendered as a route's loading.tsx. */
  const [idx, setIdx] = useState(0);

  /* MUST start visible. This renders as a route's loading.tsx, and Next streams
     that fallback as plain HTML which it then REPLACES with the real route — it
     is never hydrated in the ordinary way, so an effect that reveals the card
     may never run. Starting hidden and revealing in useEffect left the card at
     opacity 0 for the whole load: the verse was in the DOM, correct, and
     invisible, so the splash showed only the wordmark and the dots. */
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    /* If a nav splash is in play, continue ITS verse rather than starting a
       different one — that swap is what read as a second splash. Only choose
       randomly when there is nothing to adopt. */
    const adopted = adoptNavSplash();
    setIdx(adopted ?? Math.floor(Math.random() * LOADING_VERSES.length));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % LOADING_VERSES.length);
        setVisible(true);
      }, 350);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const verse = LOADING_VERSES[idx];

  return (
    <div className="lv-screen">
      <p className="lv-brand">TafsirLab</p>

      <div className={`lv-card${visible ? " lv-card--in" : ""}`}>
        <p className="lv-arabic" dir="rtl">{verse.arabic}</p>
        <p className="lv-translation">{verse.translation}</p>
        <p className="lv-ref">{verse.ref}</p>
      </div>

      <div className="lv-dots" aria-hidden="true">
        <span /><span /><span />
      </div>
    </div>
  );
}
