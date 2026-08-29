/**
 * Friends and the leaderboard.
 *
 * Friendship is stored as one directed row per pair (see the schema comment).
 * Everything here treats it as undirected on read: `friendsOf` unions both
 * sides, and `request` refuses a duplicate in either direction rather than
 * letting two people create two rows for one relationship.
 *
 * The leaderboard counts the same StructuredNote rows analytics does, so a
 * user's rank and their own total can never disagree.
 */

import { db } from "@/lib/db";

export class SocialError extends Error {
  constructor(readonly code: "NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "SocialError";
  }
}

export interface PublicUser {
  id: string; name: string; avatarUrl: string | null;
}

export interface FriendEdge extends PublicUser {
  status:    "pending" | "accepted";
  /** true when the other person asked and it is this user's move. */
  incoming:  boolean;
  since:     string;
}

const PUB = { id: true, name: true, avatarUrl: true } as const;

/** Everyone this user is connected to, accepted and pending, both directions. */
export async function friendsOf(userId: string): Promise<FriendEdge[]> {
  const rows = await db.friendship.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: {
      status: true, createdAt: true, requesterId: true,
      requester: { select: PUB }, addressee: { select: PUB },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => {
    const incoming = r.requesterId !== userId;
    const other    = incoming ? r.requester : r.addressee;
    return {
      ...other,
      status:   r.status as "pending" | "accepted",
      incoming,
      since:    r.createdAt.toISOString(),
    };
  });
}

/** Accepted friends only — the set the leaderboard's "Friends" filter uses. */
export async function acceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await db.friendship.findMany({
    where:  { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

/**
 * Find people to add, by name or email.
 *
 * Email matches must be exact. Substring-matching an email would turn this box
 * into a directory scraper: type "@gmail" and you get everyone. A name is
 * already public on shared workspaces, an address is not.
 */
export async function search(userId: string, q: string): Promise<PublicUser[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const existing = await db.friendship.findMany({
    where:  { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  const known = new Set(existing.flatMap((r) => [r.requesterId, r.addresseeId]));
  known.add(userId);

  const users = await db.user.findMany({
    where: {
      id: { notIn: [...known] },
      OR: [
        { name:  { contains: term, mode: "insensitive" } },
        { email: { equals: term.toLowerCase() } },
      ],
    },
    select: PUB,
    take: 12,
    orderBy: { name: "asc" },
  });
  return users;
}

export async function request(userId: string, targetId: string) {
  if (userId === targetId) throw new SocialError("BAD_REQUEST", "You cannot add yourself");

  const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) throw new SocialError("NOT_FOUND", "No such person");

  // Either direction counts as already connected. Checking both is the whole
  // reason a single directed row is safe.
  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId,   addresseeId: targetId },
        { requesterId: targetId, addresseeId: userId },
      ],
    },
    select: { id: true, status: true, requesterId: true },
  });

  // They already asked us — treat "add" as "accept" rather than erroring at
  // someone for doing the obvious thing.
  if (existing) {
    if (existing.status === "accepted") return { status: "accepted" as const };
    if (existing.requesterId === targetId) {
      await db.friendship.update({
        where: { id: existing.id },
        data:  { status: "accepted", respondedAt: new Date() },
      });
      return { status: "accepted" as const };
    }
    return { status: "pending" as const };
  }

  await db.friendship.create({ data: { requesterId: userId, addresseeId: targetId } });
  return { status: "pending" as const };
}

export async function respond(userId: string, otherId: string, accept: boolean) {
  const row = await db.friendship.findFirst({
    where:  { requesterId: otherId, addresseeId: userId, status: "pending" },
    select: { id: true },
  });
  if (!row) throw new SocialError("NOT_FOUND", "No pending request from that person");

  if (accept) {
    await db.friendship.update({
      where: { id: row.id },
      data:  { status: "accepted", respondedAt: new Date() },
    });
    return { status: "accepted" as const };
  }
  await db.friendship.delete({ where: { id: row.id } });
  return { status: "declined" as const };
}

/** Remove a friendship in whichever direction it was stored. */
export async function remove(userId: string, otherId: string) {
  await db.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: userId,  addresseeId: otherId },
        { requesterId: otherId, addresseeId: userId },
      ],
    },
  });
}

export interface RankRow extends PublicUser {
  rank: number; total: number; isSelf: boolean;
}

/**
 * Ranking by annotation count.
 *
 * `scope` "friends" includes the viewer even when they have opted out of the
 * public board — their own row is not a disclosure to anyone else. The public
 * board honours the opt-out for everyone including the viewer, so a user who
 * turned it off does not appear on a page other people can see.
 */
export async function leaderboard(
  userId: string, scope: "global" | "friends" = "global", limit = 50,
): Promise<RankRow[]> {
  let ids: string[] | null = null;
  if (scope === "friends") ids = [...await acceptedFriendIds(userId), userId];

  const users = await db.user.findMany({
    where: ids
      ? { id: { in: ids } }
      : { publicLeaderboard: true },
    select: { ...PUB, _count: { select: { notes: true } } },
  });

  return users
    .map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl, total: u._count.notes }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((u, i) => ({ ...u, rank: i + 1, isSelf: u.id === userId }));
}
