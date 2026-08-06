"use client";

/**
 * The closed-beta application form.
 *
 * Deliberately longer than the waitlist form, which exists to cost as little
 * as possible. This one is an application: the answers decide who gets a
 * place, so asking properly is the point rather than friction to minimise.
 * Age is the only optional field — it is useful for shaping the cohort but
 * never a reason to turn someone away.
 */
import { useState } from "react";
import { STUDY_BUCKETS, AGE_MIN, AGE_MAX } from "@/lib/beta";

type State = "idle" | "sending" | "done" | "error";

export default function BetaRequestForm({ source }: { source: string }) {
  const [email, setEmail]           = useState("");
  const [name, setName]             = useState("");
  const [age, setAge]               = useState("");
  const [studyDaily, setStudyDaily] = useState("");
  const [studyTools, setStudyTools] = useState("");
  const [benefit, setBenefit]       = useState("");
  const [state, setState]           = useState<State>("idle");
  const [message, setMessage]       = useState("");
  const [already, setAlready]       = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;   // a second Enter must not send twice
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/beta/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, age, studyDaily, studyTools, benefit, source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data?.error || "Something went wrong. Please try again.");
        return;
      }
      setAlready(Boolean(data?.alreadyApplied));
      setState("done");
    } catch {
      setState("error");
      setMessage("Couldn’t reach the server. Please check your connection.");
    }
  }

  if (state === "done") {
    return (
      <div className="wl-done" role="status">
        <div className="wl-tick" aria-hidden>
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path d="M6 13.4l4.6 4.6L20 8.6" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="wl-done-title">
          {already ? "Your request is updated." : "Request received."}
        </h2>
        <p className="wl-done-body">
          {already
            ? <>We already had an application from <strong>{email}</strong>, so we’ve kept your newest answers.</>
            : <>We’ll read it properly and reply to <strong>{email}</strong>. Places are limited, so it may take a little while.</>}
        </p>
      </div>
    );
  }

  const busy = state === "sending";

  return (
    <form className="wl-form" onSubmit={submit} noValidate>
      {/* Name and age share a row: age is a three-character field and looks
          stranded on a line of its own. */}
      <div className="br-row">
        <div className="br-col">
          <label className="wl-label" htmlFor="br-name">Your name</label>
          <input
            id="br-name" className="wl-input" type="text" required autoComplete="name"
            placeholder="How should we greet you?" disabled={busy}
            value={name} onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="br-col br-col--age">
          <label className="wl-label" htmlFor="br-age">Age <span>(optional)</span></label>
          <input
            id="br-age" className="wl-input" type="number" inputMode="numeric"
            min={AGE_MIN} max={AGE_MAX} placeholder="—" disabled={busy}
            value={age} onChange={(e) => setAge(e.target.value)}
          />
        </div>
      </div>

      <label className="wl-label" htmlFor="br-email">Email address</label>
      <input
        id="br-email" className="wl-input" type="email" required autoComplete="email"
        inputMode="email" placeholder="you@example.com" disabled={busy}
        value={email} onChange={(e) => setEmail(e.target.value)}
      />

      <label className="wl-label" htmlFor="br-daily">
        How much do you study the Qur’an on a normal day?
      </label>
      <select
        id="br-daily" className="wl-input br-select" required disabled={busy}
        value={studyDaily} onChange={(e) => setStudyDaily(e.target.value)}
      >
        <option value="" disabled>Choose one…</option>
        {STUDY_BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>

      <label className="wl-label" htmlFor="br-tools">
        What do you study with at the moment?
      </label>
      <textarea
        id="br-tools" className="wl-input wl-textarea" rows={3} required disabled={busy}
        placeholder="A Mushaf, an app, PDFs, a notebook, tafsir volumes…"
        value={studyTools} onChange={(e) => setStudyTools(e.target.value)}
      />

      <label className="wl-label" htmlFor="br-benefit">
        How would TafsirLab help you?
      </label>
      <textarea
        id="br-benefit" className="wl-input wl-textarea" rows={4} required disabled={busy}
        placeholder="What’s hard about how you study now, and what would you want this to change?"
        value={benefit} onChange={(e) => setBenefit(e.target.value)}
      />

      {state === "error" && <p className="wl-error" role="alert">{message}</p>}

      <button className="wl-submit" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Request a place"}
      </button>
      <p className="wl-fine">
        We read every one. Your answers go to us and nowhere else.
      </p>
    </form>
  );
}
