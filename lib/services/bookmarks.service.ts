/**
 * Bookmarks and recent activity — the two lists on the dashboard rail.
 *
 * A bookmark is a saved PLACE, not a saved note: it points at a Page and
 * optionally at a spot inside it. Nulls are meaningful, so a bookmark with only
 * a pageId means "this notebook page", which is what a blank board or an
 * imported PDF needs.
 *
 * Both functions return a ready-made href. Working out where a row leads means
 * knowing whether its page is a surah page, a board or a book — that is
 * knowledge about routing, and it belongs next to the query rather than
 * repeated in each component that renders a list.
 */

import { db } from "@/lib/db";
import { WHITEBOARD_SURAH } from "@/lib/services/pages.service";

export interface RailItem {
  id:        string;
  title:     string;
  subtitle:  string;
  href:      string;
  at:        string;
}

interface PageShape {
  id: string;
  title: string;
  pdfUrl?: string | null;
  workspaceSurah: {
    surahNumber: number;
    workspace: { id: string; name: string };
  };
}

/** Where a page lives, given what kind of page it turns out to be. */
export function hrefForPage(page: PageShape): string {
  const { workspace, surahNumber } = page.workspaceSurah;
  if (surahNumber === WHITEBOARD_SURAH) {
    return page.pdfUrl
      ? `/workspaces/${workspace.id}/books/${page.id}`
      : `/workspaces/${workspace.id}/whiteboard/${page.id}`;
  }
  return `/workspaces/${workspace.id}/surahs/${surahNumber}/pages/${page.id}`;
}

const PAGE_SELECT = {
  id: true, title: true, pdfUrl: true,
  workspaceSurah: {
    select: {
      surahNumber: true,
      workspace: { select: { id: true, name: true } },
    },
  },
} as const;

/** The user's most recent annotations, newest first, one row per note. */
export async function recentAnnotations(userId: string, limit = 6): Promise<RailItem[]> {
  const notes = await db.structuredNote.findMany({
    where:   { authorId: userId },
    orderBy: { createdAt: "desc" },
    take:    limit,
    select: {
      id: true, surahNumber: true, ayahNumber: true, mushafPage: true,
      createdAt: true, page: { select: PAGE_SELECT },
    },
  });

  /* Place first, notebook second. Six notes from one notebook would otherwise
     render as six identical titles with the only distinguishing fact demoted
     to the sub-line — a list where every row reads the same is not a list. */
  return notes.map((n) => ({
    id:    n.id,
    title:
      n.surahNumber != null && n.ayahNumber != null ? `${n.surahNumber}:${n.ayahNumber}`
      : n.mushafPage != null && n.mushafPage > 0    ? `Page ${n.mushafPage}`
      : n.page.title,
    subtitle: n.page.workspaceSurah.workspace.name,
    href:  hrefForPage(n.page),
    at:    n.createdAt.toISOString(),
  }));
}

export async function listBookmarks(userId: string, limit = 20): Promise<RailItem[]> {
  const rows = await db.bookmark.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
    take:    limit,
    select: {
      id: true, label: true, surahNumber: true, ayahNumber: true,
      mushafPage: true, createdAt: true, page: { select: PAGE_SELECT },
    },
  });

  /* A bookmark keeps its label as the title — the user chose that word, and it
     is more useful than the coordinates they already know. */
  return rows.map((b) => ({
    id:    b.id,
    title: b.label,
    subtitle:
      b.surahNumber != null && b.ayahNumber != null ? `${b.surahNumber}:${b.ayahNumber}`
      : b.mushafPage != null && b.mushafPage > 0    ? `Page ${b.mushafPage}`
      : b.page.workspaceSurah.workspace.name,
    href:  hrefForPage(b.page),
    at:    b.createdAt.toISOString(),
  }));
}

export async function addBookmark(userId: string, input: {
  pageId: string; label?: string;
  surahNumber?: number | null; ayahNumber?: number | null; mushafPage?: number | null;
}) {
  // Membership check via the page's workspace: a bookmark is harmless, but it
  // would still leak a page id and title to someone with no access to it.
  const page = await db.page.findFirst({
    where: {
      id: input.pageId,
      workspaceSurah: { workspace: { members: { some: { userId } } } },
    },
    select: PAGE_SELECT,
  });
  if (!page) return null;

  const label = (input.label ?? "").trim() || page.title || "Bookmark";

  return db.bookmark.create({
    data: {
      userId, pageId: page.id, label: label.slice(0, 120),
      surahNumber: input.surahNumber ?? null,
      ayahNumber:  input.ayahNumber ?? null,
      mushafPage:  input.mushafPage ?? null,
    },
    select: { id: true, label: true },
  });
}

/** deleteMany, scoped by userId — so an id belonging to someone else is a no-op. */
export async function removeBookmark(userId: string, id: string) {
  const { count } = await db.bookmark.deleteMany({ where: { id, userId } });
  return count > 0;
}
