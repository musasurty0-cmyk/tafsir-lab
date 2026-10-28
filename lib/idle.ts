/**
 * Is anyone actually at this page?
 *
 * The page's polls (notes, progress, ink) only skipped hidden tabs, so a tab
 * left open and visible on a desk polled all night. Every poll reads the
 * database, and reads are what the Supabase plan meters as egress — 5 GB a
 * month on the free plan, which TafsirLab once ran past and went down. A
 * poll now also waits while nobody has touched the page for a while, and
 * picks up again on the next interval after they do.
 */

const IDLE_AFTER_MS = 10 * 60 * 1000;
let lastActive = Date.now();
let listening = false;

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const mark = () => { lastActive = Date.now(); };
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart", "scroll"]) {
    window.addEventListener(ev, mark, { passive: true, capture: true });
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") mark(); });
}

/** Whether a background poll should run now: the tab is visible and someone is using it. */
export function shouldPoll(): boolean {
  if (typeof document === "undefined") return false;
  listen();
  return document.visibilityState === "visible" && Date.now() - lastActive < IDLE_AFTER_MS;
}
