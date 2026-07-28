"use client";

/**
 * SettingsMenu — the dashboard cog.
 *
 * Collects the settings that are not per-page decisions: who you are,
 * how the app looks, what language it speaks. These used to be scattered —
 * language sat in the workspace top banner (where it had nothing to do with
 * the page being edited) and theme was buried in the per-page Tweaks panel.
 *
 * Nothing here is invented. Theme reads and writes the SAME "tl-tweaks" key
 * the workspace already honours, so changing it here and opening a page agree
 * with each other. Language delegates to the existing locale provider, and
 * the tutorial control drives the existing tour state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LOCALES, type Locale } from "@/lib/i18n/dictionaries";
import { setTour } from "@/lib/tour";

interface UserInfo { name: string; avatarUrl: string | null }

const TWEAKS_KEY = "tl-tweaks";
type Theme = "light" | "dark";

/** Read the theme out of the shared tweaks blob without disturbing the rest. */
function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const raw = localStorage.getItem(TWEAKS_KEY);
    const t = raw ? (JSON.parse(raw) as { theme?: Theme }).theme : undefined;
    return t === "dark" ? "dark" : "light";
  } catch { return "light"; }
}

/** Merge the theme back in, preserving every other tweak already stored. */
function writeTheme(theme: Theme) {
  try {
    const raw = localStorage.getItem(TWEAKS_KEY);
    const prev = raw ? JSON.parse(raw) : {};
    localStorage.setItem(TWEAKS_KEY, JSON.stringify({ ...prev, theme }));
  } catch { /* storage unavailable — the attribute below still applies */ }
  // Applied at the document root so it covers the dashboard too, not only the
  // workspace view that already bound data-theme to its own subtree.
  document.documentElement.setAttribute("data-theme", theme);
}

const CogIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.2.6.77 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default function SettingsMenu({
  user, onSignOut,
}: { user: UserInfo | null; onSignOut: () => void }) {
  const [open,  setOpen]  = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const { locale, setLocale } = useLocale();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Reflect the stored theme on mount and keep the document in sync with it,
  // so a reload does not land on light while storage says dark.
  useEffect(() => {
    const t = readTheme();
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  // Dismiss on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickTheme = useCallback((t: Theme) => { setTheme(t); writeTheme(t); }, []);

  const restartTutorial = useCallback(() => {
    // Step 0 is the intro; it creates the tutorial workspace when the user
    // chooses to continue, so restarting here creates nothing on its own.
    setTour({ active: true, step: 0 });
    setOpen(false);
  }, []);

  const initials = user?.name
    ? user.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="settings-wrap" ref={wrapRef}>
      <button
        className="settings-cog"
        data-open={open ? "true" : "false"}
        onClick={() => setOpen(o => !o)}
        title="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CogIcon />
      </button>

      {open && (
        <div className="settings-panel" role="menu">

          {/* ── Profile ── */}
          <div className="settings-profile">
            <div className="settings-avatar">
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt="" />
                : <span>{initials}</span>}
            </div>
            <div className="settings-profile-text">
              <div className="settings-profile-name">{user?.name ?? "Signed in"}</div>
              <div className="settings-profile-sub">Account</div>
            </div>
          </div>

          <div className="settings-sep" />

          {/* ── Appearance ── */}
          <div className="settings-group">
            <div className="settings-label">Appearance</div>
            <div className="settings-seg" role="group" aria-label="Theme">
              {(["light", "dark"] as const).map(t => (
                <button
                  key={t}
                  className="settings-seg-btn"
                  data-active={theme === t ? "true" : "false"}
                  onClick={() => pickTheme(t)}
                >
                  {t === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Language ── */}
          <div className="settings-group">
            <div className="settings-label">Language</div>
            <select
              className="settings-select"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              aria-label="Interface language"
            >
              {LOCALES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="settings-sep" />

          {/* ── Tutorial + account ── */}
          <button className="settings-item" onClick={restartTutorial} role="menuitem">
            Restart tutorial
          </button>
          <button
            className="settings-item settings-item--danger"
            onClick={onSignOut}
            role="menuitem"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
