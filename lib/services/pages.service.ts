/**
 * pages.service
 *
 * Responsibilities:
 *   - List and retrieve pages with draft visibility rules enforced.
 *   - Draft visibility (enforced in every read path):
 *
 *       Private workspace:
 *         draft    → visible only to the workspace owner
 *         published → visible to all members
 *         archived  → visible to admin+ only; hidden from member default views
 *
 *       Group workspace:
 *         draft    → visible to owner, any admin, or the page creator
 *         published → visible to all members
 *         archived  → visible to admin+ only; hidden from member default views
 *
 *   - Uses NOT_FOUND (not FORBIDDEN) when a draft is invisible, to avoid
 *     leaking the existence of unpublished pages to members.
 */

import { db } from "@/lib/db";
import { getWorkspaceWithRole, isAdmin, canManagePages, MemberRole } from "./workspaces.service";

// ── Error type ────────────────────────────────────────────────

export class PageError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID"
  ) {
    super(message);
    this.name = "PageError";
  }
}

// ── Visibility helpers ────────────────────────────────────────

/**
 * Returns true if the acting user is allowed to see this draft page.
 * Always returns true for published pages (caller must check status separately).
 */
function canSeeDraft(opts: {
  page:      { createdById: string };
  workspace: { type: string; ownerId: string };
  userId:    string;
  role:      MemberRole;
}): boolean {
  const { page, workspace, userId, role } = opts;

  if (workspace.type === "private") {
    // Private: only the workspace owner sees drafts.
    return workspace.ownerId === userId;
  }

  // Group: owner, any admin, or the page's own creator.
  return isAdmin(role) || page.createdById === userId;
}

/**
 * Returns true if the acting user is allowed to see an archived page.
 * Archived pages are admin-only in v1.
 */
function canSeeArchived(role: MemberRole): boolean {
  return isAdmin(role);
}

/**
 * Applies visibility rules to a list of pages.
 * Removes pages the user cannot see without raising an error.
 */
function filterVisible<T extends { status: string; createdById: string }>(
  pages: T[],
  opts: { workspace: { type: string; ownerId: string }; userId: string; role: MemberRole }
): T[] {
  return pages.filter((p) => {
    if (p.status === "published") return true;
    if (p.status === "draft")     return canSeeDraft({ page: p, ...opts });
    if (p.status === "archived")  return canSeeArchived(opts.role);
    return false;
  });
}

// ── Access gate ───────────────────────────────────────────────

/**
 * Assert that `userId` may access the workspace `pageId` lives in, and return
 * their role. The gate for routes that touch a page directly through `db`
 * rather than through a service — drawings and presence were doing exactly
 * that with no membership check at all, which let any authenticated user read
 * and write any page's ink and presence by id (IDOR). Throws PageError
 * NOT_FOUND for an unknown page and re-throws WorkspaceError FORBIDDEN for a
 * non-member, so a stranger cannot even distinguish "no such page" from "not
 * yours".
 */
export async function assertPageAccess(
  pageId: string,
  userId: string,
): Promise<{ workspaceId: string; role: MemberRole }> {
  const page = await db.page.findUnique({
    where:  { id: pageId },
    select: { workspaceSurah: { select: { workspaceId: true } } },
  });
  if (!page) throw new PageError("Page not found", "NOT_FOUND");
  const workspaceId = page.workspaceSurah.workspaceId;
  const { role } = await getWorkspaceWithRole(workspaceId, userId);
  return { workspaceId, role };
}

// ── Internal helpers ──────────────────────────────────────────

/** Resolves page + its workspace in one query. Used by getPage. */
async function resolvePageContext(pageId: string) {
  const page = await db.page.findUnique({
    where: { id: pageId },
    include: {
      workspaceSurah: {
        include: {
          workspace: { select: { id: true, name: true, type: true, ownerId: true } },
        },
      },
      createdBy:  { select: { id: true, name: true, avatarUrl: true } },
      publishedBy:{ select: { id: true, name: true, avatarUrl: true } },
      template:   { select: { id: true, name: true } },
      // Notes and drawings are in later phases; relations resolve to []
      notes: {
        orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      },
      userPrefs:  false, // fetched separately to inject userId filter
    },
  });
  if (!page) return null;
  return page;
}

// ── Queries ───────────────────────────────────────────────────

/**
 * List pages for a workspace_surah session.
 * Applies full draft/archived visibility rules.
 * Archived pages are excluded from default results unless includeArchived = true.
 */
export async function listPages(
  workspaceSurahId: string,
  userId: string,
  opts: { includeArchived?: boolean } = {}
) {
  // Resolve surah session → workspace for role check.
  const ws = await db.workspaceSurah.findUnique({
    where: { id: workspaceSurahId },
    include: {
      workspace: { select: { id: true, type: true, ownerId: true } },
    },
  });
  if (!ws) throw new PageError("Surah session not found", "NOT_FOUND");

  const { role } = await getWorkspaceWithRole(ws.workspace.id, userId);

  const pages = await db.page.findMany({
    where: { workspaceSurahId },
    orderBy: { orderIndex: "asc" },
    select: {
      id:             true,
      title:          true,
      orderIndex:     true,
      status:         true,
      isAdminAuthored:true,
      createdById:    true,
      createdAt:      true,
      publishedAt:    true,
      createdBy:      { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const visible = filterVisible(pages, { workspace: ws.workspace, userId, role });

  // By default exclude archived unless explicitly requested.
  if (!opts.includeArchived) {
    return visible.filter((p) => p.status !== "archived");
  }
  return visible;
}

/**
 * Get a single page with full content.
 * Enforces draft/archived visibility.
 * Returns NOT_FOUND (not FORBIDDEN) for invisible drafts to avoid
 * leaking unpublished page existence to members.
 */
export async function getPage(pageId: string, userId: string) {
  const page = await resolvePageContext(pageId);
  if (!page) throw new PageError("Page not found", "NOT_FOUND");

  const { workspace } = page.workspaceSurah;
  const { role } = await getWorkspaceWithRole(workspace.id, userId);

  if (page.status === "draft" && !canSeeDraft({ page, workspace, userId, role })) {
    throw new PageError("Page not found", "NOT_FOUND");
  }
  if (page.status === "archived" && !canSeeArchived(role)) {
    throw new PageError("Page not found", "NOT_FOUND");
  }

  // Fetch this user's prefs for the page separately (to avoid leaking other users' prefs).
  const userPrefs = await db.pageUserPrefs.findUnique({
    where: { pageId_userId: { pageId, userId } },
  });

  return { ...page, userPrefs: userPrefs ?? null };
}

/**
 * Create a new blank draft page in a surah session.
 * Order index is appended after the last existing page.
 */
export async function createPage(
  workspaceSurahId: string,
  userId: string,
  title: string,
  /* Optional starting document. Used to seed demo/tutorial pages with real
     notes; the editor already fills an empty Yjs fragment from tiptapContent,
     so seeded content arrives through the normal path rather than a special
     rendering case. */
  tiptapContent?: unknown,
) {
  const ws = await db.workspaceSurah.findUnique({
    where:   { id: workspaceSurahId },
    include: { workspace: { select: { id: true, type: true, ownerId: true } } },
  });
  if (!ws) throw new PageError("Surah session not found", "NOT_FOUND");

  // Permissions: admins always may add pages; members only when the
  // workspace has opted in (membersCanManagePages).
  const { role, workspace } = await getWorkspaceWithRole(ws.workspace.id, userId);
  if (!canManagePages(role, workspace.membersCanManagePages)) {
    throw new PageError("You don't have permission to add pages", "FORBIDDEN");
  }

  const last = await db.page.findFirst({
    where:   { workspaceSurahId },
    orderBy: { orderIndex: "desc" },
    select:  { orderIndex: true },
  });
  const orderIndex = (last?.orderIndex ?? -1) + 1;

  const page = await db.page.create({
    data: {
      workspaceSurahId,
      title:      title.trim(),
      orderIndex,
      status:     "draft",
      createdById: userId,
      ...(tiptapContent ? { tiptapContent: tiptapContent as object } : {}),
    },
    select: {
      id:             true,
      title:          true,
      orderIndex:     true,
      status:         true,
      isAdminAuthored:true,
      createdById:    true,
      createdAt:      true,
      publishedAt:    true,
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return page;
}

/**
 * Rename a page.
 * Admins always; members only when membersCanManagePages is enabled.
 */
export async function renamePage(
  pageId: string,
  userId: string,
  title: string,
) {
  const page = await db.page.findUnique({
    where: { id: pageId },
    include: { workspaceSurah: { include: { workspace: { select: { id: true, type: true, ownerId: true } } } } },
  });
  if (!page) throw new PageError("Page not found", "NOT_FOUND");

  const { role, workspace } = await getWorkspaceWithRole(page.workspaceSurah.workspace.id, userId);

  // Permissions: admins always; members only when the workspace opts in.
  if (!canManagePages(role, workspace.membersCanManagePages)) {
    throw new PageError("You don't have permission to rename pages", "FORBIDDEN");
  }

  return db.page.update({
    where: { id: pageId },
    data:  { title: title.trim() },
    select: { id: true, title: true },
  });
}

/**
 * Delete a page permanently.
 * Admins always; members only when membersCanManagePages is enabled.
 */
export async function deletePage(
  pageId: string,
  userId: string,
) {
  const page = await db.page.findUnique({
    where: { id: pageId },
    include: { workspaceSurah: { include: { workspace: { select: { id: true, type: true, ownerId: true } } } } },
  });
  if (!page) throw new PageError("Page not found", "NOT_FOUND");

  const { role, workspace } = await getWorkspaceWithRole(page.workspaceSurah.workspace.id, userId);

  // Permissions: admins always; members only when the workspace opts in.
  if (!canManagePages(role, workspace.membersCanManagePages)) {
    throw new PageError("You don't have permission to delete pages", "FORBIDDEN");
  }

  await db.page.delete({ where: { id: pageId } });
}

// ─────────────────────────────────────────────────────────────
// WORKSPACE WHITEBOARD (blank scratch canvas — its own page)
// ─────────────────────────────────────────────────────────────

/**
 * Sentinel surah slot that hosts the single per-workspace whiteboard page.
 * Real surah boards are 1–114; this 0 slot is excluded from every surah
 * listing (workspace home + home "last surah") so it never shows as a board.
 */
export const WHITEBOARD_SURAH = 0;

/** Get-or-create the workspace's whiteboard page. Membership is required. */
export async function getOrCreateWorkspaceWhiteboard(workspaceId: string, userId: string) {
  await getWorkspaceWithRole(workspaceId, userId); // gate: throws for non-members

  const surah = await db.workspaceSurah.upsert({
    where:  { workspaceId_surahNumber: { workspaceId, surahNumber: WHITEBOARD_SURAH } },
    update: {},
    create: { workspaceId, surahNumber: WHITEBOARD_SURAH },
    select: { id: true },
  });

  const existing = await db.page.findFirst({
    where:   { workspaceSurahId: surah.id },
    orderBy: { orderIndex: "asc" },
    select:  { id: true },
  });
  if (existing) return { pageId: existing.id };

  const page = await db.page.create({
    data: { workspaceSurahId: surah.id, title: "Whiteboard", orderIndex: 0, status: "draft", createdById: userId },
    select: { id: true },
  });
  return { pageId: page.id };
}

/** List all boards (whiteboards) in a workspace, newest first. */
export async function listWorkspaceBoards(workspaceId: string, userId: string) {
  await getWorkspaceWithRole(workspaceId, userId);
  const container = await db.workspaceSurah.findUnique({
    where:  { workspaceId_surahNumber: { workspaceId, surahNumber: WHITEBOARD_SURAH } },
    select: { id: true },
  });
  if (!container) return [];
  return db.page.findMany({
    where:   { workspaceSurahId: container.id },
    orderBy: { orderIndex: "asc" },
    select:  { id: true, title: true, createdAt: true },
  });
}

/** Create a new named board in a workspace. */
export async function createWorkspaceBoard(workspaceId: string, userId: string, title: string) {
  await getWorkspaceWithRole(workspaceId, userId);
  const container = await db.workspaceSurah.upsert({
    where:  { workspaceId_surahNumber: { workspaceId, surahNumber: WHITEBOARD_SURAH } },
    update: {},
    create: { workspaceId, surahNumber: WHITEBOARD_SURAH },
    select: { id: true },
  });
  const last = await db.page.findFirst({
    where:   { workspaceSurahId: container.id },
    orderBy: { orderIndex: "desc" },
    select:  { orderIndex: true },
  });
  const page = await db.page.create({
    data: {
      workspaceSurahId: container.id,
      title: title.trim() || "Untitled board",
      orderIndex: (last?.orderIndex ?? -1) + 1,
      status: "draft",
      createdById: userId,
    },
    select: { id: true, title: true },
  });
  return page;
}

/** Validate that a board page belongs to this workspace, returning its title. */
export async function getWorkspaceBoard(workspaceId: string, boardId: string, userId: string) {
  await getWorkspaceWithRole(workspaceId, userId);
  const page = await db.page.findFirst({
    where:  { id: boardId, workspaceSurah: { workspaceId, surahNumber: WHITEBOARD_SURAH } },
    select: { id: true, title: true },
  });
  return page; // null when not found / not a board of this workspace
}

// ─────────────────────────────────────────────────────────────────────────
// BOOK STUDY — a "book" is a Page carrying a pdfUrl, hosted on the same
// sentinel surah (0) as boards but inside a kind:"books" workspace. The PDF is
// either a static library path ("/books/slug.pdf") or "local" (uploaded, bytes
// in the reader's IndexedDB). Annotations sync via the normal notes/drawings.
// ─────────────────────────────────────────────────────────────────────────

/** List all books in a workspace, newest first. */
export async function listWorkspaceBooks(workspaceId: string, userId: string) {
  await getWorkspaceWithRole(workspaceId, userId);
  const container = await db.workspaceSurah.findUnique({
    where:  { workspaceId_surahNumber: { workspaceId, surahNumber: WHITEBOARD_SURAH } },
    select: { id: true },
  });
  if (!container) return [];
  return db.page.findMany({
    where:   { workspaceSurahId: container.id, pdfUrl: { not: null } },
    orderBy: { orderIndex: "asc" },
    select:  { id: true, title: true, pdfUrl: true, pdfName: true, createdAt: true },
  });
}

/** Add a book to a workspace (from the library, or an uploaded "local" PDF). */
export async function createWorkspaceBook(
  workspaceId: string,
  userId: string,
  book: { title: string; pdfUrl: string; pdfName?: string | null },
) {
  await getWorkspaceWithRole(workspaceId, userId);
  const container = await db.workspaceSurah.upsert({
    where:  { workspaceId_surahNumber: { workspaceId, surahNumber: WHITEBOARD_SURAH } },
    update: {},
    create: { workspaceId, surahNumber: WHITEBOARD_SURAH },
    select: { id: true },
  });
  const last = await db.page.findFirst({
    where:   { workspaceSurahId: container.id },
    orderBy: { orderIndex: "desc" },
    select:  { orderIndex: true },
  });
  return db.page.create({
    data: {
      workspaceSurahId: container.id,
      title:      book.title.trim() || "Untitled book",
      pdfUrl:     book.pdfUrl,
      pdfName:    book.pdfName ?? null,
      orderIndex: (last?.orderIndex ?? -1) + 1,
      status:     "draft",
      createdById: userId,
    },
    select: { id: true, title: true, pdfUrl: true, pdfName: true },
  });
}

/** Validate a book page belongs to this workspace, returning its PDF info. */
export async function getWorkspaceBook(workspaceId: string, bookId: string, userId: string) {
  await getWorkspaceWithRole(workspaceId, userId);
  const page = await db.page.findFirst({
    where:  { id: bookId, workspaceSurah: { workspaceId, surahNumber: WHITEBOARD_SURAH }, pdfUrl: { not: null } },
    select: { id: true, title: true, pdfUrl: true, pdfName: true },
  });
  return page; // null when not found / not a book of this workspace
}
