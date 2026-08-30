"use client";

/**
 * False on the server and on the first client render, true afterwards.
 *
 * For anything whose value depends on *when* or *where* it is rendered. React
 * renders a client component twice — once into HTML on the server, once in the
 * browser — and expects both to agree. Two things routinely break that:
 *
 *   now      "5m ago" is computed from Date.now(), and the two renders happen
 *            at different moments.
 *   timezone Intl formats in the runtime's zone. Vercel runs UTC; the reader
 *            does not. Any date near midnight formats differently.
 *
 * When they disagree React discards the tree with a hydration error. Nobody
 * notices at midday, which is exactly why it survives review.
 *
 * The fix is to render something stable until the browser is in charge, then
 * the real value:
 *
 *     const hydrated = useHydrated();
 *     <span>{hydrated ? ago(item.at) : " "}</span>
 *
 * A non-breaking space rather than an empty string keeps the line's height, so
 * nothing jumps when the real text arrives.
 */

import { useEffect, useState } from "react";

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  // Runs only in the browser, and only after the first paint has matched the
  // server's HTML — which is the whole point.
  useEffect(() => { setHydrated(true); }, []);
  return hydrated;
}
