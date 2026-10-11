"use client";

/**
 * A value the portal remembers for the student, shared live between every
 * component that reads the same key — tick a question in the explorer and the
 * journey tile's ring fills in the same frame.
 *
 * Kept in two places:
 *   • this browser's localStorage, so the page is instant and works offline;
 *   • the student's TafsirLab account, when they are signed in, so it follows
 *     them from phone to laptop.
 *
 * Every value carries the moment it changed (ym:at:<key>), and the two copies
 * are merged key by key on the newer one — the server does the same — so
 * edits on two devices never wipe each other and an untick beats an old tick.
 * Not signed in: it simply stays on the device, and the page says which.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

const EVENT = "ym-store";
const PREFIX = "ym:";
const AT = "ym:at:";
const PUSH_DELAY = 700;

export type SyncStatus = "starting" | "synced" | "saving" | "local" | "offline";
type Entry = { v: unknown; at: number };

// ── localStorage, guarded: it can be unavailable ──
function get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function put(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* unavailable */ } }
const localAt = (key: string) => Number(get(AT + key) ?? 0);
function writeLocal(key: string, v: unknown, at: number) {
  put(PREFIX + key, JSON.stringify(v));
  put(AT + key, String(at));
}
function localEntries(): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX) || k.startsWith(AT)) continue;
      const key = k.slice(PREFIX.length);
      const raw = get(k);
      if (raw == null) continue;
      // A value saved before timestamps existed counts as the oldest there is:
      // it is pushed if the account has nothing, and loses to anything else.
      try { out[key] = { v: JSON.parse(raw), at: localAt(key) || 1 }; } catch { /* skip */ }
    }
  } catch { /* unavailable */ }
  return out;
}

// ── Sync, one per page ──
let status: SyncStatus = "starting";
let started = false;
let pending: Record<string, Entry> = {};
let timer: ReturnType<typeof setTimeout> | null = null;
const statusListeners = new Set<() => void>();
function setStatus(s: SyncStatus) { status = s; statusListeners.forEach((l) => l()); }
const notify = () => window.dispatchEvent(new Event(EVENT));

/** Take anything from the account that is newer than what this device has. */
function absorb(entries: Record<string, Entry>) {
  let any = false;
  for (const [key, e] of Object.entries(entries)) {
    if (e && typeof e.at === "number" && e.at > localAt(key)) { writeLocal(key, e.v, e.at); any = true; }
  }
  if (any) notify();
}

async function send(entries: Record<string, Entry>) {
  if (status === "local") return;
  setStatus("saving");
  try {
    const r = await fetch("/api/youth-majlis/progress", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries }),
    });
    if (r.status === 401) { setStatus("local"); return; }
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json() as { entries?: Record<string, Entry> };
    if (d.entries) absorb(d.entries);
    setStatus(Object.keys(pending).length ? "saving" : "synced");
  } catch {
    // Keep them for the next attempt rather than dropping them.
    pending = { ...entries, ...pending };
    setStatus("offline");
  }
}

function schedulePush() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; const p = pending; pending = {}; if (Object.keys(p).length) void send(p); }, PUSH_DELAY);
}

async function start() {
  if (started) return;
  started = true;
  try {
    const r = await fetch("/api/youth-majlis/progress");
    const d = await r.json() as { signedIn?: boolean; entries?: Record<string, Entry> };
    if (!d.signedIn) { setStatus("local"); return; }
    const server = d.entries ?? {};
    absorb(server);
    // Send up whatever this device has that the account does not.
    const ahead: Record<string, Entry> = {};
    for (const [key, e] of Object.entries(localEntries())) {
      if (!server[key] || e.at > server[key].at) ahead[key] = e;
    }
    if (Object.keys(ahead).length) await send(ahead); else setStatus("synced");
  } catch {
    setStatus("offline");
  }
}

// ── Hooks ──
function subscribe(cb: () => void) {
  const on = () => cb();
  window.addEventListener(EVENT, on);
  window.addEventListener("storage", on);   // another tab
  return () => { window.removeEventListener(EVENT, on); window.removeEventListener("storage", on); };
}

export function useLocal<T>(key: string, fallback: T): [T, (v: T) => void] {
  useEffect(() => { void start(); }, []);
  const raw = useSyncExternalStore(subscribe, () => get(PREFIX + key), () => null);
  let value = fallback;
  if (raw != null) { try { value = JSON.parse(raw) as T; } catch { /* keep fallback */ } }

  const set = useCallback((v: T) => {
    const at = Date.now();
    writeLocal(key, v, at);
    notify();
    if (status !== "local") { pending[key] = { v, at }; schedulePush(); }
  }, [key]);

  return [value, set];
}

/** Where the student's progress is being kept right now. */
export function useSyncStatus(): SyncStatus {
  useEffect(() => { void start(); }, []);
  return useSyncExternalStore(
    (cb) => { statusListeners.add(cb); return () => { statusListeners.delete(cb); }; },
    () => status,
    () => "starting" as SyncStatus,
  );
}

/** A short line saying where progress is saved, for under the controls. */
export function syncLine(s: SyncStatus): string {
  switch (s) {
    case "synced":  return "Synced to your TafsirLab account";
    case "saving":  return "Saving to your TafsirLab account…";
    case "offline": return "Saved on this device. Will sync when you’re back online";
    case "local":   return "Saved on this device. Sign in to TafsirLab to sync it";
    default:        return "";
  }
}

/** Questions explored for one module, as a list of question numbers. */
export const exploredKey = (moduleN: number) => `explored:${moduleN}`;
