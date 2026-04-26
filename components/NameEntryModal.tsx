"use client";

/**
 * NameEntryModal — first-run name entry overlay.
 *
 * Shown on first visit (when "tl-user-name" is absent from localStorage).
 * Stores the name locally and also patches the server user record so notes
 * and drawings show the correct name.
 *
 * Dismissed permanently once a name is saved.
 */

import { useEffect, useState } from "react";

export default function NameEntryModal() {
  const [show,   setShow]   = useState(false);
  const [name,   setName]   = useState("");
  const [saving, setSaving] = useState(false);

  // Check localStorage after hydration (avoids SSR mismatch)
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
        body:    JSON.stringify({ name: trimmed }),
      });
    } catch {
      /* Network error is fine — name is stored locally regardless */
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
        <div className="name-entry-logo">TL</div>
        <h1 className="name-entry-title">Welcome to TafsirLab</h1>
        <p className="name-entry-subtitle">Enter your name to get started</p>
        <input
          className="name-entry-input"
          type="text"
          placeholder="Your name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        />
        <button
          className="name-entry-btn"
          disabled={!name.trim() || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Get started →"}
        </button>
      </div>
    </div>
  );
}
