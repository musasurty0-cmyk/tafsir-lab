"use client";

/**
 * PagePlaceholder — Phase 2 content area stub.
 *
 * Shown in place of the TipTap editor / spatial canvas until Phase 3.
 * Renders the page's metadata, status badge, and a clear
 * "editor coming in Phase 3" message so the shell feels complete.
 */

import type { ProgressStatus } from "@/lib/services/progress.service";

// The page shape returned by PagesService.getPage — only the fields we need.
interface PageData {
  id: string;
  title: string;
  status: string;
  isAdminAuthored: boolean;
  orderIndex: number;
  createdAt: Date;
  publishedAt: Date | null;
  createdBy: { id: string; name: string; avatarUrl: string | null };
  publishedBy?: { id: string; name: string; avatarUrl: string | null } | null;
}

interface Props {
  page: PageData;
  groupProgress: Record<string, { status: ProgressStatus; lastChangedBy: string }>;
  personalProgress: Record<string, ProgressStatus>;
}

const STATUS_COLORS: Record<string, string> = {
  draft:     "var(--ink-4)",
  published: "var(--accent-ink)",
  archived:  "oklch(0.62 0.09 28)",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="page-status-badge"
      style={{ background: `${STATUS_COLORS[status] ?? "var(--ink-4)"}1a`, color: STATUS_COLORS[status] ?? "var(--ink-4)" }}
    >
      {status}
    </span>
  );
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(d));
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) return <img src={avatarUrl} alt={name} className="doc-meta-avatar" />;
  return <div className="doc-meta-avatar">{name.slice(0, 2).toUpperCase()}</div>;
}

export default function PagePlaceholder({ page, groupProgress, personalProgress }: Props) {
  const groupStudied = Object.values(groupProgress).filter((v) => v.status === "studied").length;
  const personalStudied = Object.values(personalProgress).filter((v) => v === "studied").length;
  const total = Math.max(Object.keys(groupProgress).length, 1);

  return (
    <div className="doc-wrap">
      <div className="doc">
        {/* Cover */}
        <div className="doc-cover">
          <div className="doc-cover-tag">Page {page.orderIndex + 1}</div>
          <h1 className="doc-title">{page.title}</h1>

          <div className="doc-meta">
            <span className="doc-meta-item">
              <Avatar name={page.createdBy.name} avatarUrl={page.createdBy.avatarUrl} />
              {page.createdBy.name}
            </span>
            <span className="doc-meta-sep">·</span>
            <span className="doc-meta-item">{formatDate(page.createdAt)}</span>
            <span className="doc-meta-sep">·</span>
            <StatusBadge status={page.status} />
            {page.isAdminAuthored && (
              <>
                <span className="doc-meta-sep">·</span>
                <span className="doc-meta-item" style={{ color: "var(--accent-ink)", fontSize: 12 }}>
                  Admin authored
                </span>
              </>
            )}
          </div>
        </div>

        {/* Progress summary */}
        {(groupStudied > 0 || personalStudied > 0) && (
          <div className="placeholder-progress-row">
            {groupStudied > 0 && (
              <div className="placeholder-progress-chip">
                <span className="prog-dot" data-status="studied" />
                Group: {groupStudied}/{total} ayahs studied
              </div>
            )}
            {personalStudied > 0 && (
              <div className="placeholder-progress-chip">
                <span className="prog-dot" data-status="personal" />
                Personal: {personalStudied}/{total} studied
              </div>
            )}
          </div>
        )}

        {/* Phase 3 notice */}
        <div className="placeholder-notice">
          <div className="placeholder-notice-icon">✦</div>
          <div>
            <div className="placeholder-notice-title">Editor arriving in Phase 3</div>
            <div className="placeholder-notice-body">
              The TipTap document editor and spatial canvas are the next phase.
              Metadata, progress tracking, and navigation are fully functional now.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
