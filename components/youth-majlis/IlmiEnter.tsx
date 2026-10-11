"use client";

/**
 * "Enter ʿIlmī". If this device has already given the ʿIlmī password it simply
 * goes in; otherwise a sheet rises asking for it, on the page you are already
 * on, and on the right password carries straight through. Escape, the close
 * button or a tap outside put it away.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function IlmiEnter({ unlocked }: { unlocked: boolean }) {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", onKey);
    return () => { clearTimeout(t); removeEventListener("keydown", onKey); };
  }, [open]);

  function enter() {
    if (unlocked) { router.push("/youth-majlis/ilmi"); return; }
    setValue(""); setError(null); setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true); setError(null);
    const r = await fetch("/api/youth-majlis/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: "ilmi", password: value }),
    }).catch(() => null);
    if (r?.ok) { router.push("/youth-majlis/ilmi"); return; }
    const d = await r?.json().catch(() => null) as { error?: string } | null;
    setError(d?.error ?? "Couldn’t reach the server. Check your connection.");
    setBusy(false);
    input.current?.select();
  }

  return (
    <>
      <button type="button" className="y-btn y-btn--light" onClick={enter}>Enter ʿIlmī</button>
      {open && (
        <div className="y-sheet" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="y-sheet-card" role="dialog" aria-modal="true" aria-labelledby="y-sheet-h">
            <button type="button" className="y-sheet-x" onClick={() => setOpen(false)} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <span className="y-gate-book" aria-hidden />
            <h2 id="y-sheet-h" className="y-sheet-h">ʿIlmī.</h2>
            <p className="y-sheet-sub">Enter the ʿIlmī password to continue.</p>
            <form onSubmit={submit} className="y-field" data-error={error ? "" : undefined}>
              <label htmlFor="y-ilmi-pass" className="y-sr">ʿIlmī password</label>
              <input
                ref={input}
                id="y-ilmi-pass"
                type="password"
                autoComplete="off"
                autoCapitalize="none"
                placeholder="Password"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(null); }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "y-ilmi-err" : undefined}
              />
              <button type="submit" disabled={busy || !value.trim()} aria-label={busy ? "Checking" : "Enter"}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>
            <p id="y-ilmi-err" className="y-gate-err" role="alert">{error ?? ""}</p>
          </div>
        </div>
      )}
    </>
  );
}
