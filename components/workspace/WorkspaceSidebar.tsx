"use client";

/**
 * WorkspaceSidebar — page navigator for a surah session.
 *
 * Changes:
 *   • "+" now opens an inline title input → real page creation.
 *   • Search clear button functional.
 *   • No disabled buttons remain.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useT } from "@/lib/i18n/LocaleProvider";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, Search, X, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Chapter } from "@/lib/types";
import type { ProgressStatus } from "@/lib/services/progress.service";
import type { MemberRole } from "@/lib/services/workspaces.service";
import Link from "next/link";

// ── Icons ──────────────────────────────────────────────────────────────────

const BookIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h10a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/>
    <path d="M4 4v13a3 3 0 0 1 3-3h10"/>
  </svg>
);

// ── Progress dot ───────────────────────────────────────────────────────────

function GroupProgressDot({
  progress,
}: {
  progress: Record<string, { status: ProgressStatus; lastChangedBy: string }>;
}) {
  const all = Object.values(progress);
  if (all.length === 0) return null;
  const studied = all.filter((v) => v.status === "studied").length;
  const pending = all.filter((v) => v.status === "pending").length;
  const pct     = studied / all.length;

  let color = "var(--ink-4)";
  if (pct === 1) color = "var(--accent)";
  else if (pct > 0 || pending > 0) color = "oklch(0.62 0.11 70)";

  return (
    <span
      className="page-progress-dot"
      style={{ background: color }}
      title={`Group: ${studied}/${all.length} studied`}
    />
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

interface PageSummary {
  id:              string;
  title:           string;
  orderIndex:      number;
  status:          string;
  isAdminAuthored: boolean;
  createdById:     string;
  createdAt:       Date;
  publishedAt:     Date | null;
  createdBy:       { id: string; name: string; avatarUrl: string | null };
}

interface Props {
  workspaceId:       string;
  workspaceName:     string;
  chapter:           Chapter;
  pages:             PageSummary[];
  activePageId:      string;
  groupProgress:     Record<string, { status: ProgressStatus; lastChangedBy: string }>;
  personalProgress:  Record<string, ProgressStatus>;
  role:              MemberRole;
  /** Whether the current user may add/rename/delete pages (admins, or
   *  members when the workspace has enabled member page management). */
  canManagePages:    boolean;
  onPageSelect:      (pageId: string) => void;
  onPageRenamed:     (id: string, title: string) => void;
  onPageDeleted:     (id: string) => void;
  collapsed?:        boolean;
  onToggleCollapse?: () => void;
}

// ── PageRow ────────────────────────────────────────────────────────────────

function PageRow({
  page, isActive, workspaceId, chapter, groupProgress, showActions, onRenamed, onDeleted,
}: {
  page:          PageSummary;
  isActive:      boolean;
  workspaceId:   string;
  chapter:       Chapter;
  groupProgress: Record<string, { status: ProgressStatus; lastChangedBy: string }>;
  activePageId:  string;
  showActions:   boolean;
  onRenamed:     (id: string, title: string) => void;
  onDeleted:     (id: string) => void;
}) {
  const router = useRouter();
  const href   = `/workspaces/${workspaceId}/surahs/${chapter.id}/pages/${page.id}`;

  const [editing,      setEditing]      = useState(false);
  const [draft,        setDraft]        = useState(page.title);
  const [saving,       setSaving]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setDraft(page.title);
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 20);
  }

  async function commitRename() {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed || trimmed === page.title) { setDraft(page.title); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) { onRenamed(page.id, trimmed); }
      else        { setDraft(page.title); }
    } catch { setDraft(page.title); }
    finally { setSaving(false); }
  }

  async function confirmAndDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
      onDeleted(page.id);
      if (isActive) pushWithSplash(router, `/workspaces/${workspaceId}`);
    } finally { setDeleting(false); setConfirmDelete(false); }
  }

  if (editing) {
    return (
      <div className="tree-row tree-row--editing" data-active={isActive ? "true" : "false"}>
        <input
          ref={inputRef}
          className="tree-row-rename-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter")  e.currentTarget.blur();
            if (e.key === "Escape") { setEditing(false); setDraft(page.title); }
          }}
          disabled={saving}
        />
      </div>
    );
  }

  return (
    <div className="tree-row tree-row--with-actions" data-active={isActive ? "true" : "false"}>
      <Link href={href} prefetch className="tree-row-link">
        <span className="tree-label">{page.title}</span>
        {Object.keys(groupProgress).length > 0 && (
          <GroupProgressDot progress={groupProgress} />
        )}
      </Link>

      {showActions && (
        <div className="tree-row-actions">
          <button
            className="tree-row-action-btn"
            title="Rename"
            onClick={startEdit}
          >
            <Pencil size={11} />
          </button>
          <button
            className={`tree-row-action-btn${confirmDelete ? " tree-row-action-btn--danger" : ""}`}
            title={confirmDelete ? "Click again to confirm delete" : "Delete"}
            onClick={confirmAndDelete}
            disabled={deleting}
            onBlur={() => setConfirmDelete(false)}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function WorkspaceSidebar({
  workspaceId,
  workspaceName,
  chapter,
  pages,
  activePageId,
  groupProgress,
  personalProgress: _personalProgress,
  role: _role,
  canManagePages,
  onPageSelect: _onPageSelect,
  onPageRenamed,
  onPageDeleted,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const router = useRouter();
  const t = useT();

  const [query,        setQuery]        = useState("");
  const [creatingPage, setCreatingPage] = useState(false);
  const [newTitle,     setNewTitle]     = useState("");
  const [saving,       setSaving]       = useState(false);
  const [createError,  setCreateError]  = useState<string | null>(null);
  const newTitleRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? pages.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
    : pages;

  function openNewPage() {
    setCreatingPage(true);
    setNewTitle("");
    setCreateError(null);
    setTimeout(() => newTitleRef.current?.focus(), 30);
  }

  async function submitNewPage(e?: React.FormEvent) {
    e?.preventDefault();
    const title = newTitle.trim();
    if (!title) { setCreateError("Title is required"); return; }

    setSaving(true);
    setCreateError(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/surahs/${chapter.id}/pages`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ title }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setCreateError(data.error ?? "Failed to create page");
        setSaving(false);
        return;
      }

      const { page } = await res.json() as { page: { id: string } };
      setCreatingPage(false);
      setNewTitle("");
      pushWithSplash(router, `/workspaces/${workspaceId}/surahs/${chapter.id}/pages/${page.id}`);
    } catch {
      setCreateError("Network error");
      setSaving(false);
    }
  }

  function cancelNewPage() {
    setCreatingPage(false);
    setNewTitle("");
    setCreateError(null);
  }

  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>

      {/* ── Workspace header ── */}
      <div className="sidebar-head">
        <button
          className="ws-switcher"
          onClick={() => pushWithSplash(router, `/workspaces/${workspaceId}`)}
          title="Back to surah grid"
        >
          <div className="ws-switcher-avatar">
            {workspaceName.slice(0, 2).toUpperCase()}
          </div>
          <div className="ws-switcher-name">{workspaceName}</div>
          <ChevronRight size={12} style={{ color: "var(--ink-4)", transform: "rotate(90deg)" }} />
        </button>

        {canManagePages && (
          <button
            className="rail-btn"
            style={{ width: 28, height: 28 }}
            title="New page"
            onClick={openNewPage}
            disabled={saving}
          >
            <Plus size={14} />
          </button>
        )}

        {onToggleCollapse && (
          <button
            className="rail-btn sidebar-collapse-btn"
            style={{ width: 28, height: 28 }}
            title="Collapse sidebar"
            onClick={onToggleCollapse}
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* ── Search ── */}
      <div className="sidebar-search">
        <Search size={12} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
        <input
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            style={{ color: "var(--ink-4)", lineHeight: 1, flexShrink: 0 }}
            onClick={() => setQuery("")}
            title="Clear"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* ── Surah section header ── */}
      <div className="sidebar-section">
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <BookIcon />
          {chapter.name_simple}
          <span style={{ fontFamily: "var(--font-arabic)", fontSize: 13, color: "var(--ink-3)" }}>
            {chapter.name_arabic}
          </span>
        </span>
        <span>{pages.length}</span>
      </div>

      {/* ── Inline new-page form ── */}
      {creatingPage && (
        <form className="sidebar-new-page-form" onSubmit={submitNewPage}>
          <input
            ref={newTitleRef}
            className="sidebar-new-page-input"
            placeholder="Page title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") cancelNewPage(); }}
            disabled={saving}
            maxLength={120}
          />
          {createError && (
            <p className="sidebar-new-page-error">{createError}</p>
          )}
          <div className="sidebar-new-page-actions">
            <button
              type="submit"
              className="sidebar-new-page-save"
              disabled={saving || !newTitle.trim()}
            >
              {saving ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              className="sidebar-new-page-cancel"
              onClick={cancelNewPage}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Page list ── */}
      <div className="tree scroll" style={{ flex: 1 }}>
        {filtered.length === 0 && !creatingPage && (
          <div className="sidebar-empty">
            {query
              ? "No pages match"
              : <span>No pages — click <strong>+</strong> to create one</span>
            }
          </div>
        )}

        {filtered.map((page) => (
          <PageRow
            key={page.id}
            page={page}
            isActive={page.id === activePageId}
            workspaceId={workspaceId}
            chapter={chapter}
            groupProgress={groupProgress}
            activePageId={activePageId}
            showActions={canManagePages}
            onRenamed={(id, title) => onPageRenamed(id, title)}
            onDeleted={(id) => onPageDeleted(id)}
          />
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <Link href={`/workspaces/${workspaceId}`} className="sidebar-footer-link">
          ← {t("sidebar.workspaceHome")}
        </Link>
        <Link href={`/workspaces/${workspaceId}/notes`} className="sidebar-footer-link">
          {t("sidebar.allNotes")}
        </Link>
      </div>
    </aside>
  );
}
