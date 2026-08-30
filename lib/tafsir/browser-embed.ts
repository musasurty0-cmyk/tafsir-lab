"use client";

/**
 * Embedding the reader's question, in the reader's browser.
 *
 * The corpus side of semantic search is done: 90,092 passages carry vectors
 * from `intfloat/multilingual-e5-small`. Searching them needs the QUESTION put
 * through the same model, and that half used to live on a Hugging Face Space —
 * until Hugging Face began requiring a paid plan to create one.
 *
 * So it runs here instead. The model is small enough: 118 MB of quantised ONNX
 * plus a 17 MB tokenizer, fetched once from Hugging Face's CDN and cached by
 * the browser thereafter. After that a query embeds in tens of milliseconds
 * locally, with no server, no cold start and no bill.
 *
 * Two things make that download acceptable rather than rude:
 *
 *   It is never on the critical path. Retrieval already treats the embedding
 *   as best-effort — `embed` returning null drops the search to keyword
 *   matching, which works and says so in the trace. So the model can arrive
 *   whenever it arrives; the first question is answered by keyword and the
 *   ones after it are answered by meaning. Nothing waits, nothing spins.
 *
 *   It is not downloaded for people who never ask anything. `prefetch()` runs
 *   when the assistant is opened, not when the app boots, and it declines on a
 *   metered or very slow connection. `warmUp()` — the one an actual question
 *   calls — ignores that, because by then the reader has asked for it.
 *
 * THE PREFIX IS NOT OPTIONAL. e5 is trained asymmetrically: the corpus was
 * embedded with `passage: ` and a query must carry `query: `. Getting this
 * wrong does not error, it quietly returns worse neighbours — which reads as
 * "the search is a bit rubbish" for months rather than as a bug. It is applied
 * in `embedQuery` and should stay in exactly one place.
 */

/** e5-small's output width. The column is `halfvec(384)`; anything else is a bug. */
const DIM = 384;

/** The ONNX conversion of the same weights the corpus was embedded with. */
const MODEL = "Xenova/multilingual-e5-small";

/** `q8` selects model_quantized.onnx — 118 MB against 470 MB for fp32. */
const DTYPE = "q8";

export type EmbedState = "idle" | "loading" | "ready" | "unavailable";

export interface EmbedStatus {
  state: EmbedState;
  /** 0–1 while loading. Aggregated across files, so it is not monotonic. */
  progress: number;
  /** Set only when `state` is "unavailable", and safe to show a reader. */
  reason: string;
}

/* A single cached object rather than a fresh one per read: useSyncExternalStore
   compares snapshots by identity and will loop forever if this allocates. */
let status: EmbedStatus = { state: "idle", progress: 0, reason: "" };
const listeners = new Set<() => void>();

function set(next: Partial<EmbedStatus>): void {
  const merged = { ...status, ...next };
  if (
    merged.state === status.state &&
    merged.reason === status.reason &&
    Math.abs(merged.progress - status.progress) < 0.01
  ) return;
  status = merged;
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getStatus(): EmbedStatus {
  return status;
}

/** The server snapshot for useSyncExternalStore — never loading, never ready. */
const SERVER_STATUS: EmbedStatus = { state: "idle", progress: 0, reason: "" };
export function getServerStatus(): EmbedStatus {
  return SERVER_STATUS;
}

type Extractor = (
  text: string,
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

let loading: Promise<Extractor | null> | null = null;

/**
 * Load the model, once. Concurrent callers share the same promise, and a
 * failed load is remembered rather than retried on every keystroke.
 */
export function warmUp(): Promise<Extractor | null> {
  if (loading) return loading;

  loading = (async (): Promise<Extractor | null> => {
    if (typeof window === "undefined") return null;

    try {
      set({ state: "loading", progress: 0, reason: "" });

      /* Imported here, not at module scope, for two reasons: the package is
         several megabytes of JavaScript that nobody who skips the assistant
         should pay for, and its Node build pulls onnxruntime-node, which has
         no business being resolved during a server render. */
      const tf = await import("@huggingface/transformers");

      /* Already false in a browser and in a web worker, so this changes
         nothing today. It is here as a statement of intent: everything is
         fetched from Hugging Face, and nothing should ever start probing our
         own origin for /models/... if this module is later used somewhere the
         default does not hold. */
      tf.env.allowLocalModels = false;

      const extractor = await tf.pipeline("feature-extraction", MODEL, {
        dtype: DTYPE,
        progress_callback: (p: { status?: string; progress?: number }) => {
          if (p?.status === "progress" && typeof p.progress === "number") {
            set({ progress: Math.max(0, Math.min(1, p.progress / 100)) });
          }
        },
      });

      set({ state: "ready", progress: 1 });
      return extractor as unknown as Extractor;
    } catch (err) {
      /* Offline, blocked by an extension, out of storage quota, CDN down.
         All the same to the caller: search stays on keywords. */
      set({
        state: "unavailable",
        progress: 0,
        reason: err instanceof Error && err.message
          ? err.message.slice(0, 200)
          : "the model could not be loaded",
      });
      return null;
    }
  })();

  return loading;
}

/**
 * Start loading if the connection looks willing. Called when the assistant is
 * opened, so the model is often ready by the time a question is finished.
 *
 * Declines on Save-Data or a 2g-class connection: 135 MB is a real imposition
 * on a metered phone, and someone who then asks a question gets it anyway via
 * `warmUp`, which does not consult this.
 */
export function prefetch(): void {
  if (typeof navigator === "undefined") return;
  if (loading) return;

  const conn = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;

  if (conn?.saveData) return;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;

  void warmUp();
}

/**
 * A question in, 384 floats out — or null, which is a normal answer here and
 * means "search with keywords instead".
 *
 * `timeoutMs` bounds the wait for the MODEL, not for the embedding. Once the
 * model is loaded this resolves in tens of milliseconds and the timeout never
 * comes into it; while it is still downloading, the default is deliberately
 * far too short to wait one out. That is the point. Holding a reader's first
 * question for half a minute to answer it slightly better is a worse trade
 * than answering it now by keyword and having the model ready for the second.
 */
export async function embedQuery(
  text: string,
  timeoutMs = 2_000,
): Promise<number[] | null> {
  const q = text.trim();
  if (!q) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const extractor = await Promise.race([
    warmUp(),
    new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
  ]);
  if (timer) clearTimeout(timer);
  if (!extractor) return null;

  try {
    /* mean pooling + L2 normalise: what sentence-transformers does for e5, and
       therefore what the stored vectors were produced with. Cosine distance
       assumes it. */
    const out = await extractor(`query: ${q}`, { pooling: "mean", normalize: true });
    const vec = Array.from(out.data, Number);

    /* A wrong-width or non-finite vector would be rejected by pgvector as an
       opaque error much later, or silently poison the ranking. Drop it here
       and let keyword search answer. */
    if (vec.length !== DIM) return null;
    if (!vec.every(Number.isFinite)) return null;
    return vec;
  } catch {
    return null;
  }
}
