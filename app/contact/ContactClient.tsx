"use client";

/**
 * ContactClient — the feedback form.
 *
 * The success state is honest about delivery. If the mail transport is not
 * configured the server says `delivered: false`, and this shows the team's
 * address rather than a thank-you for a message that went nowhere.
 */

import { useState } from "react";
import { Bug, Lightbulb, BookOpen, MessageSquare } from "lucide-react";
import AppShell, { type ShellStreak } from "@/components/AppShell";
import type { SidebarUser } from "@/components/AppSidebar";

interface Props { user: SidebarUser | null; email: string; streak: ShellStreak }

const KINDS = [
  { key: "bug",     label: "Something is broken", Icon: Bug },
  { key: "idea",    label: "I have an idea",      Icon: Lightbulb },
  { key: "content", label: "Content correction",  Icon: BookOpen },
  { key: "other",   label: "Something else",      Icon: MessageSquare },
] as const;

type Kind = typeof KINDS[number]["key"];
type State = { phase: "form" } | { phase: "sent"; delivered: boolean } | { phase: "error"; message: string };

export default function ContactClient({ user, email, streak }: Props) {
  const [kind, setKind]       = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [state, setState]     = useState<State>({ phase: "form" });
  const [sending, setSending] = useState(false);

  async function send() {
    if (sending || message.trim().length < 4) return;
    setSending(true);
    const res = await fetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, message: message.trim() }),
    }).catch(() => null);
    setSending(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => null) as { error?: string } | null;
      setState({ phase: "error", message: d?.error ?? "That didn't send. Please try again." });
      return;
    }
    const d = await res.json().catch(() => null) as { delivered?: boolean } | null;
    setState({ phase: "sent", delivered: d?.delivered !== false });
  }

  return (
    <AppShell user={user} streak={streak}>
      <section className="an-card">
        <h2 className="an-card-title">Contact us</h2>

        {state.phase === "sent" ? (
          <div className="an-empty">
            <p className="an-empty-title">
              {state.delivered ? "Message sent" : "Saved, but not emailed"}
            </p>
            <p className="an-muted">
              {state.delivered
                ? <>Thank you — we read every one, and we will reply to {email || "your account address"}.</>
                : <>Our mail is not configured right now, so this did not reach the team.
                    Please send it to <a className="an-link" href="mailto:hello@tafsirlab.com">hello@tafsirlab.com</a> instead.</>}
            </p>
            <button className="an-btn" onClick={() => { setMessage(""); setState({ phase: "form" }); }}>
              Write another
            </button>
          </div>
        ) : (
          <>
            <p className="an-muted">
              Replies go to {email || "the address on your account"}.
            </p>

            <div className="ct-kinds" role="radiogroup" aria-label="What is this about?">
              {KINDS.map(({ key, label, Icon }) => (
                <button
                  key={key} role="radio" aria-checked={kind === key}
                  className="ct-kind" data-active={kind === key ? "true" : "false"}
                  onClick={() => setKind(key)}
                >
                  <Icon size={18} aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            <label className="set-label" htmlFor="ct-msg">Your message</label>
            <textarea
              id="ct-msg" className="ct-textarea" rows={8} value={message}
              maxLength={5000}
              placeholder={kind === "bug"
                ? "What did you do, and what happened instead?"
                : kind === "content"
                  ? "Which verse or tafsīr, and what should it say?"
                  : "Tell us as much or as little as you like."}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="ct-foot">
              <span className="an-muted">{message.length}/5000</span>
              <button className="an-btn" disabled={sending || message.trim().length < 4} onClick={send}>
                {sending ? "Sending…" : "Send"}
              </button>
            </div>

            {state.phase === "error" && <p className="ct-error">{state.message}</p>}
          </>
        )}
      </section>
    </AppShell>
  );
}
