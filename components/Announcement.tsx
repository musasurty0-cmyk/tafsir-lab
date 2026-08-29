"use client";

/**
 * Announcement — the "what's new" strip on the dashboard.
 *
 * Expands in place rather than opening a dialog, because the detail is a short
 * list and a modal for it would be heavier than the content. Dismissal is
 * remembered per release id, so a future announcement reappears for someone who
 * dismissed the previous one.
 */

import { useEffect, useState } from "react";
import { Info, ArrowDownRight, X } from "lucide-react";

/** Bump this when the list changes — that is what re-shows it to everyone. */
const RELEASE = "2026-08-boards-analytics";
const KEY = `tl-announce:${RELEASE}`;

const ITEMS = [
  "Analytics — activity calendar, streaks and an annotation map",
  "Friends and a leaderboard, both opt-in",
  "Blank boards now keep a document as well as a canvas",
  "Multiple mushaf types: Uthmani, Indo-Pak, Word-by-Word",
  "Real-time collaboration with live cursors",
  "Export every annotation you have written, as Markdown",
];

export default function Announcement() {
  const [hidden, setHidden] = useState(true);   // assume hidden until checked
  const [open, setOpen]     = useState(false);

  // Read after hydration; rendering from localStorage would make the server's
  // HTML and the first client paint disagree.
  useEffect(() => {
    try { setHidden(localStorage.getItem(KEY) === "dismissed"); }
    catch { setHidden(false); }
  }, []);

  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(KEY, "dismissed"); } catch { /* ignore */ }
  }

  if (hidden) return null;

  return (
    <section className="anno" data-open={open ? "true" : "false"}>
      <button className="anno-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="anno-icon" aria-hidden><Info size={18} /></span>
        <span className="anno-text">
          <strong>So many new features</strong>
          <span>Analytics, streaks, friends, boards with documents, and more. Tell us what breaks.</span>
        </span>
        <ArrowDownRight size={18} aria-hidden className="anno-chev" />
      </button>

      <div className="anno-body" hidden={!open}>
        <p className="anno-body-label">What is live</p>
        <ul>{ITEMS.map((i) => <li key={i}>{i}</li>)}</ul>
        <button className="an-btn an-btn--sm an-btn--ghost" onClick={dismiss}>
          <X size={14} aria-hidden /> Dismiss
        </button>
      </div>
    </section>
  );
}
