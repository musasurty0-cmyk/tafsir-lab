"use client";

/**
 * The waitlist form. Kept deliberately small: one required field (email), two
 * optional ones. Every extra required field costs signups, and the only thing
 * actually needed to invite someone is their address.
 */
import { useState } from "react";

type State = "idle" | "sending" | "done" | "error";

export default function WaitlistForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [already, setAlready] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, context, source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data?.error || "Something went wrong. Please try again.");
        return;
      }
      setAlready(Boolean(data?.alreadyJoined));
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
          {already ? "You’re already on the list." : "You’re on the list."}
        </h2>
        <p className="wl-done-body">
          We’ll email <strong>{email}</strong> when your place is ready.
          {already ? " No need to sign up again." : ""}
        </p>
      </div>
    );
  }

  return (
    <form className="wl-form" onSubmit={submit} noValidate>
      <label className="wl-label" htmlFor="wl-email">Email address</label>
      <input
        id="wl-email" className="wl-input" type="email" required autoComplete="email"
        inputMode="email" placeholder="you@example.com"
        value={email} onChange={(e) => setEmail(e.target.value)}
      />

      <label className="wl-label" htmlFor="wl-name">Name <span>(optional)</span></label>
      <input
        id="wl-name" className="wl-input" type="text" autoComplete="name"
        placeholder="How should we greet you?"
        value={name} onChange={(e) => setName(e.target.value)}
      />

      <label className="wl-label" htmlFor="wl-ctx">
        How do you study right now? <span>(optional)</span>
      </label>
      <textarea
        id="wl-ctx" className="wl-input wl-textarea" rows={3}
        placeholder="Notes app, PDFs, a notebook…"
        value={context} onChange={(e) => setContext(e.target.value)}
      />

      {state === "error" && <p className="wl-error" role="alert">{message}</p>}

      <button className="wl-submit" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Joining…" : "Join the waitlist"}
      </button>
      <p className="wl-fine">
        One email when it’s ready. No newsletter, and nothing shared with anyone.
      </p>
    </form>
  );
}
