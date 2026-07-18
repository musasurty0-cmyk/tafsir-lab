"use client";

/**
 * NavSplashCleaner — mounted once in the root layout.
 *
 * 1. Shows the nav splash instantly for ANY internal <a>/<Link> click
 *    (capture-phase listener, so no per-link wiring needed).
 * 2. Hides it whenever the pathname changes — i.e. the destination route has
 *    actually rendered. Also clears any leftover splash on first mount.
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
