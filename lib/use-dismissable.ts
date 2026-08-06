"use client";

/**
 * useDismissable — Escape closes it, and focus goes back where it came from.
 *
 * Both halves were inconsistent across the app. NewWorkspaceModal closed on
 * Escape; JoinWorkspaceModal, sitting behind the button right next to it, did
 * not — so whether the keyboard could dismiss a dialog depended on which one
 * you happened to open. None of them returned focus, which strands a keyboard
 * or screen-reader user at the top of the document every time a dialog closes,
 * with no way back to the control they were just using.
 *
 * Escape is marked handled with preventDefault(), and a handler that sees an
 * already-handled event ignores it. With two overlays open at once that means
 * exactly one closes per keypress instead of the whole stack collapsing.
 */

import { useEffect, useRef } from "react";

export function useDismissable(
  onClose: () => void,
  /** Pass the open flag for a component that stays mounted while closed. */
  enabled = true,
) {
  /* Held in a ref so the effect does not re-run — and re-capture the wrong
     "previously focused" element — every time the parent re-renders with a new
     closure. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;

    const returnTo = document.activeElement as HTMLElement | null;

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      /* Only take focus back if the dialog still had it. If something else has
         since been focused deliberately — the editor, a field the dialog
         navigated to — stealing it back would be the more annoying bug. */
      const active = document.activeElement;
      const stillOurs = !active || active === document.body;
      if (stillOurs && returnTo?.isConnected) {
        returnTo.focus({ preventScroll: true });
      }
    };
  }, [enabled]);
}
