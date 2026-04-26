"use client";

/**
 * WorkspaceSidebar — page navigator for a surah session.
 *
 * Changes:
 *   • "+" now opens an inline title input → real page creation.
 *   • Search clear button functional.
 *   • No disabled buttons remain.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, Search, X, Plus } from "lucide-react";
import type { Chapter } from "@/lib/types";
import type { ProgressStatus } from "@/lib/services/progress.service";
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
  onPageSelect:      (pageId: string) => void;
  collapsed?:        boolean;
  onToggleCollapse?: () => void;
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
  onPageSelect,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const router = useRouter();

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
      router.push(`/workspaces/${workspaceId}/surahs/${chapter.id}/pages/${page.id}`);
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
          onClick={() => router.push(`/workspaces/${workspaceId}`)}
          title="Back to surah grid"
        >
          <div className="ws-switcher-avatar">
            {workspaceName.slice(0, 2).toUpperCase()}
          </div>
          <div className="ws-switcher-name">{workspaceName}</div>
          <ChevronRight size={12} style={{ color: "var(--ink-4)", transform: "rotate(90deg)" }} />
        </button>

        <button
          className="rail-btn"
          style={{ width: 28, height: 28 }}
          title="New page"
          onClick={openNewPage}
          disabled={saving}
        >
          <Plus size={14} />
        </button>

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

        {filtered.map((page) => {
          const isActive = page.id === activePageId;
          return (
            <div
              key={page.id}
              className="tree-row"
              data-active={isActive ? "true" : "false"}
              onClick={() => onPageSelect(page.id)}
            >
              <div className="tree-label">{page.title}</div>
              <div className="page-row-meta">
                {Object.keys(groupProgress).length > 0 && (
                  <GroupProgressDot progress={groupProgress} />
                )}
                {page.isAdminAuthored && (
                  <span className="page-admin-dot" title="Admin authored" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <Link href={`/workspaces/${workspaceId}`} className="sidebar-footer-link">
          ← Surah grid
        </Link>
      </div>
    </aside>
  );
}
