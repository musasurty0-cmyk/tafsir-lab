"use client";

/**
 * The password gate for the Youth Majlis portal and its ʿIlmī section. The
 * check happens on the server (see lib/youth-majlis/gate.ts); on success the
 * page refreshes and the server renders what is behind the gate.
 *
 * One field with its submit arrow inside it, the way a sign-in sheet is built
 * on Apple's own sites — no card, no outline, nothing else to look at.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Gate({
  area, title, subtitle, mark,
}: {
  area: "majlis" | "ilmi";
  title: string;
  subtitle: string;
  mark?: React.ReactNode;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true); setError(null);
    const r = await fetch("/api/youth-majlis/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, password: value }),
    }).catch(() => null);
    if (r?.ok) { router.refresh(); return; }
    const d = await r?.json().catch(() => null) as { error?: string } | null;
    setError(d?.error ?? "Couldn’t reach the server. Check your connection.");
    setBusy(false);
  }

  return (
    <main className="y-gate">
      {mark}
      <h1 className="y-gate-h">{title}</h1>
      <p className="y-gate-sub">{subtitle}</p>
      <form onSubmit={submit} className="y-field" data-error={error ? "" : undefined}>
        <label htmlFor="y-pass" className="y-sr">Password</label>
        <input
          id="y-pass"
          type="password"
          autoComplete="current-password"
          autoCapitalize="none"
          placeholder="Password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "y-pass-err" : undefined}
          autoFocus
        />
        <button type="submit" disabled={busy || !value.trim()} aria-label={busy ? "Checking" : "Enter"}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
      <p id="y-pass-err" className="y-gate-err" role="alert">{error ?? ""}</p>
      <p className="y-gate-foot">Under the guidance of Shaykh Omid Azizi. Powered by TafsirLab.</p>
    </main>
  );
}
