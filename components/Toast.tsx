"use client";

/**
 * Toast — the app's own transient message, in place of window.alert().
 *
 * Rises in from the bottom, says its piece, and leaves on its own. A thin bar
 * along its foot runs down for as long as it will stay, so the reader can see
 * how long they have; pointing at it pauses the bar and the clock together
 * (they are the same thing — the toast leaves when the bar's animation ends),
 * so a message being read never disappears mid-sentence.
 *
 * It used to sit in --ink with white text, which in dark mode is white on
 * near-white. It now inverts the page: --ink ground, --bg text, in both themes.
 */

import { useEffect, useRef, useState } from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";

type Tone = "success" | "error" | "info";

interface Props {
  /** null renders nothing, so callers can hold a single nullable string. */
  message: string | null;
  onDismiss: () => void;
  /** How long it stays. Defaults: 5s, or 8s for an error. */
  autoDismissMs?: number;
  tone?: Tone;
}

const EXIT_MS = 200;

export default function Toast({ message, onDismiss, autoDismissMs, tone = "info" }: Props) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  /* What is on screen. It outlives `message` by the length of the exit, so a
     toast the parent clears still leaves rather than vanishing. */
  const [shown, setShown] = useState<{ text: string; tone: Tone; n: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  // A new message restarts the toast, timer and all (the key changes).
  if (message !== last) {
    setLast(message);
    if (message) {
      setShown({ text: message, tone, n: (shown?.n ?? 0) + 1 });
      setLeaving(false);
    } else if (shown) {
      setLeaving(true);
    }
  }

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      setShown(null);
      setLeaving(false);
      if (message) onDismissRef.current();
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [leaving, message]);

  if (!shown) return null;
  const ms = autoDismissMs ?? (shown.tone === "error" ? 8000 : 5000);
  const Icon = shown.tone === "success" ? Check : shown.tone === "error" ? AlertCircle : Info;

  return (
    <div
      key={shown.n}
      className="tl-toast"
      data-tone={shown.tone}
      data-state={leaving ? "leaving" : "open"}
      role={shown.tone === "error" ? "alert" : "status"}
      style={{ "--toast-ms": `${ms}ms` } as React.CSSProperties}
    >
      <span className="tl-toast-icon" aria-hidden><Icon size={15} strokeWidth={2.4} /></span>
      <span className="tl-toast-text">{shown.text}</span>
      <button className="tl-toast-close" type="button" aria-label="Dismiss" onClick={() => setLeaving(true)}>
        <X size={14} strokeWidth={2.4} />
      </button>
      <span className="tl-toast-time" aria-hidden onAnimationEnd={() => setLeaving(true)} />
    </div>
  );
}
