"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function BetaGatePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const inputRef     = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const password = inputRef.current?.value ?? "";
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      const res  = await fetch("/api/beta/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json() as { ok: boolean; error?: string };

      if (!data.ok) {
        setError(data.error ?? "Invalid access code");
        setLoading(false);
        inputRef.current?.select();
        return;
      }

      // Cookie is now set — go to the intended destination or /login
      const next = searchParams.get("next") ?? "/login";
      router.push(next);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-mark">T</span>
        </div>

        <h1 className="login-title">TafsirLab</h1>
        <p className="login-subtitle beta-gate-eyebrow">Private beta access required</p>

        <form className="beta-gate-form" onSubmit={handleSubmit}>
          <label className="beta-gate-label" htmlFor="beta-code">
            Enter access code
          </label>
          <input
            ref={inputRef}
            id="beta-code"
            className="beta-gate-input"
            type="password"
            placeholder="••••••••"
            autoFocus
            autoComplete="off"
            disabled={loading}
          />
          {error && <p className="login-error">{error}</p>}
          <button
            className="beta-gate-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? <span className="login-spinner" /> : null}
            {loading ? "Verifying…" : "Continue →"}
          </button>
        </form>

        <p className="login-footer">
          Tafsir Lab is in private beta. If you have an access code, enter it above.
        </p>
      </div>
    </div>
  );
}
