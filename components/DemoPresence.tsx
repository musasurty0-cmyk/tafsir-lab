"use client";

/**
 * Keeps a demo account alive only while it is open. Mounted on every page,
 * but does nothing unless the browser carries the demo flag (set when a demo
 * starts): then it checks in every 15 seconds and the moment the tab comes
 * back into view, and says goodbye with a beacon when the page is hidden for
 * good. The server deletes the account if no check-in follows the goodbye.
 * See /api/auth/demo/presence.
 */

import { useEffect } from "react";

const URL_ = "/api/auth/demo/presence";
const isDemo = () => { try { return document.cookie.split("; ").some((c) => c === "tl-demo=1"); } catch { return false; } };

export default function DemoPresence() {
  useEffect(() => {
    if (!isDemo()) return;
    const ping = () => {
      if (!isDemo()) return;
      void fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"event":"ping"}', keepalive: true }).catch(() => {});
    };
    const onVisible = () => { if (document.visibilityState === "visible") ping(); };
    /* pagehide fires when the tab closes (and on reload, which the server tells
       apart by the ping the reloaded page sends straight away). A page kept in
       the back/forward cache is not closing, so it is left alone. */
    const onHide = (e: PageTransitionEvent) => {
      if (e.persisted || !isDemo()) return;
      navigator.sendBeacon?.(URL_, new Blob(['{"event":"close"}'], { type: "application/json" }));
    };
    ping();
    const t = setInterval(ping, 15_000);
    document.addEventListener("visibilitychange", onVisible);
    addEventListener("pagehide", onHide);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); removeEventListener("pagehide", onHide); };
  }, []);
  return null;
}
