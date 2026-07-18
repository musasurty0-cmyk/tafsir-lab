/**
 * nav-splash — instant visual feedback for route navigations.
 *
 * Next's server-rendered routes (force-dynamic) can take a beat before the
 * next screen (or its loading.tsx) appears; until then a click looks like it
 * did nothing. showNavSplash() injects a fixed brand overlay SYNCHRONOUSLY in
 * the click handler, so feedback is immediate.
 *
 * Removal is layered:
 *   • NavSplashCleaner (root layout) removes it whenever the pathname changes
 *     — i.e. as soon as the destination route actually renders.
 *   • Several destination screens + error pages also remove it (legacy, harmless).
 *   • A 12s failsafe fades it out in case navigation never completes.
 */

const SPLASH_ID = "tl-nav-splash";
const STYLE_ID  = "tl-nav-splash-style";

const CSS = `
#${SPLASH_ID} {
  position: fixed; inset: 0; z-index: 99999;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 18px; background: var(--bg, #FBFAF6);
  animation: tlns-fade 0.14s ease both;
}
#${SPLASH_ID}[data-out="1"] { animation: tlns-out 0.2s ease both; }
@keyframes tlns-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes tlns-out  { from { opacity: 1; } to { opacity: 0; } }
#${SPLASH_ID} .tlns-wrap { position: relative; width: 64px; height: 64px; }
#${SPLASH_ID} .tlns-ring {
  position: absolute; inset: -8px; border-radius: 22px;
  border: 2px solid oklch(0.55 0.08 160 / 0.25);
  border-top-color: oklch(0.55 0.08 160);
  animation: tlns-spin 0.9s linear infinite;
}
@keyframes tlns-spin { to { transform: rotate(360deg); } }
#${SPLASH_ID} .tlns-badge {
  position: absolute; inset: 0; border-radius: 16px;
  background: var(--ink, #221F1A); color: var(--bg, #FBFAF6);
  display: flex; align-items: center; justify-content: center;
  font-family: Georgia, serif; font-size: 30px; font-weight: 700;
}
#${SPLASH_ID} .tlns-label {
  font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--ink-3, #8A857D); font-family: ui-monospace, monospace;
}
`;

let failsafe: ReturnType<typeof setTimeout> | null = null;

/** Inject the overlay immediately (idempotent). Call inside the click handler. */
export function showNavSplash(label = "Loading…"): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(SPLASH_ID)) return; // already showing

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const el = document.createElement("div");
  el.id = SPLASH_ID;
  el.innerHTML = `
    <div class="tlns-wrap"><div class="tlns-ring"></div><div class="tlns-badge">T</div></div>
    <div class="tlns-label">${label.replace(/[<>&]/g, "")}</div>
  `;
  document.body.appendChild(el);

  // Failsafe: never trap the user behind a stuck overlay.
  if (failsafe) clearTimeout(failsafe);
  failsafe = setTimeout(hideNavSplash, 12000);
}

/** Fade out and remove the overlay (idempotent). */
export function hideNavSplash(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(SPLASH_ID);
  if (!el) return;
  el.dataset.out = "1";
  setTimeout(() => {
    document.getElementById(SPLASH_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
  }, 200);
  if (failsafe) { clearTimeout(failsafe); failsafe = null; }
}

/** router.push with instant splash — drop-in replacement for router.push(href). */
export function pushWithSplash(router: { push: (href: string) => void }, href: string): void {
  showNavSplash();
  router.push(href);
}
