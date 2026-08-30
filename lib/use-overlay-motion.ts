"use client";

/**
 * useOverlayMotion — keep an overlay mounted long enough to animate out.
 *
 * Every overlay in the app animated in and then vanished on the same frame it
 * closed, because `open && <Panel/>` unmounts the node before any exit
 * transition can run. An entrance without an exit reads worse than no motion
 * at all: the panel arrives with weight and then is deleted, which is exactly
 * the "things just appear and disappear" complaint.
 *
 * So the open flag and the mounted flag are separated. The caller keeps
 * rendering while `mounted` is true, and styles from `state`:
 *
 *     entering → the frame it mounts on, before the browser has painted
 *     open     → settled
 *     exiting  → closing, still on screen, still animating
 *
 * The exit is timed rather than driven by transitionend, because a panel whose
 * exit is interrupted (closed, reopened, closed again) can fire zero or two of
 * those events and leave the node mounted forever. A timer is boring and
 * always fires.
 *
 * Duration must match the CSS. It is passed in rather than read from the
 * stylesheet so a component with a longer exit does not have to fight a
 * shared constant.
 */

import { useEffect, useRef, useState } from "react";

export type OverlayState = "entering" | "open" | "exiting";

export function useOverlayMotion(open: boolean, exitMs = 200): {
  mounted: boolean;
  state: OverlayState;
} {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<OverlayState>(open ? "open" : "exiting");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }

    if (open) {
      setMounted(true);
      setState("entering");
      /* Two frames, not one. A single rAF still lands in the same paint as the
         mount for a node inserted mid-frame, so the element goes straight to
         its open styles and the entrance is skipped. The second frame
         guarantees the browser has painted the "entering" styles first, which
         is what gives the transition something to move from. */
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setState("open"));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }

    /* Closing. Nothing to do if it was never open — this also stops a closed
       overlay from mounting for one exit-length window on first render. */
    setState((s) => (s === "exiting" ? s : "exiting"));
    timer.current = setTimeout(() => setMounted(false), exitMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [open, exitMs]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { mounted, state };
}
