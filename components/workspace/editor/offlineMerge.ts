/**
 * What a page edited offline becomes once its live room is reachable again.
 *
 * The live document is a Yjs CRDT, and two copies merge cleanly only if they
 * share history. A copy made while the realtime server could not be reached
 * shares none: it was built from the saved snapshot, item by item, by this
 * client alone. Merging it into the room by Yjs would put the whole document
 * in twice. So an offline copy is reconciled by content instead, against the
 * snapshot it started from (the BASE):
 *
 *   nothing typed offline             → the room, as it is
 *   the room unchanged since the base → the offline copy, as it is
 *   both changed                      → the room, then every block written
 *                                       offline that is in neither the base
 *                                       nor the room, at the end
 *
 * The last case keeps everything rather than guessing: an edited paragraph
 * shows up twice (old in place, new at the end), and nothing is lost.
 *
 * The base travels with the snapshot as `offline` (a marker beside `type` and
 * `content`, which every reader of tiptapContent ignores), so the merge still
 * happens if the tab is closed before the server comes back: whoever next
 * opens the page with a live room does it, and the save that follows drops
 * the marker. Running it twice is harmless, because the second time the room
 * already holds every offline block.
 */

import type { Schema, Node as PMNode } from "@tiptap/pm/model";

export interface OfflineMarker {
  /** Hash of the normalised base document. */
  doc:    string;
  /** Hash of each top-level block of the base. */
  blocks: string[];
}

type DocJSON = { type: "doc"; content?: unknown[]; offline?: OfflineMarker } & Record<string, unknown>;

/** cyrb53: a fast 53-bit string hash. Collisions are not a security issue here. */
function hash(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** The marker a snapshot carries, if it was saved from an offline copy. */
export function markerOf(content: unknown): OfflineMarker | null {
  const m = (content as DocJSON | null)?.offline;
  return m && typeof m.doc === "string" && Array.isArray(m.blocks) ? m : null;
}

/** The document without its marker: what the editor should show. */
export function withoutMarker(content: unknown): unknown {
  if (!content || typeof content !== "object" || !("offline" in content)) return content;
  const { offline: _drop, ...rest } = content as DocJSON;
  void _drop;
  return rest;
}

/** Parse through the schema, so defaults are filled the same way on both sides
    of a comparison. A snapshot the schema cannot read becomes an empty doc. */
function toNode(schema: Schema, content: unknown): PMNode {
  try {
    if (content && typeof content === "object") return schema.nodeFromJSON(withoutMarker(content));
  } catch { /* fall through */ }
  return schema.topNodeType.createAndFill()!;
}

const nodeHash = (n: PMNode) => hash(JSON.stringify(n.toJSON()));

export function makeMarker(schema: Schema, base: unknown): OfflineMarker {
  const node = toNode(schema, base);
  const blocks: string[] = [];
  node.forEach((b) => { blocks.push(nodeHash(b)); });
  return { doc: nodeHash(node), blocks };
}

/** True when this offline copy differs from the base it started from. */
export function changedSince(schema: Schema, base: OfflineMarker, local: unknown): boolean {
  return nodeHash(toNode(schema, local)) !== base.doc;
}

/**
 * The document the page should hold, given the base the offline copy started
 * from, the offline copy, and the live room's document. Returns null when the
 * room's document is already right.
 */
export function mergeOffline(
  schema: Schema,
  base:   OfflineMarker,
  local:  unknown,
  room:   PMNode,
): object | null {
  const localNode = toNode(schema, local);
  const localHash = nodeHash(localNode);
  const roomHash  = nodeHash(room);

  if (localHash === base.doc || localHash === roomHash) return null;   // nothing to bring across
  if (roomHash === base.doc) return localNode.toJSON();                 // the room did not move

  const seen = new Set(base.blocks);
  room.forEach((b) => { seen.add(nodeHash(b)); });
  const added: PMNode[] = [];
  localNode.forEach((b) => {
    if (b.type.name === "paragraph" && b.content.size === 0) return;    // blank lines are not work
    const h = nodeHash(b);
    if (!seen.has(h)) { added.push(b); seen.add(h); }
  });
  if (!added.length) return null;

  const blocks: PMNode[] = [];
  room.forEach((b) => { blocks.push(b); });
  return room.type.create(room.attrs, [...blocks, ...added]).toJSON();
}
