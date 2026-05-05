"use client";

/**
 * TutorialOverlay — in-app interactive tutorial.
 *
 * Shows the same hands-on BetaTutorial walkthrough (write, draw, collab, begin)
 * as a full-screen overlay over the app. Auto-shows for new users on first login
 * (keyed off localStorage). Can be re-triggered by remounting with a new `key`.
 *
 * Uses overlayMode on BetaTutorial so it:
 *   - renders a close ✕ button in the header
 *   - skips the body-background mutation
 *   - shows "Start studying →" instead of "Create account →" on the final step
 */

import { useEffect, useState } from "react";
import BetaTutorial from "./BetaTutorial";

const STORAGE_KEY = "tl-tutorial-done";

export default function TutorialOverlay() {
  const [open,    setOpen]    = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    setLeaving(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "1");
      setOpen(false);
      setLeaving(false);
    }, 260);
  }

  if (!open) return null;

  return (
    <div className={`tut-overlay${leaving ? " tut-overlay--out" : " tut-overlay--in"}`}>
      <BetaTutorial overlayMode onDismiss={dismiss} />
    </div>
  );
}
