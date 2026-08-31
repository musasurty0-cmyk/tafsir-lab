/**
 * The embedding model's home — a Web Worker, never the main thread.
 *
 * The first version of browser embedding ran everything on the UI thread:
 * opening Lab AI dynamically imported megabytes of transformers.js, compiled
 * the ONNX WASM runtime, and initialised a 118 MB model — precisely while the
 * panel was trying to animate open — and every question then ran model
 * inference before its network request could even be sent. On real hardware
 * that read as "the app freezes when I open the AI", because it did.
 *
 * Everything heavy now happens here. The main thread's only costs are
 * spawning this worker and postMessage.
 *
 * Protocol (all messages carry an `id` the reply echoes):
 *   in : { id, type: "load" }               → { id, ok: true }  when warm
 *   in : { id, type: "embed", text }        → { id, ok: true, vector: number[] }
 *   any failure                             → { id, ok: false, error: string }
 *
 * THE PREFIX IS NOT OPTIONAL. e5 is trained asymmetrically: the corpus was
 * embedded with `passage: ` and a query must carry `query: `. Getting this
 * wrong does not error — it quietly returns worse neighbours forever. It
 * lives here, beside the model, and nowhere else.
 */

/** e5-small's output width. The DB column is halfvec(384). */
const DIM = 384;
/** The ONNX conversion of the same weights the corpus was embedded with. */
const MODEL = "Xenova/multilingual-e5-small";
/** q8 selects the 118 MB quantised build over 470 MB of fp32. */
const DTYPE = "q8";

type Extractor = (
  text: string,
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

let loading: Promise<Extractor> | null = null;

function load(): Promise<Extractor> {
  loading ??= (async () => {
    const tf = await import("@huggingface/transformers");
    /* Everything comes from Hugging Face's CDN; never probe our own origin
       for /models/… . */
    tf.env.allowLocalModels = false;
    const extractor = await tf.pipeline("feature-extraction", MODEL, { dtype: DTYPE });
    return extractor as unknown as Extractor;
  })();
  /* A failed load is retryable: the usual cause is a dropped connection, and
     caching the rejection would disable semantic search until a reload. */
  loading.catch(() => { loading = null; });
  return loading;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, text } = (e.data ?? {}) as { id?: number; type?: string; text?: string };
  if (typeof id !== "number") return;

  try {
    if (type === "load") {
      await load();
      self.postMessage({ id, ok: true });
      return;
    }
    if (type === "embed") {
      if (typeof text !== "string" || !text.trim()) {
        self.postMessage({ id, ok: false, error: "empty text" });
        return;
      }
      const extractor = await load();
      /* mean pooling + L2 normalise: what sentence-transformers did at index
         time, and what cosine distance over the stored vectors assumes. */
      const out = await extractor(`query: ${text.trim()}`, { pooling: "mean", normalize: true });
      const vector = Array.from(out.data, Number);
      if (vector.length !== DIM) {
        self.postMessage({ id, ok: false, error: `wrong width: ${vector.length}` });
        return;
      }
      self.postMessage({ id, ok: true, vector });
      return;
    }
    self.postMessage({ id, ok: false, error: `unknown type: ${String(type)}` });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
