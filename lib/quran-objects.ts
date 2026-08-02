/**
 * Stable identities for the things a Connection can join.
 *
 * Keys are structural, never display text: "ayah:67:1", "surah:67",
 * "selection:<uuid>". A Selection can be renamed and a Surah has several
 * spellings, so a label cannot be an identifier — the key has to survive both.
 */

export type ObjectType = "ayah" | "selection" | "surah";

export interface ObjectRef {
  type: ObjectType;
  key:  string;
  /** Only for ayah/surah keys; a Selection carries its own range. */
  surah?: number;
  ayah?:  number;
  id?:    string;
}

export const ayahKey      = (surah: number, ayah: number) => `ayah:${surah}:${ayah}`;
export const surahKey     = (surah: number) => `surah:${surah}`;
export const selectionKey = (id: string) => `selection:${id}`;

/** Parse a key back into its parts. Returns null for anything malformed, so a
 *  corrupted or hand-edited key fails closed rather than resolving to Al-Fātiḥah. */
export function parseObjectKey(key: string): ObjectRef | null {
  const [kind, a, b] = key.split(":");
  if (kind === "ayah") {
    const s = Number(a), v = Number(b);
    if (!Number.isInteger(s) || !Number.isInteger(v) || s < 1 || s > 114 || v < 1) return null;
    return { type: "ayah", key, surah: s, ayah: v };
  }
  if (kind === "surah") {
    const s = Number(a);
    if (!Number.isInteger(s) || s < 1 || s > 114) return null;
    return { type: "surah", key, surah: s };
  }
  if (kind === "selection") {
    if (!a) return null;
    // uuid contains no colons, so the remainder is the id verbatim
    return { type: "selection", key, id: key.slice("selection:".length) };
  }
  return null;
}

/**
 * The canonical identity of a PAIR of objects.
 *
 * A Connection is bidirectional, so A→B and B→A are the same relationship.
 * Sorting the two keys collapses both orderings onto one value, which is then
 * carried by a unique index — so a reversed duplicate is refused by the
 * database rather than by a client check that two devices could both pass.
 */
export function pairKeyFor(aKey: string, bKey: string): string {
  return [aKey, bKey].sort().join("|");
}

/** A Connection must join two different objects. */
export function isSelfLink(aKey: string, bKey: string): boolean {
  return aKey === bKey;
}

/**
 * Whether two objects may be connected. A Surah and one of its own āyāt are
 * different study objects, so that is allowed — only the identical object is
 * refused.
 */
export function canConnect(aKey: string, bKey: string): { ok: boolean; reason?: string } {
  const a = parseObjectKey(aKey), b = parseObjectKey(bKey);
  if (!a || !b) return { ok: false, reason: "Unrecognised object" };
  if (isSelfLink(aKey, bKey)) return { ok: false, reason: "An object cannot be connected to itself" };
  return { ok: true };
}

/** Given a Connection and the object being viewed, which end is the OTHER one.
 *  This is how one record renders correctly from both sides. */
export function otherEnd(
  conn: { sourceType: string; sourceKey: string; targetType: string; targetKey: string },
  viewingKey: string,
): { type: ObjectType; key: string } {
  return conn.sourceKey === viewingKey
    ? { type: conn.targetType as ObjectType, key: conn.targetKey }
    : { type: conn.sourceType as ObjectType, key: conn.sourceKey };
}
