"use client";

/**
 * TutorialOverlay — starts the in-product tour, once, when nothing else is
 * already teaching.
 *
 * The onboarding carousel and this tour answer different questions — the
 * carousel explains the SHAPE of the app before you are in it, the tour walks
 * you through the editor once you are. Running both at once put two
 * introductions on screen simultaneously, each unaware of the other, which is
 * worse than either alone. So the tour waits: it starts only after the
 * carousel has been finished or skipped, and it listens for that moment rather
 * than requiring a reload to notice.
 */

import { useEffect } from "react";
import { startTour, isTourDone } from "@/lib/tour";

const ONBOARDING_KEY = "tl-onboarding";

function onboardingDone(): boolean {
  try { return localStorage.getItem(ONBOARDING_KEY) === "done"; }
  catch { return true; }   // storage unavailable — do not trap the user
}

export default function TutorialOverlay() {
  useEffect(() => {
    if (isTourDone()) return;

    if (onboardingDone()) { startTour(); return; }

    /* Poll rather than listen for `storage`: that event fires only in OTHER
       tabs, never the one that wrote the value, and the carousel finishing is
       always in this tab. A second is slower than an event and completely
       reliable, which is the right trade for a one-shot handoff. */
    const id = setInterval(() => {
      if (!onboardingDone()) return;
      clearInterval(id);
      if (!isTourDone()) startTour();
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return null;
}
