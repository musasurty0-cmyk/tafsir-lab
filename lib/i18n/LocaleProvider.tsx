"use client";

/**
 * LocaleProvider — app-wide UI language.
 *
 * Locale is stored in localStorage ("tl-locale") and applied on the client
 * (no locale routes). RTL locales (ar, ur) flip document direction, except
 * for surfaces that manage their own direction (canvas, Mushaf) which are
 * pinned via CSS guards in globals.css.
 *
 * useT() returns t(key, vars?) with en fallback for missing keys.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DICTIONARIES, LOCALES, isRtl, type Locale } from "./dictionaries";

const LS_KEY = "tl-locale";

interface Ctx {
  locale:    Locale;
  setLocale: (l: Locale) => void;
  t:         (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleCtx = createContext<Ctx>({
  locale: "en",
  setLocale: () => {},
  t: (k) => DICTIONARIES.en[k] ?? k,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Hydrate from storage (client only — SSR renders en, then swaps; UI
  // strings only, so the flash is imperceptible).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY) as Locale | null;
      if (stored && DICTIONARIES[stored]) setLocaleState(stored);
    } catch { /* ignore */ }
  }, []);

  // Apply lang + direction to <html>.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir  = isRtl(locale) ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(LS_KEY, l); } catch { /* ignore */ }
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let s = DICTIONARIES[locale][key] ?? DICTIONARIES.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }, [locale]);

  return (
    <LocaleCtx.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleCtx.Provider>
  );
}

export function useLocale(): Ctx {
  return useContext(LocaleCtx);
}

export function useT() {
  return useContext(LocaleCtx).t;
}

/** Compact language picker (globe + native names). Drop in anywhere. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale();
  return (
    <label className={`lang-switcher${compact ? " lang-switcher--compact" : ""}`} title="Language">
      <span aria-hidden>🌐</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label="Interface language"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </label>
  );
}
