"use client";

/**
 * The password gate for the Youth Majlis portal and its ʿIlmī section. The
 * check happens on the server (see lib/youth-majlis/gate.ts); on success the
 * page is simply reloaded, and the server renders what is behind the gate.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Gate({
  area, eyebrow, title, subtitle, children,
}: {
  area: "majlis" | "ilmi";
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
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
    setError(d?.error ?? "Couldn’t reach the server — check your connection.");
    setBusy(false);
  }

  return (
    <main className="ym-gate">
      <div className="ym-gate-card">
        {children}
        <p className="ym-eyebrow">{eyebrow}</p>
        <h1 className="ym-gate-title">{title}</h1>
        <p className="ym-gate-sub">{subtitle}</p>
        <form onSubmit={submit} className="ym-gate-form">
          <label htmlFor="ym-pass" className="ym-sr">Password</label>
          <input
            id="ym-pass"
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            placeholder="Password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "ym-pass-err" : undefined}
            autoFocus
          />
          <button type="submit" className="ym-btn ym-btn--primary" disabled={busy || !value.trim()}>
            {busy ? "Checking…" : "Enter"}
          </button>
        </form>
        <p id="ym-pass-err" className="ym-gate-error" role="alert">{error ?? ""}</p>
      </div>
      <p className="ym-gate-foot">Under the guidance of Shaykh Omid Azizi · Powered by TafsirLab</p>
    </main>
  );
}
