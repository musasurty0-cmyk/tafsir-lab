/**
 * nav-splash — feedback for route navigations that are actually slow.
 *
 * Next's server-rendered routes (force-dynamic) can take a beat before the next
 * screen (or its loading.tsx) appears; until then a click looks like it did
 * nothing. This covers that gap — but only that gap.
 *
 * Two things it deliberately does NOT do any more:
 *
 *   · It no longer paints instantly. Injecting synchronously in the click
 *     handler meant a prefetched navigation that resolved in 40ms still got
 *     ~340ms of overlay (fade in, then fade out) laid over the top of it —
 *     friction manufactured for a wait that never happened. Showing is now
 *     deferred by GRACE_MS and cancelled if the destination arrives first, so
 *     fast navigations show nothing at all.
 *
 *   · It no longer picks its own verse. The route's loading.tsx renders
 *     LoadingVerse, which used to choose independently from an identical list;
 *     the verse therefore CHANGED partway through one navigation, which reads
 *     as a second splash starting rather than the first one continuing. The
 *     chosen index is published here and LoadingVerse adopts it — see
 *     adoptNavSplash().
 *
 * Look: identical to LoadingVerse by reusing its lv-* classes from globals.css.
 *
 * Removal is layered:
 *   • LoadingVerse adopts it the moment a route's loading UI mounts.
 *   • NavSplashCleaner (root layout) removes it whenever the pathname changes.
 *   • A 12s failsafe fades it out in case navigation never completes.
 */

import { LOADING_VERSES } from "./loading-verses";

const SPLASH_ID = "tl-nav-splash";
const STYLE_ID  = "tl-nav-splash-style";

/**
 * How long a navigation may take before it is worth telling the user about.
 * Below this, a spinner is noise: the screen has already changed by the time
 * the eye reaches it.
 */
const GRACE_MS = 130;

// Only the bits lv-* doesn't provide: sit above everything + fade transitions.
const CSS = `
#${SPLASH_ID} { z-index: 99999; animation: tlns-fade 0.14s ease both; }
#${SPLASH_ID}[data-out="1"] { animation: tlns-out 0.2s ease both; }
@keyframes tlns-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes tlns-out  { from { opacity: 1; } to { opacity: 0; } }
`;

let failsafe: ReturnType<typeof setTimeout> | null = null;
let pending:  ReturnType<typeof setTimeout> | null = null;

/** Index of the verse this navigation is showing, so the route's loading UI
 *  can continue with the same one instead of starting a different screen. */
let verseIdx: number | null = null;

function paint(): void {
  if (document.getElementById(SPLASH_ID)) return;

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const v = LOADING_VERSES[verseIdx ?? 0];
  const el = document.createElement("div");
  el.id = SPLASH_ID;
  el.className = "lv-screen";
  el.innerHTML = `
    <p class="lv-brand">TafsirLab</p>
    <div class="lv-card lv-card--in">
      <p class="lv-arabic" dir="rtl"></p>
      <p class="lv-translation"></p>
      <p class="lv-ref"></p>
    </div>
    <div class="lv-dots" aria-hidden="true"><span></span><span></span><span></span></div>
  `;
  (el.querySelector(".lv-arabic") as HTMLElement).textContent      = v.arabic;
  (el.querySelector(".lv-translation") as HTMLElement).textContent = v.translation;
  (el.querySelector(".lv-ref") as HTMLElement).textContent         = v.ref;
  document.body.appendChild(el);

  // Failsafe: never trap the user behind a stuck overlay.
  if (failsafe) clearTimeout(failsafe);
  failsafe = setTimeout(hideNavSplash, 12000);
}

/**
 * Arm the splash. Nothing is painted unless the navigation is still running
 * GRACE_MS later, so an instant navigation is never dressed up as a slow one.
 */
export function showNavSplash(): void {
  if (typeof document === "undefined") return;
  if (pending || document.getElementById(SPLASH_ID)) return; // already armed

  verseIdx = Math.floor(Math.random() * LOADING_VERSES.length);
  pending = setTimeout(() => { pending = null; paint(); }, GRACE_MS);
}

/** Cancel a pending splash, and fade out one that is already up. */
export function hideNavSplash(): void {
  if (typeof document === "undefined") return;
  if (pending) { clearTimeout(pending); pending = null; }
  verseIdx = null;

  const el = document.getElementById(SPLASH_ID);
  if (!el) return;
  el.dataset.out = "1";
  setTimeout(() => {
    document.getElementById(SPLASH_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
  }, 200);
  if (failsafe) { clearTimeout(failsafe); failsafe = null; }
}

/**
 * Hand this navigation's verse over to the route's own loading UI.
 *
 * Called by LoadingVerse as it mounts. The overlay is removed WITHOUT its fade,
 * because the screen replacing it is identical and showing the same verse —
 * cross-fading two copies of one screen is what made the handover visible.
 *
 * Returns the verse index to continue with, or null if no navigation splash
 * was in play (a cold load, say).
 */
export function adoptNavSplash(): number | null {
  if (typeof document === "undefined") return null;
  const idx = verseIdx;

  if (pending) { clearTimeout(pending); pending = null; }
  document.getElementById(SPLASH_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  if (failsafe) { clearTimeout(failsafe); failsafe = null; }
  verseIdx = null;

  return idx;
}

/** router.push with the splash armed — drop-in replacement for router.push. */
export function pushWithSplash(router: { push: (href: string) => void }, href: string): void {
  showNavSplash();
  router.push(href);
}
