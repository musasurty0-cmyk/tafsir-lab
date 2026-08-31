/**
 * Turning an answer into something on the board.
 *
 * Lab AI can already write into the notebook. The board is a different offer:
 * a mindmap is not prose with headings, it is a shape you can push around, so
 * what goes onto the whiteboard has to arrive as the board's own furniture —
 * one text container per idea and a drawn connector between them — rather
 * than as a picture of a mindmap, which could be looked at and never edited.
 *
 * Nothing here is new storage. A node is the same `StructuredNote` a person
 * makes by double-clicking the board, and a connector is the same `arrow`
 * stroke the pen draws. That is deliberate: the moment it lands it is
 * ordinary board content — movable, editable, erasable, and syncing through
 * the paths that already work — and if this feature were deleted tomorrow the
 * mindmaps people made with it would keep working.
 *
 * This module is pure. It decides the shape and the geometry, and knows
 * nothing about the network, so the layout can be tested on its own.
 */

import type { InkStroke, Pt } from "@/lib/ink";

/** What the model is asked to produce: a tree of short labels. */
export interface MindNode {
  label: string;
  children?: MindNode[];
}

export interface PlacedNode {
  /** Stable within one layout — used to match connectors to their ends. */
  key: string;
  label: string;
  depth: number;
  /** Top-left in board world-space. */
  x: number;
  y: number;
  w: number;
  /** Estimated, because the real box auto-sizes to its text; used only to
   *  stack siblings and to aim the connectors. */
  h: number;
  parent: string | null;
}

export interface MindmapLayout {
  nodes: PlacedNode[];
  /** Parent key → child key. */
  edges: { from: string; to: string }[];
  /** Bounding box, so the caller can centre the viewport on the result. */
  bounds: { x: number; y: number; w: number; h: number };
}

/* Geometry. Widths taper with depth: the root is the headline, the leaves are
   phrases, and a uniform width made a three-word leaf look like a paragraph. */
const WIDTH_BY_DEPTH = [300, 240, 210];
const H_GAP = 96;          // between one column and the next
const V_GAP = 22;          // between stacked siblings
const LINE_H = 22;         // a line of text in a box
const BOX_PAD = 26;        // the container's own padding, top+bottom
/** Roughly how many characters fit on a line at a given width. */
const CHARS_PER_PX = 1 / 8.1;

export const MINDMAP_MAX_NODES = 40;
export const MINDMAP_MAX_DEPTH = 3;

const widthAt = (depth: number) =>
  WIDTH_BY_DEPTH[Math.min(depth, WIDTH_BY_DEPTH.length - 1)];

/** Height a container will take once it has wrapped its label. */
function estimateHeight(label: string, w: number): number {
  const perLine = Math.max(8, Math.floor((w - 28) * CHARS_PER_PX));
  const lines = Math.max(1, Math.ceil(label.length / perLine));
  return lines * LINE_H + BOX_PAD;
}

/**
 * Trim the model's tree to something a board can hold.
 *
 * A mindmap with sixty nodes is a wall, not a map, and the model will happily
 * produce one. Depth and breadth are capped here rather than trusted to the
 * prompt, because a prompt is a request and this is a guarantee.
 */
export function pruneTree(root: MindNode): MindNode {
  let budget = MINDMAP_MAX_NODES;
  const walk = (n: MindNode, depth: number): MindNode => {
    budget -= 1;
    const label = n.label.trim().replace(/\s+/g, " ").slice(0, 120);
    if (depth >= MINDMAP_MAX_DEPTH || !n.children?.length || budget <= 0) {
      return { label };
    }
    const kids: MindNode[] = [];
    for (const c of n.children) {
      if (budget <= 0) break;
      if (!c?.label?.trim()) continue;
      kids.push(walk(c, depth + 1));
    }
    return kids.length ? { label, children: kids } : { label };
  };
  return walk(root, 0);
}

/**
 * Place the tree left-to-right, parents centred on their children.
 *
 * A tidy-tree pass in the only two directions that matter: leaves are stacked
 * in reading order down the y-axis, and every parent is then centred against
 * the block its subtree occupies. Laying out left-to-right rather than
 * radially is what keeps the labels horizontal — a radial map looks better in
 * a screenshot and is worse to read and to edit, and this one is meant to be
 * edited.
 */
export function layoutMindmap(root: MindNode, originX = 0, originY = 0): MindmapLayout {
  const nodes: PlacedNode[] = [];
  const edges: { from: string; to: string }[] = [];
  let cursorY = 0;
  let seq = 0;

  /** Returns the vertical centre of the placed subtree. */
  const place = (n: MindNode, depth: number, parent: string | null): number => {
    const key = `n${seq++}`;
    const w = widthAt(depth);
    const h = estimateHeight(n.label, w);
    const x = originX + depth * (widthAt(Math.max(0, depth - 1)) + H_GAP);

    if (!n.children?.length) {
      const y = originY + cursorY;
      cursorY += h + V_GAP;
      nodes.push({ key, label: n.label, depth, x, y, w, h, parent });
      if (parent) edges.push({ from: parent, to: key });
      return y + h / 2;
    }

    const centres = n.children.map((c) => place(c, depth + 1, key));
    const mid = (centres[0] + centres[centres.length - 1]) / 2;
    const y = mid - h / 2;
    nodes.push({ key, label: n.label, depth, x, y, w, h, parent });
    if (parent) edges.push({ from: parent, to: key });
    return mid;
  };

  place(root, 0, null);

  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const x1 = Math.max(...nodes.map((n) => n.x + n.w));
  const y1 = Math.max(...nodes.map((n) => n.y + n.h));
  return { nodes, edges, bounds: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}

/** A node's text, as the container's TipTap document. */
export function nodeToTiptap(node: PlacedNode): object {
  return {
    type: "doc",
    content: [{
      type: "paragraph",
      content: [{
        type: "text",
        text: node.label,
        /* The root is the claim the map is about; bolding it is the whole
           visual hierarchy this needs, since the boxes are already sized by
           depth. */
        ...(node.depth === 0 ? { marks: [{ type: "bold" }] } : {}),
      }],
    }],
  };
}

/** Board colours by depth. Null is the board's default (no tint). */
export function colorForDepth(depth: number): string | null {
  return depth === 0 ? "amber" : depth === 1 ? "sky" : null;
}

/**
 * The connector between two boxes, as an ordinary arrow stroke.
 *
 * Drawn as a shallow S from the right edge of the parent to the left edge of
 * the child: a straight line between two boxes on different rows cuts through
 * whatever sits between them, where a curve reads as a link and stays out of
 * the way. The points are sampled densely enough that the ink engine's own
 * smoothing has something to work with.
 */
export function connectorStroke(
  from: PlacedNode, to: PlacedNode, color: string, id: string,
): InkStroke {
  const x0 = from.x + from.w, y0 = from.y + from.h / 2;
  const x1 = to.x,            y1 = to.y + to.h / 2;
  const dx = x1 - x0;
  const points: Pt[] = [];
  const STEPS = 14;
  for (let s = 0; s <= STEPS; s++) {
    const t = s / STEPS;
    /* Cubic Bézier with both handles pushed horizontally, so the curve leaves
       the parent and meets the child flat — an arrow that arrives at an angle
       reads as pointing past the box rather than at it. */
    const c = 1 - t;
    const hx = Math.max(28, dx * 0.45);
    const bx = c * c * c * x0 + 3 * c * c * t * (x0 + hx) + 3 * c * t * t * (x1 - hx) + t * t * t * x1;
    const by = c * c * c * y0 + 3 * c * c * t * y0 + 3 * c * t * t * y1 + t * t * t * y1;
    points.push([Math.round(bx), Math.round(by), 0.5]);
  }
  return {
    id,
    tool: "arrow",
    points,
    color,
    width: 2,
    opacity: 1,
    mushafPage: 0,          // the whiteboard's sentinel page
    surface: "canvas",
  };
}
