/**
 * Rate limiting — two layers, because this runs on serverless.
 *
 * `memoryLimit` is a per-instance sliding window. It is CHEAP and instant but
 * NOT authoritative on Vercel: each cold start is a fresh instance with an
 * empty map, and concurrent instances don't share state. It exists to shed
 * obvious floods hitting one warm instance, nothing more.
 *
 * For anything that must actually hold — creating rows, sending mail — pair it
 * with a durable check against the database (see the demo route counting
 * recent demo users). The memory layer trims the common case; the DB layer is
 * the real ceiling.
 */

type Hit = number[];
const buckets = new Map<string, Hit>();

/**
 * Returns true if `key` is UNDER the limit (request allowed), false if it has
 * hit `max` within `windowMs`. Best-effort, per-instance — see the file note.
 */
export function memoryLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  // Opportunistic sweep so the map can't grow without bound on a long-lived
  // instance: drop any bucket whose newest hit is older than the window.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.length || v[v.length - 1] <= cutoff) buckets.delete(k);
    }
  }
  return true;
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
