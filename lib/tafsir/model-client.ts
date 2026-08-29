/**
 * Client for the Hugging Face Space that holds the two small models.
 *
 * Everything here is best-effort by design. The Space runs on a free tier and
 * SLEEPS when idle, so the first call after a quiet spell can take thirty
 * seconds to wake it. Neither of these functions is allowed to fail a user's
 * question because of that: `embed` returning null drops retrieval to keyword
 * search, and `translate` returning null shows the Arabic untranslated. Both
 * are worse answers that say so, which is the right failure for this app —
 * unlike a spinner that never resolves, or an error page for a question that
 * could have been half-answered.
 */

const SPACE = process.env.TAFSIR_MODEL_SPACE?.replace(/\/+$/, "");

/** A cold Space needs this long; a warm one answers in well under a second. */
const COLD_MS = 45_000;
const WARM_MS = 12_000;

/** Set once a call succeeds, so later calls do not wait out the cold timeout. */
const state = { warm: false };

export function isConfigured(): boolean {
  return Boolean(SPACE);
}

/**
 * Gradio's HTTP API. `/gradio_api/call/<name>` returns an event id, then the
 * result is read from an SSE stream at the same path. Two round trips is how
 * this API works; it is not a retry.
 */
async function callSpace<T>(fn: string, data: unknown[]): Promise<T | null> {
  if (!SPACE) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), state.warm ? WARM_MS : COLD_MS);

  try {
    const post = await fetch(`${SPACE}/gradio_api/call/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
      signal: controller.signal,
    });
    if (!post.ok) return null;

    const { event_id } = await post.json() as { event_id?: string };
    if (!event_id) return null;

    const stream = await fetch(`${SPACE}/gradio_api/call/${fn}/${event_id}`, {
      signal: controller.signal,
    });
    if (!stream.ok) return null;

    const text = await stream.text();

    /* The SSE body is a sequence of "event:"/"data:" pairs. The last complete
       data line for a "complete" event holds the result; scanning from the end
       avoids picking up a heartbeat or a progress frame. */
    const lines = text.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "null") continue;
      try {
        const parsed = JSON.parse(payload);
        /* eslint-disable-next-line require-atomic-updates --
           The rule is about read-modify-write across an await. This is
           write-only and monotonic: the only value ever assigned is `true`, so
           two concurrent calls cannot disagree and there is nothing to lose to
           interleaving. The worst case if it were racy is one extra request
           waiting the cold timeout. */
        state.warm = true;
        return (Array.isArray(parsed) ? parsed[0] : parsed) as T;
      } catch { /* not the frame we want — keep scanning back */ }
    }
    return null;
  } catch {
    // Abort, DNS failure, Space rebuilding — all the same to the caller.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Embed a question for semantic search.
 *
 * The Space applies the "query: " prefix that e5 requires. Doing it there
 * rather than here keeps the prefix beside the model it belongs to, so it
 * cannot drift out of step with the "passage: " prefix used at index time.
 */
export async function embed(text: string): Promise<number[] | null> {
  const res = await callSpace<{ embedding?: number[]; error?: string }>("embed", [text]);
  if (!res?.embedding?.length) return null;
  // A wrong-sized vector would be rejected by pgvector with an opaque error
  // much later; catching it here keeps the failure legible.
  return res.embedding.length === 384 ? res.embedding : null;
}

export async function translate(text: string): Promise<string | null> {
  const res = await callSpace<{ translation?: string }>("translate", [text]);
  const out = res?.translation?.trim();
  return out ? out : null;
}
