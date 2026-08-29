"use client";

/**
 * SettingsClient — Theme / Account / Plan / Contact.
 *
 * Theme and typography write through lib/appearance so the change lands on
 * every surface at once, not just this page. Account fields save on blur and
 * on Enter with an inline confirmation; there is no Save button that can be
 * left unpressed except for the name, where a mistyped keystroke should not
 * rename you mid-word.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell, { type ShellStreak } from "@/components/AppShell";
import Toast from "@/components/Toast";
import {
  FONT_STEPS, DEFAULT_TYPO, applyAppearance, readTheme, readTypo, writeAppearance,
  type Theme, type FontStep, type Typo,
} from "@/lib/appearance";

interface UserRow {
  name: string; email: string; avatarUrl: string | null;
  publicLeaderboard: boolean; dailyGoal: number;
}

interface Props { user: UserRow | null; streak: ShellStreak }

type Tab = "theme" | "account" | "plan" | "contact";
const TABS: { key: Tab; label: string }[] = [
  { key: "theme",   label: "Theme" },
  { key: "account", label: "Account" },
  { key: "plan",    label: "Plan" },
  { key: "contact", label: "Contact" },
];

export default function SettingsClient({ user, streak }: Props) {
  const [tab, setTab] = useState<Tab>("theme");
  const [toast, setToast] = useState<string | null>(null);

  // ── Appearance ──────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>("light");
  const [typo, setTypo]   = useState<Typo>(DEFAULT_TYPO);
  useEffect(() => { setTheme(readTheme()); setTypo(readTypo()); }, []);

  const pickTheme = useCallback((t: Theme) => {
    setTheme(t); writeAppearance({ theme: t }); applyAppearance(t, readTypo());
  }, []);
  const pickStep = useCallback((which: keyof Typo, step: FontStep) => {
    setTypo((prev) => {
      const next = { ...prev, [which]: step };
      writeAppearance({ typography: next });
      applyAppearance(readTheme(), next);
      return next;
    });
  }, []);

  // ── Account ─────────────────────────────────────────────────────────────
  const [name, setName]   = useState(user?.name ?? "");
  const [pub, setPub]     = useState(user?.publicLeaderboard ?? true);
  const [goal, setGoal]   = useState(user?.dailyGoal ?? 10);
  const [saving, setSaving] = useState(false);

  const patch = useCallback(async (body: Record<string, unknown>, note?: string) => {
    setSaving(true);
    const res = await fetch("/api/me", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { setToast("That didn't save."); return false; }
    if (note) setToast(note);
    return true;
  }, []);

  const dirty = name.trim() !== (user?.name ?? "") && name.trim().length > 0;

  return (
    <AppShell user={user ? { name: user.name, avatarUrl: user.avatarUrl } : null} streak={streak}>
      <div className="an-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key} role="tab" aria-selected={tab === t.key}
            className="an-tab" data-active={tab === t.key ? "true" : "false"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "theme" && (
        <div className="an-pane" key="theme">
          <section className="an-card">
            <h2 className="an-card-title">Appearance</h2>
            <p className="an-muted">Applies everywhere, straight away.</p>
            <div className="settings-seg" role="group" aria-label="Theme">
              {(["light", "dark"] as Theme[]).map((t) => (
                <button
                  key={t} className="settings-seg-btn"
                  data-active={theme === t ? "true" : "false"}
                  onClick={() => pickTheme(t)}
                >
                  {t === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </section>

          <section className="an-card">
            <h2 className="an-card-title">Reading size</h2>
            <div className="set-row">
              <span className="set-row-label">Translation &amp; notes</span>
              <div className="settings-seg" role="group" aria-label="Reading size">
                {FONT_STEPS.map((s) => (
                  <button
                    key={s.id} className="settings-seg-btn"
                    data-active={typo.reading === s.id ? "true" : "false"}
                    onClick={() => pickStep("reading", s.id)}
                  >{s.label}</button>
                ))}
              </div>
            </div>
            <div className="set-row">
              <span className="set-row-label">Arabic</span>
              <div className="settings-seg" role="group" aria-label="Arabic size">
                {FONT_STEPS.map((s) => (
                  <button
                    key={s.id} className="settings-seg-btn"
                    data-active={typo.arabic === s.id ? "true" : "false"}
                    onClick={() => pickStep("arabic", s.id)}
                  >{s.label}</button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === "account" && (
        <div className="an-pane" key="account">
          <section className="an-card">
            <h2 className="an-card-title">Profile</h2>

            <label className="set-label" htmlFor="set-email">Email Address</label>
            <input id="set-email" className="set-input" value={user?.email ?? ""} disabled />
            <p className="an-muted an-footnote">
              Your email comes from the account you signed in with and cannot be changed here.
            </p>

            <label className="set-label" htmlFor="set-name">Display Name</label>
            <div className="set-inline">
              <input
                id="set-name" className="set-input" value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && dirty) patch({ name: name.trim() }, "Name updated."); }}
              />
              <button
                className="an-btn" disabled={!dirty || saving}
                onClick={() => patch({ name: name.trim() }, "Name updated.")}
              >
                {saving ? "…" : "Save"}
              </button>
            </div>
          </section>

          <section className="an-card">
            <h2 className="an-card-title">Study</h2>

            <div className="set-row">
              <span className="set-row-label">
                Daily goal
                <small className="an-muted">Annotations you are aiming for each day</small>
              </span>
              <div className="set-stepper">
                <button
                  aria-label="Lower goal"
                  onClick={() => { const n = Math.max(1, goal - 1); setGoal(n); patch({ dailyGoal: n }); }}
                >−</button>
                <span>{goal}</span>
                <button
                  aria-label="Raise goal"
                  onClick={() => { const n = Math.min(200, goal + 1); setGoal(n); patch({ dailyGoal: n }); }}
                >+</button>
              </div>
            </div>

            <div className="set-row">
              <span className="set-row-label">
                Public leaderboard
                <small className="an-muted">Your totals appear in the global ranking</small>
              </span>
              <button
                type="button" role="switch" aria-checked={pub}
                className="name-entry-switch" data-on={pub ? "true" : "false"}
                onClick={() => { const n = !pub; setPub(n); patch({ publicLeaderboard: n }); }}
              >
                <span className="name-entry-knob" />
              </button>
            </div>
          </section>

          <section className="an-card">
            <h2 className="an-card-title">Your data</h2>
            <p className="an-muted">
              Every annotation you have written, as a Markdown file you can keep.
            </p>
            <a className="an-btn an-btn--ghost" href="/api/analytics/export" download>
              Export annotations
            </a>
          </section>
        </div>
      )}

      {tab === "plan" && (
        <div className="an-pane" key="plan">
          <section className="an-card">
            <h2 className="an-card-title">Your plan</h2>
            <p className="set-plan-name">Beta</p>
            <p className="an-muted">
              Everything in Tafsir Lab is open during the beta — every notebook, every
              mushaf, unlimited annotations, and collaboration with as many people as
              you like. There is nothing to pay and nothing locked.
            </p>
            <p className="an-muted an-footnote">
              When paid plans arrive we will tell you well before anything changes, and
              what you have written stays yours either way — see Export above.
            </p>
          </section>
        </div>
      )}

      {tab === "contact" && (
        <div className="an-pane" key="contact">
          <section className="an-card">
            <h2 className="an-card-title">Get in touch</h2>
            <p className="an-muted">
              Bugs, ideas, or something that reads wrong in the tafsīr — all welcome.
            </p>
            <Link className="an-btn" href="/contact">Open the contact form →</Link>
          </section>
        </div>
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} autoDismissMs={3000} />
    </AppShell>
  );
}
