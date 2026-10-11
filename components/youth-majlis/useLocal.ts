"use client";

/**
 * A value kept in this browser's localStorage, shared live between every
 * component that reads the same key — mark a question explored in the
 * explorer and the journey tile's ring fills in the same frame.
 *
 * Deliberately device-local: these are a student's own progress ticks and
 * private reflections, and "only you can see this" is easiest to promise when
 * it never leaves the device. Storage can be unavailable (private windows,
 * blocked site data), so every read and write is guarded and the page works
 * without it.
 */

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "ym-store";
const PREFIX = "ym:";

function read(key: string): string | null {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}

function subscribe(cb: () => void) {
  const on = () => cb();
  window.addEventListener(EVENT, on);
  window.addEventListener("storage", on);   // another tab
  return () => { window.removeEventListener(EVENT, on); window.removeEventListener("storage", on); };
}

export function useLocal<T>(key: string, fallback: T): [T, (v: T) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  let value = fallback;
  if (raw != null) { try { value = JSON.parse(raw) as T; } catch { /* keep fallback */ } }

  const set = useCallback((v: T) => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(v)); } catch { /* unavailable */ }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);

  return [value, set];
}

/** Questions explored for one module, as a list of question numbers. */
export const exploredKey = (moduleN: number) => `explored:${moduleN}`;
