"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DunyaGate() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw.trim() || busy) return;
    setBusy(true);
    const r = await fetch("/api/dunya/unlock", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    }).catch(() => null);
    if (r?.ok) { router.refresh(); return; }
    const d = r ? await r.json().catch(() => null) as { error?: string } | null : null;
    setErr(d?.error ?? "Couldn’t reach TafsirLab. Check your connection.");
    setBusy(false);
  }

  return (
    <main className="dn-gate">
      <span className="dn-mark dn-mark-lg" aria-hidden="true">T</span>
      <h1>Dunya.</h1>
      <p className="dn-gate-sub">Your A levels, paper by paper.</p>
      <form className="dn-field" onSubmit={submit} data-error={err ? "" : undefined}>
        <label htmlFor="dn-pw" className="dn-sr">Password</label>
        <input
          id="dn-pw" type="password" autoComplete="current-password" autoCapitalize="none" placeholder="Password" autoFocus
          value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }}
        />
        <button type="submit" aria-label="Enter" disabled={!pw.trim() || busy}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
      <p className="dn-gate-err" role="alert">{err}</p>
      <p className="dn-gate-foot">Tafsir Lab</p>
    </main>
  );
}
