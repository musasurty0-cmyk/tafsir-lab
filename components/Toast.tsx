"use client";

/**
 * Toast — the app's own transient message, in place of window.alert().
 *
 * The markup and classes are the ones the home screen has been using for its
 * navigation errors; this only lifts them out so other screens can say
 * something went wrong without a blocking browser dialog. alert() stops the
 * page dead, cannot be styled, and on iOS names the site in the title bar —
 * for "that file isn't a PDF" none of that is wanted.
 *
 * Dismissal is deliberately not automatic by default. A message the user has
 * not read yet should not disappear on a timer; pass autoDismissMs only where
 * the message is a confirmation rather than a problem.
 */

import { useEffect, useRef } from "react";

interface Props {
  /** null renders nothing, so callers can hold a single nullable string. */
  message: string | null;
  onDismiss: () => void;
  /** Omit to keep it until dismissed. */
  autoDismissMs?: number;
}

export default function Toast({ message, onDismiss, autoDismissMs }: Props) {
  /* Held in a ref so an inline arrow from the parent does not restart the
     timer on every render. Assigned in an effect rather than in the render
     body: writing to a ref while rendering is what react-hooks/refs flags, and
     an un-deped effect is the ordinary way to keep a callback current. */
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  useEffect(() => {
    if (!message || !autoDismissMs) return;
    const t = setTimeout(() => onDismissRef.current(), autoDismissMs);
    return () => clearTimeout(t);
  }, [message, autoDismissMs]);

  if (!message) return null;

  return (
    <div className="hw-nav-toast" role="alert">
      <span>{message}</span>
      <button
        className="hw-nav-toast-close"
        onClick={onDismiss}
        aria-label="Dismiss"
        type="button"
      >
        ×
      </button>
    </div>
  );
}
