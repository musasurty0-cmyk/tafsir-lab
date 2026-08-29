"use client";

/**
 * NameEntryModal — the first thing a new user sees.
 *
 * Asks two things and no more: what to call you, and whether your totals may
 * appear on the public leaderboard. The second is asked here rather than
 * buried in Settings because it is the only screen where the answer is being
 * decided rather than changed — and a ranking someone never agreed to appear
 * on is a surprise, not a feature.
 *
 * Shown when "tl-user-name" is absent from localStorage. The name is stored
 * locally as well as on the server so a failed request does not trap the user
 * behind this modal forever.
 */

import { useEffect, useState } from "react";

export default function NameEntryModal({ initialName = "" }: { initialName?: string }) {
  const [show,   setShow]   = useState(false);
  const [name,   setName]   = useState(initialName);
  const [publicBoard, setPublicBoard] = useState(true);
  const [saving, setSaving] = useState(false);

  // Checked after hydration: reading localStorage during render would make the
  // server's HTML and the first client paint disagree.
  useEffect(() => {
    if (!localStorage.getItem("tl-user-name")) setShow(true);
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await fetch("/api/me", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: trimmed, publicLeaderboard: publicBoard }),
      });
    } catch {
      /* Network error is fine — the name is stored locally regardless, and the
         leaderboard default is already true on the server. */
    } finally {
      localStorage.setItem("tl-user-name", trimmed);
      setShow(false);
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="name-entry-overlay">
      <div className="name-entry-modal">
        <h1 className="name-entry-title">Welcome to Tafsir Lab</h1>
        <p className="name-entry-subtitle">
          Please choose a display name that will be shown to other users.
        </p>

        <label className="name-entry-label" htmlFor="ne-name">Display Name</label>
        <input
          id="ne-name"
          className="name-entry-input"
          type="text"
          placeholder="Your name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        />

        <button
          type="button"
          className="name-entry-toggle"
          role="switch"
          aria-checked={publicBoard}
          onClick={() => setPublicBoard((v) => !v)}
        >
          <span className="name-entry-toggle-text">
            <strong>Public Leaderboard</strong>
            <span>Your stats will appear on the leaderboard</span>
          </span>
          <span className="name-entry-switch" data-on={publicBoard ? "true" : "false"} aria-hidden>
            <span className="name-entry-knob" />
          </span>
        </button>

        <button
          className="name-entry-btn"
          disabled={!name.trim() || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
