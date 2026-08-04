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
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { showNavSplash, hideNavSplash } from "@/lib/nav-splash";

export default function NavSplashCleaner() {
  const pathname = usePathname();

  // Destination rendered → drop the overlay.
  useEffect(() => { hideNavSplash(); }, [pathname]);

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
      if (href.split("?")[0] === window.location.pathname) return; // same page
      showNavSplash();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
