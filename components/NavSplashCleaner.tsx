"use client";

/**
 * NavSplashCleaner — mounted once in the root layout.
 *
 * 1. ARMS the nav splash for ANY internal <a>/<Link> click (capture-phase
 *    listener, so no per-link wiring needed). Arming is not painting: nothing
 *    appears unless the navigation is still running a moment later, so a
 *    prefetched route that resolves immediately is never covered by a loading
 *    screen it did not need.
 * 2. Cancels or hides it whenever the pathname changes — i.e. the destination
 *    route has actually rendered.
 *
 * router.push() call sites (buttons) call showNavSplash() themselves.
 *
 * Links that hand back a FILE are skipped (Dunya papers, prep packs, the class
 * notes PDF, CSV exports). The browser downloads them and stays on the page, so
 * the pathname never changes and the splash would sit over the screen until the
 * failsafe, which reads as the app freezing on every download.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { showNavSplash, hideNavSplash } from "@/lib/nav-splash";

const FILE_EXT = /\.(pdf|zip|csv|txt|json|png|jpe?g|gif|webp|svg|mp3|m4a|mp4|docx?|xlsx?|pptx?)$/i;

/** True when following the link returns a file rather than another page. */
function isFileLink(a: HTMLAnchorElement, href: string): boolean {
  if (a.hasAttribute("download")) return true;
  const path = href.split(/[?#]/)[0];
  if (path === "/api" || path.startsWith("/api/")) return true;   // route handlers are never pages
  if (FILE_EXT.test(path)) return true;
  return /[?&]download=1(&|#|$)/.test(href);
}

export default function NavSplashCleaner() {
  const pathname = usePathname();

  // Destination rendered → drop the overlay.
  useEffect(() => { hideNavSplash(); }, [pathname]);

  // Back from a PDF opened in the same tab: the page is restored from the
  // back/forward cache exactly as it was left, splash and all, with its
  // failsafe timer frozen. Clear it on the way back in.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) hideNavSplash(); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // Instant feedback for every internal link click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/")) return;          // internal only
      if (a.target && a.target !== "_self") return;        // new tab etc.
      if (isFileLink(a, href)) return;                     // a download, not a page
      if (href.split("?")[0] === window.location.pathname) return; // same page
      showNavSplash();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
