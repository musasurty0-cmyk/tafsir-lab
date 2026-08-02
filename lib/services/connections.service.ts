/**
 * Connections — munasabat between Quranic study objects.
 *
 * ONE record per relationship. A Connection is bidirectional, so it is stored
 * once and read from either end (see otherEnd in lib/quran-objects); two rows
 * would let the halves drift apart the moment one was edited.
 */

import { db } from "@/lib/db";
import { getWorkspaceWithRole, isAdmin, type MemberRole } from "./workspaces.service";
import { pairKeyFor, canConnect, parseObjectKey, type ObjectType } from "@/lib/quran-objects";

export class ConnectionError extends Error {
  constructor(
    message: string,
    public code: "INVALID" | "NOT_FOUND" | "FORBIDDEN" | "DUPLICATE",
    /** On DUPLICATE, the Connection that already joins this pair. */
    public existing?: unknown,
  ) { super(message); }
}

const author = { createdBy: { select: { id: true, name: true, avatarUrl: true } } };

export interface ConnectionInput {
  sourceType: ObjectType; sourceKey: string;
  targetType: ObjectType; targetKey: string;
  name: string;
  commentary?: string | null;
  category?: string | null;
  tags?: string[];
}

/**
 * A Selection endpoint must exist IN THIS WORKSPACE. Without this a Connection
 * could name a Selection the user cannot see, or one belonging to another
 * workspace entirely. Ayat and Surahs need no such check — they always exist,
 * and their keys are already range-validated when parsed.
 */
async function assertEndpointsExist(workspaceId: string, keys: string[]) {
  const ids = keys
    .map(parseObjectKey)
    .filter((r): r is NonNullable<typeof r> => !!r && r.type === "selection")
    .map((r) => r.id ?? "")
    .filter(Boolean);
  if (ids.length === 0) return;

  const found = await db.quranSegment.findMany({
    where: { id: { in: ids }, workspaceId },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw new ConnectionError("Selection endpoint not found in this workspace", "INVALID");
  }
}

export async function createConnection(
  workspaceId: string, userId: string, input: ConnectionInput,
) {
  await getWorkspaceWithRole(workspaceId, userId);

  const check = canConnect(input.sourceKey, input.targetKey);
  if (!check.ok) throw new ConnectionError(check.reason ?? "Invalid pair", "INVALID");

  const name = input.name.trim();
  if (!name) throw new ConnectionError("A Connection needs a name", "INVALID");

  await assertEndpointsExist(workspaceId, [input.sourceKey, input.targetKey]);

  const pairKey = pairKeyFor(input.sourceKey, input.targetKey);

  try {
    return await db.quranConnection.create({
      data: {
        workspaceId,
        sourceType: input.sourceType, sourceKey: input.sourceKey,
        targetType: input.targetType, targetKey: input.targetKey,
        pairKey,
        name,
        commentary: input.commentary?.trim() || null,
        category:   input.category || null,
        tags:       input.tags ?? [],
        createdById: userId,
      },
      include: author,
    });
  } catch (e) {
    /* The unique index on (workspaceId, pairKey) is what actually prevents a
       duplicate — including one created concurrently from two devices, where a
       read-then-write check would let both through. Surface the EXISTING
       Connection so the caller can open it rather than just being refused. */
    if ((e as { code?: string }).code === "P2002") {
      const existing = await db.quranConnection.findFirst({
        where: { workspaceId, pairKey }, include: author,
      });
      throw new ConnectionError("These two are already connected", "DUPLICATE", existing);
    }
    throw e;
  }
}

/** Every Connection touching one object, from EITHER end. */
export async function listForObject(
  workspaceId: string, userId: string, objectKey: string,
) {
  await getWorkspaceWithRole(workspaceId, userId);
  return db.quranConnection.findMany({
    where: { workspaceId, OR: [{ sourceKey: objectKey }, { targetKey: objectKey }] },
    orderBy: { updatedAt: "desc" },
    include: author,
  });
}

export interface CatalogueQuery {
  q?: string; category?: string; type?: ObjectType;
  sort?: "updated" | "created" | "name" | "quran";
  take?: number; skip?: number;
}

/** The workspace catalogue. Paginated by default — a workspace accumulates far
 *  more Connections than one screen should ever load. */
export async function listCatalogue(
  workspaceId: string, userId: string, query: CatalogueQuery = {},
) {
  await getWorkspaceWithRole(workspaceId, userId);
  const take = Math.min(query.take ?? 50, 100);
  const skip = query.skip ?? 0;

  const where = {
    workspaceId,
    ...(query.category ? { category: query.category } : {}),
    ...(query.type ? { OR: [{ sourceType: query.type }, { targetType: query.type }] } : {}),
    ...(query.q
      ? {
          OR: [
            { name:       { contains: query.q, mode: "insensitive" as const } },
            { commentary: { contains: query.q, mode: "insensitive" as const } },
            { sourceKey:  { contains: query.q } },
            { targetKey:  { contains: query.q } },
          ],
        }
      : {}),
  };

  const orderBy =
    query.sort === "created" ? { createdAt: "desc" as const }
    : query.sort === "name"  ? { name: "asc" as const }
    /* "quran" orders by source key. Keys begin with the object kind and number
       so ayah:2:* groups ahead of ayah:67:* — close enough to Quranic order
       without a second stored column, and stable. */
    : query.sort === "quran" ? { sourceKey: "asc" as const }
    : { updatedAt: "desc" as const };

  const [items, total] = await Promise.all([
    db.quranConnection.findMany({ where, orderBy, take, skip, include: author }),
    db.quranConnection.count({ where }),
  ]);
  return { items, total, take, skip };
}

/**
 * The whole workspace as a Surah-level map.
 *
 * Every endpoint collapses to the Surah it belongs to — an ayah to its Surah,
 * a Selection to the Surah it spans. That is what keeps this readable: the
 * Qur'an has 114 Surahs, so the graph is bounded no matter how many
 * Connections exist, and it always lays out in the same familiar order rather
 * than drifting like a force-directed cloud.
 *
 * Returns edges, not rows: several Connections between the same two Surahs
 * become one edge carrying a weight, so a heavily linked pair reads as a
 * thicker line instead of a dozen overlapping ones.
 */
export async function connectionMap(workspaceId: string, userId: string) {
  await getWorkspaceWithRole(workspaceId, userId);

  const conns = await db.quranConnection.findMany({
    where: { workspaceId },
    select: { id: true, name: true, sourceKey: true, targetKey: true, category: true },
  });
  if (conns.length === 0) return { nodes: [], edges: [], total: 0 };

  /* Selections do not carry their Surah in the key, so the ones actually
     referenced are resolved in ONE query rather than per-edge. */
  const selIds = new Set<string>();
  for (const c of conns) {
    for (const k of [c.sourceKey, c.targetKey]) {
      const r = parseObjectKey(k);
      if (r?.type === "selection" && r.id) selIds.add(r.id);
    }
  }
  const selSurah = new Map<string, number>();
  if (selIds.size) {
    const segs = await db.quranSegment.findMany({
      where: { id: { in: [...selIds] }, workspaceId },
      select: { id: true, surahNumber: true },
    });
    for (const sg of segs) selSurah.set(sg.id, sg.surahNumber);
  }

  const surahOf = (key: string): number | null => {
    const r = parseObjectKey(key);
    if (!r) return null;
    if (r.type === "ayah" || r.type === "surah") return r.surah ?? null;
    return selSurah.get(r.id ?? "") ?? null;
  };

  const edges = new Map<string, { a: number; b: number; weight: number; ids: string[]; names: string[] }>();
  const degree = new Map<number, number>();

  for (const c of conns) {
    const a = surahOf(c.sourceKey), b = surahOf(c.targetKey);
    if (a == null || b == null) continue;      // endpoint we cannot place
    // Undirected: normalise so 2-67 and 67-2 are the same edge.
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const k = `${lo}-${hi}`;
    const e = edges.get(k) ?? { a: lo, b: hi, weight: 0, ids: [], names: [] };
    e.weight += 1;
    e.ids.push(c.id);
    if (e.names.length < 5) e.names.push(c.name);
    edges.set(k, e);
    degree.set(lo, (degree.get(lo) ?? 0) + 1);
    if (hi !== lo) degree.set(hi, (degree.get(hi) ?? 0) + 1);
  }

  const nodes = [...degree.entries()]
    .map(([surah, count]) => ({ surah, count }))
    .sort((x, y) => x.surah - y.surah);

  return { nodes, edges: [...edges.values()], total: conns.length };
}

export async function getConnection(workspaceId: string, userId: string, id: string) {
  await getWorkspaceWithRole(workspaceId, userId);
  const c = await db.quranConnection.findFirst({ where: { id, workspaceId }, include: author });
  if (!c) throw new ConnectionError("Connection not found", "NOT_FOUND");
  return c;
}

function assertCanMutate(role: MemberRole, createdById: string, userId: string) {
  if (createdById !== userId && !isAdmin(role)) {
    throw new ConnectionError("Only the author or an admin can change this", "FORBIDDEN");
  }
}

/** Endpoints are deliberately NOT editable: changing one changes the pair
 *  identity and could collide with an existing Connection. To relink, delete
 *  and create — which keeps the unique constraint meaningful. */
export async function updateConnection(
  workspaceId: string, userId: string, id: string,
  patch: { name?: string; commentary?: string | null; category?: string | null; tags?: string[] },
) {
  const { role } = await getWorkspaceWithRole(workspaceId, userId);
  const cur = await db.quranConnection.findFirst({ where: { id, workspaceId } });
  if (!cur) throw new ConnectionError("Connection not found", "NOT_FOUND");
  assertCanMutate(role, cur.createdById, userId);

  if (patch.name !== undefined && !patch.name.trim()) {
    throw new ConnectionError("A Connection needs a name", "INVALID");
  }

  return db.quranConnection.update({
    where: { id },
    data: {
      ...(patch.name       !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.commentary !== undefined ? { commentary: patch.commentary?.trim() || null } : {}),
      ...(patch.category   !== undefined ? { category: patch.category || null } : {}),
      ...(patch.tags       !== undefined ? { tags: patch.tags } : {}),
    },
    include: author,
  });
}

export async function deleteConnection(workspaceId: string, userId: string, id: string) {
  const { role } = await getWorkspaceWithRole(workspaceId, userId);
  const cur = await db.quranConnection.findFirst({ where: { id, workspaceId } });
  if (!cur) throw new ConnectionError("Connection not found", "NOT_FOUND");
  assertCanMutate(role, cur.createdById, userId);
  await db.quranConnection.delete({ where: { id } });
  return { id };
}

/** Connections that deleting a Selection would orphan, so the caller can warn
 *  before destroying them rather than leaving dangling endpoints. */
export async function connectionsForSelection(
  workspaceId: string, userId: string, selectionId: string,
) {
  return listForObject(workspaceId, userId, `selection:${selectionId}`);
}
