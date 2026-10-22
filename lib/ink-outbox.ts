/**
 * The ink outbox: strokes the server hasn't confirmed yet, kept in this
 * browser's storage so a tab closed before its save landed loses nothing.
 * The canvas (DrawingCanvas) and the editor overlay (EditorInkLayer) each
 * keep their own, per page; reopening the page shows the ink at once and
 * sends it again. Re-sending is harmless: the server merges by stroke id.
 */

export type InkSurface = "canvas" | "editor";

export interface InkOutbox<S> {
  at: number;
  strokes: S[];
  deleted: string[];
}

/** An outbox older than this is stale (a device left for weeks): drop it rather than resurrect old ink. */
const MAX_AGE = 1000 * 60 * 60 * 24 * 21;

export const inkOutboxKey = (pageId: string, surface: InkSurface) => `tl-ink-outbox:${pageId}:${surface}`;

export function readInkOutbox<S extends { id: string }>(pageId: string, surface: InkSurface): InkOutbox<S> | null {
  try {
    const raw = localStorage.getItem(inkOutboxKey(pageId, surface));
    if (!raw) return null;
    const ob = JSON.parse(raw) as Partial<InkOutbox<S>>;
    if (!ob || typeof ob.at !== "number" || Date.now() - ob.at > MAX_AGE) {
      localStorage.removeItem(inkOutboxKey(pageId, surface));
      return null;
    }
    const strokes = Array.isArray(ob.strokes) ? ob.strokes.filter((s) => s && typeof s.id === "string") : [];
    const deleted = Array.isArray(ob.deleted) ? ob.deleted.filter((x) => typeof x === "string") : [];
    return strokes.length || deleted.length ? { at: ob.at, strokes, deleted } : null;
  } catch {
    return null;
  }
}

export function writeInkOutbox<S>(pageId: string, surface: InkSurface, strokes: S[], deleted: string[]): void {
  try {
    const key = inkOutboxKey(pageId, surface);
    if (!strokes.length && !deleted.length) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ at: Date.now(), strokes, deleted }));
  } catch { /* storage full or unavailable: the network save still runs */ }
}
