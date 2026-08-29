"use client";

/**
 * StudyWithAI — the assistant entry point.
 *
 * The assistant is not wired to a model yet. This is a real, honest UI for that
 * state rather than a button that does nothing: it opens, it explains exactly
 * what it will do once a provider is configured, and it takes your question so
 * the shape of the feature is testable. What it never does is pretend to
 * answer — a fabricated reply about a verse would be worse than no feature at
 * all.
 *
 * When a provider is configured, `ask()` is the only function that changes.
 */

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, ChevronRight } from "lucide-react";

const EXAMPLES = [
  "What is the context of revelation for 2:255?",
  "Find my notes about patience",
  "Plan a week studying Sūrat al-Kahf",
  "Summarise what al-Ṭabarī says on 7:143",
];

export default function StudyWithAI() {
  const [open, setOpen]   = useState(false);
  const [q, setQ]         = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus after paint, and close on Escape like every other overlay here.
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open]);

  function ask() {
    const text = q.trim();
    if (!text) return;
    setAsked(text);
    setQ("");
  }

  return (
    <>
      <button className="ai-banner" onClick={() => setOpen(true)}>
        <span className="ai-banner-icon" aria-hidden><Sparkles size={19} /></span>
        <span className="ai-banner-text">
          <strong>Study with AI</strong>
          <span>Ask about any verse, search your notes, plan your study, or turn a lecture into notes.</span>
        </span>
        <ChevronRight size={18} aria-hidden className="ai-banner-chev" />
      </button>

      {open && (
        <div className="ai-overlay" role="dialog" aria-modal="true" aria-label="Study with AI"
             onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="ai-panel">
            <header className="ai-panel-head">
              <h2><Sparkles size={18} aria-hidden /> Study with AI</h2>
              <button onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            </header>

            <div className="ai-panel-body">
              <div className="ai-status">
                <strong>Not connected yet</strong>
                <p>
                  The assistant is built but has no model behind it on this deployment,
                  so it cannot answer. Rather than invent a reply about a verse, it says so.
                </p>
              </div>

              {asked && (
                <div className="ai-asked">
                  <span className="ai-asked-label">You asked</span>
                  <p>{asked}</p>
                  <p className="ai-asked-note">
                    Held, not answered. Once a provider is configured this is the question
                    it will run.
                  </p>
                </div>
              )}

              <p className="an-muted">What it will do:</p>
              <ul className="ai-caps">
                <li>Answer questions about a verse, citing the tafsīr it drew on</li>
                <li>Search across every note you have written</li>
                <li>Draft a study plan for a sūrah or a date range</li>
                <li>Turn a recorded lecture into timestamped notes</li>
              </ul>

              <div className="ai-examples">
                {EXAMPLES.map((e) => (
                  <button key={e} className="ai-example" onClick={() => setQ(e)}>{e}</button>
                ))}
              </div>
            </div>

            <footer className="ai-panel-foot">
              <input
                ref={inputRef}
                className="ai-input"
                placeholder="Ask about a verse, or search your notes…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
              />
              <button className="an-btn" onClick={ask} disabled={!q.trim()}>Ask</button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
