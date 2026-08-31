"use client";

/**
 * A picture of the board, for something that can see.
 *
 * Rendered from the stored strokes rather than grabbed from the on-screen
 * canvas, for two reasons. The board need not be open — you can ask what you
 * wrote while reading the editor — and the visible canvas is a viewport: it
 * holds whatever is currently panned into view at whatever zoom, which is the
 * wrong thing to hand a transcriber. This draws every stroke at a scale of
 * its own choosing, cropped to the ink itself.
 *
 * It paints through `lib/ink`'s own `paintStroke`, so what the model reads is
 * what the reader sees — the same smoothing, the same widths, the same arrow
 * heads. A second renderer that merely resembled the first would drift, and
 * the drift would show up as mysterious misreadings.
 */

import { paintStroke, type InkStroke } from "@/lib/ink";

/** Whiteboard ink lives on this sentinel page (the real Mushaf starts at 1). */
const WB_PAGE = 0;
/** Longest edge of the rendered image. Enough for a transcriber, small
 *  enough to post: a 4000px board becomes megabytes of base64 for no gain. */
const MAX_EDGE = 1600;
/** Breathing room around the ink, in world units. */
const PAD = 40;
/** Ink is drawn dark on white regardless of the reader's theme — a
 *  transcriber has no preference, and white paper is what these models have
 *  overwhelmingly seen handwriting on. */
const PAPER = "#ffffff";

export interface BoardSnapshot {
  /** Bare base64 (no data: prefix) — what the vision API wants. */
  base64: string;
  strokeCount: number;
  width: number;
  height: number;
}

/** Every stroke on the whiteboard surface, mine and other people's. */
export async function loadBoardStrokes(pageId: string): Promise<InkStroke[]> {
  const res = await fetch(`/api/pages/${pageId}/drawings`).catch(() => null);
  if (!res?.ok) return [];
  const data = await res.json().catch(() => null) as {
    myStrokes?: unknown[];
    otherLayers?: { strokes?: unknown[] }[];
  } | null;
  if (!data) return [];

  const all = [
    ...(data.myStrokes ?? []),
    ...(data.otherLayers ?? []).flatMap((l) => l.strokes ?? []),
  ] as InkStroke[];

  /* The whiteboard's own ink only: Mushaf annotations and editor-surface
     strokes live in the same store and would be transcribed as if they were
     part of the board. */
  return all.filter((s) =>
    s && Array.isArray(s.points) && s.points.length > 1
    && (s.surface ?? "canvas") === "canvas"
    && (s.mushafPage ?? 0) === WB_PAGE
    && !s.anchor);
}

/** The box the ink occupies, in world space. */
function inkBounds(strokes: InkStroke[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) {
    for (const p of s.points as unknown as number[][]) {
      const x = Number(p[0]), y = Number(p[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (!Number.isFinite(x0)) return null;
  return { x0: x0 - PAD, y0: y0 - PAD, x1: x1 + PAD, y1: y1 + PAD };
}

/**
 * Render the board's handwriting to a PNG.
 *
 * Returns null when there is nothing written — the caller says so rather than
 * sending a blank page to be transcribed.
 */
export async function snapshotBoard(pageId: string): Promise<BoardSnapshot | null> {
  const strokes = await loadBoardStrokes(pageId);
  if (!strokes.length) return null;

  const b = inkBounds(strokes);
  if (!b) return null;

  const worldW = Math.max(1, b.x1 - b.x0);
  const worldH = Math.max(1, b.y1 - b.y0);
  const scale = Math.min(1, MAX_EDGE / Math.max(worldW, worldH));
  const w = Math.max(1, Math.round(worldW * scale));
  const h = Math.max(1, Math.round(worldH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-b.x0, -b.y0);
  /* Painted in the order they were drawn, so later ink covers earlier ink
     exactly as it does on the board. */
  for (const s of strokes) {
    try { paintStroke(ctx, s); } catch { /* one bad stroke must not lose the rest */ }
  }
  ctx.restore();

  const url = canvas.toDataURL("image/png");
  const comma = url.indexOf(",");
  if (comma === -1) return null;
  return { base64: url.slice(comma + 1), strokeCount: strokes.length, width: w, height: h };
}
