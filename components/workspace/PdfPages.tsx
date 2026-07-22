"use client";

/**
 * PdfPages — renders a PDF as a vertical stack of page images in world space,
 * meant to sit BEHIND the whiteboard's ink + note containers so a student can
 * annotate directly ON the pages (like the Mushaf).
 *
 * Uses MuPDF (WASM) to rasterise pages — it's fast (~10-40ms/page) and robust
 * on complex/Arabic PDFs, where pdf.js's renderer hung indefinitely. Pages
 * render lazily (eager for the first few, then on-demand as they scroll into
 * view) so a 200-page book doesn't rasterise everything up front.
 *
 * `src` is a static URL (library book) or an ArrayBuffer (uploaded PDF loaded
 * from IndexedDB).
 */

import { useEffect, useRef, useState } from "react";

type Mupdf = typeof import("mupdf");
// Load + instantiate the MuPDF WASM once for the whole app. mupdf.js hands the
// Emscripten module `globalThis["$libmupdf_wasm_Module"]` as its config, so we
// set a locateFile there to fetch the .wasm from /public/mupdf (the bundler's
// default `new URL("mupdf-wasm.wasm", import.meta.url)` points at the hashed
// chunk dir, where the binary isn't served).
let mupdfMod: Promise<Mupdf> | null = null;
function loadMupdf(): Promise<Mupdf> {
  if (!mupdfMod) {
    (globalThis as unknown as { $libmupdf_wasm_Module?: unknown }).$libmupdf_wasm_Module = {
      locateFile: (path: string) => `/mupdf/${path}`,
    };
    mupdfMod = import("mupdf");
  }
  return mupdfMod;
}

interface Props {
  src:        string | ArrayBuffer;
  /** World-space width of each page (height derives from the page ratio). */
  pageWidth?: number;
}

const OVERSAMPLE = 2;   // rasterise at 2× so zoom-in stays sharp
const GAP        = 28;  // vertical gap between pages (world px)

interface MuDoc { countPages(): number; loadPage(n: number): MuPage; }
interface MuPage {
  getBounds(): [number, number, number, number];
  toPixmap(m: unknown, cs: unknown, alpha: boolean): { asPNG(): Uint8Array };
}

type HostEl = HTMLDivElement & { __done?: boolean };

export default function PdfPages({ src, pageWidth = 900 }: Props) {
  const [dims, setDims]   = useState<{ w: number; h: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const docRef    = useRef<MuDoc | null>(null);
  const mupdfRef  = useRef<Mupdf | null>(null);
  const pageRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const urlsRef   = useRef<string[]>([]);
  // Raster queue — rasterising runs on the MAIN thread (10-45ms/page), so we
  // process one page at a time and never while the user is mid-stroke: a
  // raster during a pen stroke starves pointermove sampling → jagged ink.
  const queueRef   = useRef<number[]>([]);
  const queuedRef  = useRef<Set<number>>(new Set());
  const pumpingRef = useRef(false);
  const lastBusyRef = useRef(0);

  // Any held-button pointer activity (pen stroke, mouse drag, finger pan)
  // marks the canvas "busy" — rasters wait for a quiet moment.
  useEffect(() => {
    const busy = (e: PointerEvent) => { if (e.buttons & 1) lastBusyRef.current = Date.now(); };
    window.addEventListener("pointerdown", busy, { capture: true, passive: true });
    window.addEventListener("pointermove", busy, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", busy, { capture: true } as EventListenerOptions);
      window.removeEventListener("pointermove", busy, { capture: true } as EventListenerOptions);
    };
  }, []);

  // ── Load the document + measure every page (fast; no rasterising) ────────
  // Note: we intentionally DON'T abort mid-flight on cleanup — React StrictMode
  // (and HMR) mount→unmount→mount, and the shared MuPDF import means the resolve
  // fires once for all awaiters; bailing on the first cleanup left `dims` empty
  // forever. `alive` only guards the final setState.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mupdf = await loadMupdf();
        mupdfRef.current = mupdf;
        const buf = typeof src === "string"
          ? await (await fetch(src)).arrayBuffer()
          : src;
        const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf") as unknown as MuDoc;
        docRef.current = doc;

        const n = doc.countPages();
        const ds: { w: number; h: number }[] = [];
        for (let i = 0; i < n; i++) {
          const b = doc.loadPage(i).getBounds();
          const wPt = b[2] - b[0], hPt = b[3] - b[1];
          ds.push({ w: pageWidth, h: Math.max(60, Math.round((hPt / wPt) * pageWidth)) });
        }
        if (alive) setDims(ds);
      } catch (e) {
        if (alive) setError(String(e));
      }
    })();
    return () => { alive = false; };
  }, [src, pageWidth]);

  // Revoke object URLs only when the component truly unmounts.
  useEffect(() => () => {
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    urlsRef.current = [];
  }, []);

  // ── Eagerly render the opening pages (don't depend on IntersectionObserver,
  //    which is throttled in background tabs) ──────────────────────────────
  useEffect(() => {
    if (!dims.length) return;
    for (let i = 0; i < Math.min(3, dims.length); i++) enqueueRender(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims]);

  // ── Lazily rasterise the rest as they scroll/pan into view ───────────────
  useEffect(() => {
    if (!dims.length) return;
    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) enqueueRender(Number((e.target as HTMLElement).dataset.page)); },
      { rootMargin: "800px 0px" },
    );
    for (const el of pageRefs.current) if (el) io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims]);

  // ── Unload rasters far off-screen ────────────────────────────────────────
  // 46 pages × ~1800×2550 RGBA ≈ 800MB decoded — iPads buckle (jank, blank
  // layers). Pages keep their raster inside a generous margin and fall back
  // to the skeleton beyond it; re-entry re-rasterises in one quiet frame.
  // The margin is 3× the load margin so writing near an edge never thrashes.
  useEffect(() => {
    if (!dims.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) continue;
          const host = e.target as HostEl;
          const idx = Number(host.dataset.page);
          // Not rendered yet: just drop any pending queue entry.
          if (!host.__done) { dequeue(idx); continue; }
          const img = host.querySelector("img");
          host.replaceChildren();
          host.classList.add("pdf-page--skeleton");
          host.__done = false;
          if (img?.src) {
            URL.revokeObjectURL(img.src);
            const i = urlsRef.current.indexOf(img.src);
            if (i >= 0) urlsRef.current.splice(i, 1);
          }
        }
      },
      { rootMargin: "2400px 0px" },
    );
    for (const el of pageRefs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [dims]);

  function dequeue(idx: number) {
    if (!queuedRef.current.delete(idx)) return;
    const qi = queueRef.current.indexOf(idx);
    if (qi >= 0) queueRef.current.splice(qi, 1);
  }

  function enqueueRender(idx: number) {
    const host = pageRefs.current[idx] as HostEl | null;
    if (!host || host.__done || queuedRef.current.has(idx)) return;
    queuedRef.current.add(idx);
    queueRef.current.push(idx);
    pump();
  }

  // Drain the queue one page per tick, only while the pointer is quiet.
  function pump() {
    if (pumpingRef.current) return;
    pumpingRef.current = true;
    const step = () => {
      if (!queueRef.current.length) { pumpingRef.current = false; return; }
      if (Date.now() - lastBusyRef.current < 250) { setTimeout(step, 250); return; }
      const idx = queueRef.current.shift()!;
      queuedRef.current.delete(idx);
      renderPage(idx);
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }

  function renderPage(idx: number) {
    const host = pageRefs.current[idx] as HostEl | null;
    const doc = docRef.current, mupdf = mupdfRef.current;
    if (!host || !doc || !mupdf || host.__done) return;
    host.__done = true;
    try {
      const page = doc.loadPage(idx);
      const b = page.getBounds();
      const scale = (pageWidth / (b[2] - b[0])) * OVERSAMPLE;
      const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false);
      const url = URL.createObjectURL(new Blob([pix.asPNG() as BlobPart], { type: "image/png" }));
      urlsRef.current.push(url);
      const img = document.createElement("img");
      img.src = url; img.alt = "";
      img.style.width = "100%"; img.style.height = "100%"; img.style.display = "block";
      host.replaceChildren(img);
      host.classList.remove("pdf-page--skeleton"); // page is real now
    } catch {
      host.__done = false; // allow a retry
    }
  }

  if (error) {
    return (
      <div className="pdf-pages-error">
        Couldn’t open this PDF.
        <span className="pdf-pages-error-detail">{error}</span>
      </div>
    );
  }

  return (
    <div className="pdf-pages" aria-busy={dims.length === 0}>
      {dims.map((d, i) => (
        <div
          key={i}
          ref={(el) => { pageRefs.current[i] = el; }}
          data-page={i}
          className="pdf-page pdf-page--skeleton"
          style={{ width: d.w, height: d.h, marginBottom: GAP }}
        />
      ))}
      {/* Measuring the document: show shimmering skeleton pages so the space
          reads as "a book is coming", not a blank canvas. */}
      {dims.length === 0 &&
        [0, 1, 2].map((i) => (
          <div
            key={`sk-${i}`}
            className="pdf-page pdf-page--skeleton"
            style={{ width: pageWidth, height: Math.round(pageWidth * 1.35), marginBottom: GAP }}
          />
        ))}
    </div>
  );
}
