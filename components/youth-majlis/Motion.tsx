"use client";

/**
 * The page's motion, in one place:
 *
 *   • reveals — anything marked data-reveal rises into place the first time
 *     it scrolls into view (data-reveal-i staggers siblings);
 *   • the progress hairline under the nav, tracking how far down you are;
 *   • the nav's current section, underlined as you pass through it;
 *   • the hero drifting back and fading as you scroll away from it.
 *
 * All of it is driven by IntersectionObserver and one passive scroll listener
 * writing CSS variables — nothing re-renders React while you scroll.
 */

import { useEffect } from "react";

export default function Motion() {
  useEffect(() => {
    const root = document.documentElement;
    const prevBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    // Hydrated: reveals are in our hands now, so the CSS failsafe stands down.
    root.classList.add("y-ready");

    // ── Reveals ──
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.shown = "";
        io.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => io.observe(el));

    // ── Current section in the nav ──
    const links = [...document.querySelectorAll<HTMLAnchorElement>('.y-nav-links a[href^="#"]')];
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const id = e.target.id;
        for (const a of links) {
          if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        }
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach((a) => {
      const t = document.getElementById(a.getAttribute("href")!.slice(1));
      if (t) spy.observe(t);
    });

    // ── Progress hairline + hero drift ──
    const bar  = document.querySelector<HTMLElement>(".y-progress");
    const hero = document.querySelector<HTMLElement>("[data-parallax]");
    let raf = 0;
    const frame = () => {
      raf = 0;
      const max = root.scrollHeight - innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
      if (hero) hero.style.setProperty("--drift", String(Math.min(1, scrollY / Math.max(1, hero.offsetHeight))));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
    addEventListener("scroll", onScroll, { passive: true });
    frame();

    return () => {
      io.disconnect(); spy.disconnect();
      removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      root.style.scrollBehavior = prevBehavior;
      root.classList.remove("y-ready");
    };
  }, []);

  return null;
}
