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
  const [idx,     setIdx]     = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const adopted = adoptNavSplash();
    setIdx(adopted ?? Math.floor(Math.random() * LOADING_VERSES.length));
    setVisible(true);
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
