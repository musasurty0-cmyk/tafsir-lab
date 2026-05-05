"use client";

/**
 * SurahNoPages — shown when a surah session exists but has no pages.
 * Provides a real "Create first page" form.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Chapter } from "@/lib/types";
import type { MemberRole } from "@/lib/services/workspaces.service";
import Rail from "./Rail";
import TourBubble from "@/components/TourBubble";

const BookIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
    style={{ color: "var(--ink-4)" }}>
    <path d="M4 4h10a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/>
    <path d="M4 4v13a3 3 0 0 1 3-3h10"/>
  </svg>
);

interface Props {
  workspaceId: string;
  workspace:   { id: string; name: string };
  role:        MemberRole;
  chapter:     Chapter;
  surahNumber: number;
}

export default function SurahNoPages({
  workspaceId,
  workspace,
  chapter,
  surahNumber,
}: Props) {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title,  setTitle]  = useState("");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) { setError("Page title is required"); return; }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/surahs/${surahNumber}/pages`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ title: trimmed }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? "Failed to create page");
        setSaving(false);
        return;
      }

      const { page } = await res.json() as { page: { id: string } };
      router.push(`/workspaces/${workspaceId}/surahs/${surahNumber}/pages/${page.id}`);
    } catch {
      setError("Network error — please try again");
      setSaving(false);
    }
  }

  return (
    <>
    <div className="workspace-home">
      <Rail activeWorkspaceId={workspaceId} />

      <div className="workspace-home-content">
        {/* Breadcrumb */}
        <div className="no-pages-crumbs">
          <Link href={`/workspaces/${workspaceId}`} className="no-pages-back">
            ← {workspace.name}
          </Link>
          <span className="crumb-sep">/</span>
          <span style={{ color: "var(--ink-2)", fontSize: 13 }}>
            {chapter.name_simple}
          </span>
        </div>

        {/* Empty state + create form */}
        <div className="no-pages-empty">
          <BookIcon />
          <h2 className="no-pages-title">No pages yet</h2>
          <p className="no-pages-body">
            {chapter.name_simple} ({chapter.name_arabic}) has been started.
            Create the first page to begin studying.
          </p>

          <form className="no-pages-create-form" onSubmit={handleCreate}>
            <input
              ref={inputRef}
              className="no-pages-input"
              placeholder="Page title, e.g. Overview"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              maxLength={120}
              autoFocus
            />
            {error && (
              <p className="sidebar-new-page-error" style={{ textAlign: "center" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              className="modal-btn-create"
              disabled={saving || !title.trim()}
              style={{ width: "100%" }}
            >
              {saving ? "Creating…" : "Create first page"}
            </button>
          </form>

          <Link href={`/workspaces/${workspaceId}`} className="no-pages-return">
            ← Back to surah grid
          </Link>
        </div>
      </div>
    </div>
    <TourBubble workspaceId={workspaceId} />
    </>
  );
}
