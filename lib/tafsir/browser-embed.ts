"use client";

/**
 * The main-thread side of browser embedding — a thin client to the worker.
 *
 * This module used to do the work itself, and that shipped the bug the app
 * became known for on this machine: opening Lab AI imported and initialised
 * a 118 MB ONNX model ON the UI thread, and every question ran inference
 * there before its request could be sent. The app froze on open and froze
 * again on ask. All of that now lives in `embed.worker.ts`; what remains
 * here is postMessage plumbing and the ability to say "no".
 *
 * The contract with retrieval is unchanged and deliberate:
 *
 *   embedQuery() returning null is a NORMAL answer. It means "search by
 *   keyword this time" — the model is still warming, the worker failed to
 *   spawn, the network dropped. Nothing upstream waits on it and nothing
 *   breaks; the trace tells the reader what happened.
 *
 * prefetch() warms the model when the panel opens, from an idle callback so
 * even the worker spawn never competes with the opening animation. A reader
 * on a metered or 2g-class connection is not prefetched — 135 MB is a real
 * imposition — but an actual question still warms it via embedQuery, because
 * by then they have asked for it.
 */

/** e5-small's output width; anything else never reaches the server. */
const DIM = 384;
/** How long a question waits for a still-warming model before going keyword. */
const DEFAULT_WAIT_MS = 2_000;

interface Pending {
  resolve: (v: number[] | null) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (workerFailed) return null;
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;

  try {
    worker = new Worker(new URL("./embed.worker.ts", import.meta.url), { type: "module" });
  } catch {
    workerFailed = true;
    return null;
  }

  worker.onmessage = (e: MessageEvent) => {
    const { id, ok, vector } = (e.data ?? {}) as { id?: number; ok?: boolean; vector?: unknown };
    if (typeof id !== "number") return;
    const p = pending.get(id);
    if (!p) return; // timed out earlier — the reply warms the model, nothing more
    pending.delete(id);
    if (p.timer) clearTimeout(p.timer);
    p.resolve(ok ? sane(vector) : null);
  };

  /* A worker that dies takes its replies with it: resolve everything open as
     null (keyword search) rather than leaving asks hanging forever. */
  worker.onerror = () => {
    for (const [, p] of pending) {
      if (p.timer) clearTimeout(p.timer);
      p.resolve(null);
    }
    pending.clear();
    worker?.terminate();
    worker = null;
    workerFailed = true;
  };

  return worker;
}

/** 384 finite numbers or nothing — a malformed vector must not leave here. */
function sane(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== DIM) return null;
  for (const n of v) if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return v as number[];
}

function send(msg: { type: "load" } | { type: "embed"; text: string }, waitMs: number | null): Promise<number[] | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(null);

  return new Promise((resolve) => {
    const id = nextId++;
    const entry: Pending = { resolve, timer: null };
    if (waitMs !== null) {
      entry.timer = setTimeout(() => {
        /* Give up on THIS request — the reader gets keyword search now — but
           the worker keeps loading, so the next question is answered by
           meaning. Deleting the entry makes the late reply a no-op. */
        pending.delete(id);
        resolve(null);
      }, waitMs);
    }
    pending.set(id, entry);
    w.postMessage({ id, ...msg });
  });
}

/**
 * Warm the model without ever standing in the UI's way.
 *
 * Deferred to an idle moment so the worker spawn does not share a frame with
 * the panel's opening animation, and declined on connections where a 135 MB
 * download is impolite. No timeout: the load takes as long as it takes.
 */
export function prefetch(): void {
  if (typeof window === "undefined") return;

  const conn = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (conn?.saveData) return;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;

  const start = () => { void send({ type: "load" }, null); };
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(start);
  } else {
    setTimeout(start, 250);
  }
}

/**
 * A question in, 384 floats out — or null, meaning "keyword search this time".
 *
 * `waitMs` bounds how long the QUESTION waits for a warming model, not the
 * inference itself: once warm, the round trip is tens of milliseconds and the
 * timer never matters. Two seconds is deliberately too short to sit out a
 * cold download — answering now by keyword beats holding the reader's
 * question hostage to a better answer later.
 */
export async function embedQuery(text: string, waitMs = DEFAULT_WAIT_MS): Promise<number[] | null> {
  const q = text.trim();
  if (!q) return null;
  return send({ type: "embed", text: q }, waitMs);
}
