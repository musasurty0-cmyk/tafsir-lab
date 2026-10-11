/**
 * Youth Majlis progress, stored against the student's TafsirLab account.
 *
 * A small key-value document. Every entry carries the moment it was last
 * changed, and two copies are merged key by key, keeping whichever is newer:
 * a reflection written on a phone and a question ticked on a laptop both
 * survive, and un-ticking something wins over the older tick.
 *
 * Only known keys are accepted, with bounded values, so this cannot become a
 * general-purpose store for whatever a client sends.
 */

export type Entry = { v: unknown; at: number };
export type Entries = Record<string, Entry>;

const MAX_REFLECTION = 20_000;

/** Is this a key the portal writes, holding a value of the right shape? */
export function validEntry(key: string, e: unknown): e is Entry {
  if (!e || typeof e !== "object") return false;
  const { v, at } = e as Entry;
  if (typeof at !== "number" || !Number.isFinite(at) || at <= 0) return false;
  if (/^explored:[1-9]\d?$/.test(key)) {
    return Array.isArray(v) && v.length <= 10 && v.every((n) => Number.isInteger(n) && n >= 1 && n <= 10);
  }
  if (/^reflect:[1-9]\d?:\d$/.test(key)) {
    return typeof v === "string" && v.length <= MAX_REFLECTION;
  }
  if (key === "read") {
    return Array.isArray(v) && v.length <= 40 && v.every((t) => typeof t === "string" && t.length <= 300);
  }
  return false;
}

/** Merge `incoming` into `base`, newest `at` winning per key. */
export function merge(base: Entries, incoming: Entries): { merged: Entries; changed: boolean } {
  const merged: Entries = { ...base };
  let changed = false;
  for (const [k, e] of Object.entries(incoming)) {
    if (!validEntry(k, e)) continue;
    if (!merged[k] || e.at > merged[k].at) { merged[k] = { v: e.v, at: e.at }; changed = true; }
  }
  return { merged, changed };
}

/** Whatever is stored, read defensively. */
export function asEntries(raw: unknown): Entries {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Entries = {};
  for (const [k, e] of Object.entries(raw as Record<string, unknown>)) if (validEntry(k, e)) out[k] = e;
  return out;
}
