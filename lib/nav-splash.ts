/**
 * nav-splash — instant visual feedback for route navigations.
 *
 * Next's server-rendered routes (force-dynamic) can take a beat before the
 * next screen (or its loading.tsx) appears; until then a click looks like it
 * did nothing. showNavSplash() injects the overlay SYNCHRONOUSLY in the click
 * handler, so feedback is immediate.
 *
 * Look: identical to LoadingVerse (the ayah loading screen) — brand, a random
 * verse card, three pulsing dots — by reusing its lv-* classes from
 * globals.css. That way the nav splash and any route loading.tsx blend into
 * ONE seamless screen instead of two conflicting splashes.
 *
 * Removal is layered:
 *   • NavSplashCleaner (root layout) removes it whenever the pathname changes.
 *   • Several destination screens + error pages also remove it (legacy, harmless).
 *   • A 12s failsafe fades it out in case navigation never completes.
 */

const SPLASH_ID = "tl-nav-splash";
const STYLE_ID  = "tl-nav-splash-style";

// Same rotation as components/LoadingVerse.tsx — one is picked at random.
const VERSES = [
  ["بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", "In the name of Allah, the Most Gracious, the Most Merciful", "Al-Fatiha · 1:1"],
  ["اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ", "Read in the name of your Lord who created", "Al-ʿAlaq · 96:1"],
  ["وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا", "And recite the Quran with measured recitation", "Al-Muzzammil · 73:4"],
  ["وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ", "And We have certainly made the Quran easy to remember — so is there anyone who will be reminded?", "Al-Qamar · 54:17"],
  ["إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ", "Indeed, this Quran guides to that which is most suitable", "Al-Isrāʾ · 17:9"],
  ["كِتَابٌ أَنزَلْنَاهُ إِلَيْكَ مُبَارَكٌ لِّيَدَّبَّرُوا آيَاتِهِ", "A blessed Book We have revealed to you, so that they may ponder its verses", "Ṣād · 38:29"],
  ["أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ", "Do they not reflect upon the Quran?", "Al-Nisāʾ · 4:82"],
] as const;

// Only the bits lv-* doesn't provide: sit above everything + fade transitions.
const CSS = `
#${SPLASH_ID} { z-index: 99999; animation: tlns-fade 0.14s ease both; }
#${SPLASH_ID}[data-out="1"] { animation: tlns-out 0.2s ease both; }
@keyframes tlns-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes tlns-out  { from { opacity: 1; } to { opacity: 0; } }
`;

let failsafe: ReturnType<typeof setTimeout> | null = null;

/** Inject the overlay immediately (idempotent). Call inside the click handler. */
export function showNavSplash(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(SPLASH_ID)) return; // already showing

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const [ar, tr, ref] = VERSES[Math.floor(Math.random() * VERSES.length)];
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
  (el.querySelector(".lv-arabic") as HTMLElement).textContent      = ar;
  (el.querySelector(".lv-translation") as HTMLElement).textContent = tr;
  (el.querySelector(".lv-ref") as HTMLElement).textContent         = ref;
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
