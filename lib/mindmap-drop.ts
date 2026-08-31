"use client";

/**
 * Putting a generated mindmap onto the page's whiteboard.
 *
 * The layout in `lib/mindmap` is pure; this is the half that talks to the
 * server. It is deliberately independent of whether the board is on screen:
 * the notes endpoint creates containers and the drawings endpoint MERGES
 * strokes by id, so a map asked for while reading the editor lands on the
 * board and is simply there when you next open it. Requiring the board to be
 * mounted would have meant either refusing the request or yanking the reader
 * into another view to satisfy an implementation detail.
 *
 * Placement rule: never on top of existing work. The map is dropped below
 * whatever is already on the board, which is predictable, needs no collision
 * search, and leaves earlier maps intact when you ask for a second one.
 */

import {
  layoutMindmap, pruneTree, nodeToTiptap, colorForDepth, connectorStroke,
  type MindNode, type MindmapLayout,
} from "@/lib/mindmap";
import type { InkStroke } from "@/lib/ink";

/** Just enough of a board container to stay out of its way. */
export interface PlacedBox { offsetX: number; offsetY: number; width: number; height: number | null }

/** Gap between existing work and the new map. */
const DROP_GAP = 120;
/** Assumed height for a container that has not measured itself yet. */
const ASSUMED_H = 120;

export interface MindmapDrop {
  layout: MindmapLayout;
  /** Board containers, in the shape the notes endpoint returns. */
  notes: unknown[];
  strokes: InkStroke[];
  /** Where the map landed, for centring the viewport on it. */
  focus: { x: number; y: number; w: number; h: number };
}

/** Below everything already on the board, at its left edge. */
export function dropOrigin(existing: PlacedBox[]): { x: number; y: number } {
  const boxes = existing.filter((b) => Number.isFinite(b.offsetX) && Number.isFinite(b.offsetY));
  if (!boxes.length) return { x: 80, y: 80 };
  const bottom = Math.max(...boxes.map((b) => b.offsetY + (b.height ?? ASSUMED_H)));
  const left = Math.min(...boxes.map((b) => b.offsetX));
  return { x: Math.round(left), y: Math.round(bottom + DROP_GAP) };
}

/**
 * Ask for the tree, lay it out, and create it on the board.
 *
 * Nodes are created one at a time rather than in a batch: there is no bulk
 * endpoint, and inventing one for this would have put a second way of making
 * a note into the codebase. A node that fails to save is skipped and its
 * connectors dropped with it, so a partial map is still a valid board rather
 * than a set of arrows pointing at nothing.
 */
export async function dropMindmap(opts: {
  pageId: string;
  text: string;
  subject?: string;
  existing: PlacedBox[];
  inkColor: string;
  signal?: AbortSignal;
}): Promise<MindmapDrop | null> {
  const { pageId, text, subject, existing, inkColor, signal } = opts;

  const res = await fetch("/api/assistant/mindmap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, subject }),
    signal,
  }).catch(() => null);
  if (!res?.ok) return null;

  const data = await res.json().catch(() => null) as { tree?: MindNode } | null;
  if (!data?.tree?.label) return null;

  const origin = dropOrigin(existing);
  const layout = layoutMindmap(pruneTree(data.tree), origin.x, origin.y);

  /* Create the containers. The server's row is what the board renders, so the
     created note is kept rather than the local guess. */
  const created = new Map<string, unknown>();
  const placedKeys = new Set<string>();
  for (const node of layout.nodes) {
    const body = {
      noteType: "textbox",
      anchorType: "whiteboard",
      content: nodeToTiptap(node),
      offsetX: Math.round(node.x),
      offsetY: Math.round(node.y),
      width: node.w,
      color: colorForDepth(node.depth),
    };
    const r = await fetch(`/api/pages/${pageId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }).catch(() => null);
    if (!r?.ok) continue;
    const d = await r.json().catch(() => null) as { note?: unknown } | null;
    if (d?.note) { created.set(node.key, d.note); placedKeys.add(node.key); }
  }
  if (!created.size) return null;

  /* Connectors, but only between two boxes that actually exist. */
  const byKey = new Map(layout.nodes.map((n) => [n.key, n]));
  const strokes: InkStroke[] = [];
  for (const e of layout.edges) {
    if (!placedKeys.has(e.from) || !placedKeys.has(e.to)) continue;
    const a = byKey.get(e.from), b = byKey.get(e.to);
    if (a && b) strokes.push(connectorStroke(a, b, inkColor, crypto.randomUUID()));
  }

  if (strokes.length) {
    /* Merged by id server-side, so sending only the new arrows preserves
       every stroke already on the board — including ones this client has
       never seen. */
    await fetch(`/api/pages/${pageId}/drawings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strokes, surface: "canvas" }),
      signal,
    }).catch(() => null);
  }

  return {
    layout,
    notes: [...created.values()],
    strokes,
    focus: layout.bounds,
  };
}
