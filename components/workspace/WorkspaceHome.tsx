"use client";

/**
 * WorkspaceHome — workspace-aware surah grid.
 *
 * Shows all 114 surahs. Started surahs have a distinct card state
 * with page count badge and click → navigate to their pages.
 * Not-started surahs show "Start studying" on hover, which POSTs
 * to startSurah then navigates to the created page list.
 *
 * Rail is rendered here (fetches workspaces itself).
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Chapter } from "@/lib/types";
import type { MemberRole } from "@/lib/services/workspaces.service";
import type { WorkspaceSurahSummary } from "@/app/workspaces/[workspaceId]/page";
import Rail from "./Rail";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";

const PLACE: Record<string, string> = { makkah: "Makki", madinah: "Madani" };

interface Props {
  workspaceId: string;
  workspace: { id: string; name: string; type: string; ownerId: string };
  role: MemberRole;
  chapters: Chapter[];
  workspaceSurahs: WorkspaceSurahSummary[];
}

export default function WorkspaceHome({
  workspaceId,
  workspace,
  role,
  chapters,
  workspaceSurahs,
}: Props) {
  const router = useRouter();
  const [starting,   setStarting]   = useState<number | null>(null);
  const [filter,     setFilter]     = useState<"all" | "started" | "not-started">("all");
  const [prevFilter, setPrevFilter] = useState(filter);
  const tabsRef = useRef<Record<string, HTMLButtonElement | null>>({ all: null, started: null, "not-started": null });
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const [modalOpen,  setModalOpen]  = useState(false);

  // ── Workspace rename (owner only) ──────────────────────────────────────────
  const [wsName,      setWsName]      = useState(workspace.name);
  const [renaming,    setRenaming]    = useState(false);
  const [renameSaving, setRenameSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startRename = () => {
    if (role !== "owner") return;
    setRenaming(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  };

  const commitRename = async () => {
    const trimmed = wsName.trim();
    if (!trimmed || trimmed === workspace.name) {
      setWsName(workspace.name);
      setRenaming(false);
      return;
    }
    setRenameSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        // Roll back to original on failure
        setWsName(workspace.name);
      }
      // wsName already shows trimmed (optimistic) — keep it on success
    } catch {
      setWsName(workspace.name);
    } finally {
      setRenameSaving(false);
      setRenaming(false);
    }
  };

  const cancelRename = () => {
    setWsName(workspace.name);
    setRenaming(false);
  };

  // Build lookup for O(1) checks
  const startedMap = new Map<number, WorkspaceSurahSummary>(
    workspaceSurahs.map((s) => [s.surahNumber, s])
  );

  const handleCardClick = useCallback(
    async (chapter: Chapter) => {
      const session = startedMap.get(chapter.id);

      if (session) {
        // Already started — navigate to surah pages route.
        // The surah pages route will show the sidebar with pages.
        router.push(`/workspaces/${workspaceId}/surahs/${chapter.id}`);
        return;
      }

      // Not started — POST to startSurah, then navigate.
      setStarting(chapter.id);
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/surahs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            surahNumber: chapter.id,
            templateId: "00000000-0000-0000-0000-000000000001",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          console.error("startSurah failed:", err);
          setStarting(null);
          return;
        }
        // Navigate — the surah page will show empty page list (no pages yet).
        router.push(`/workspaces/${workspaceId}/surahs/${chapter.id}`);
      } catch (err) {
        console.error("startSurah error:", err);
        setStarting(null);
      }
    },
    [startedMap, workspaceId, router]
  );

  const visible = chapters.filter((ch) => {
    if (filter === "started") return startedMap.has(ch.id);
    if (filter === "not-started") return !startedMap.has(ch.id);
    return true;
  });

  // Update sliding indicator position when filter changes or on resize
  useEffect(() => {
    const btn = tabsRef.current[filter];
    const container = tabsContainerRef.current;
    if (!btn || !container) return;
    const rect = btn.getBoundingClientRect();
    const parentRect = container.getBoundingClientRect();
    const left = rect.left - parentRect.left;
    container.style.setProperty("--indicator-left", `${left}px`);
    container.style.setProperty("--indicator-width", `${rect.width}px`);
  }, [filter]);

  useEffect(() => {
    function onResize() {
      const btn = tabsRef.current[filter];
      const container = tabsContainerRef.current;
      if (!btn || !container) return;
      const rect = btn.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      const left = rect.left - parentRect.left;
      container.style.setProperty("--indicator-left", `${left}px`);
      container.style.setProperty("--indicator-width", `${rect.width}px`);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [filter]);

  return (
    <>
    <div className="workspace-home">
      <Rail activeWorkspaceId={workspaceId} />

      <div className="workspace-home-content">
        {/* Header */}
        <div className="ws-home-header">
          <div className="ws-home-titles">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {renaming ? (
                <input
                  ref={nameInputRef}
                  className="ws-home-name-input"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.currentTarget.blur(); }
                    if (e.key === "Escape") cancelRename();
                  }}
                  disabled={renameSaving}
                  maxLength={80}
                  autoFocus
                />
              ) : (
                <h1
                  className={`ws-home-name${role === "owner" ? " ws-home-name--editable" : ""}`}
                  onClick={startRename}
                  title={role === "owner" ? "Click to rename" : undefined}
                >
                  {wsName}
                </h1>
              )}
              <span className={`ws-type-badge ws-type-badge--${workspace.type}`}>
                {workspace.type === "private" ? "🔒 Private" : "👥 Group"}
              </span>
            </div>
            <p className="ws-home-sub">
              {workspaceSurahs.length} surah{workspaceSurahs.length !== 1 ? "s" : ""} in progress
            </p>
          </div>

          {/* Workspace actions (owner only) */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {role === "owner" && (
              <button
                className="ws-new-btn ws-new-btn--ghost"
                onClick={startRename}
                title="Rename workspace"
              >
                Rename
              </button>
            )}
            <button
              className="ws-new-btn ws-new-btn--ghost"
              title="Coming soon"
              onClick={() => {}}
            >
              Members
            </button>
            <button
              className="ws-new-btn"
              onClick={() => setModalOpen(true)}
              title="Create new workspace"
            >
              + New workspace
            </button>
          </div>

          <div className="ws-filter-tabs" ref={tabsContainerRef}>
            {(["all", "started", "not-started"] as const).map((f) => (
              <button
                key={f}
                ref={(el) => { tabsRef.current[f] = el; }}
                className="ws-filter-tab"
                data-active={filter === f ? "true" : "false"}
                onClick={() => {
                  setPrevFilter(filter);
                  setFilter(f);
                  // trigger a short pulse animation on the indicator
                  if (tabsContainerRef.current) {
                    tabsContainerRef.current.dataset.anim = "pulse";
                    setTimeout(() => {
                      if (tabsContainerRef.current) delete tabsContainerRef.current.dataset.anim;
                    }, 320);
                  }
                }}
              >
                {f === "all" ? "All (114)" : f === "started" ? `Started (${workspaceSurahs.length})` : `Not started (${114 - workspaceSurahs.length})`}
              </button>
            ))}
            <div className="ws-filter-indicator" aria-hidden />
          </div>
        </div>

        {/* Grid */}
        <div
          className="ws-surah-grid"
          data-anim-direction={(() => {
            const order = ["all", "started", "not-started"];
            const prev = order.indexOf(prevFilter);
            const cur = order.indexOf(filter);
            if (prev === cur) return "none";
            return cur > prev ? "left" : "right";
          })()}
        >
          {visible.map((ch) => {
            const session = startedMap.get(ch.id);
            const isStarting = starting === ch.id;

            return (
              <button
                key={ch.id}
                className="ws-surah-card"
                data-started={session ? "true" : "false"}
                data-loading={isStarting ? "true" : "false"}
                onClick={() => handleCardClick(ch)}
                title={isStarting ? "Starting…" : session ? `Open — ${session.pageCount} page${session.pageCount !== 1 ? "s" : ""}` : "Start studying"}
                disabled={isStarting}
              >
                {/* Number badge */}
                <div className="ws-card-num">{ch.id}</div>

                {/* Names */}
                <div className="ws-card-arabic">{ch.name_arabic}</div>
                <div className="ws-card-name">{ch.name_simple}</div>
                <div className="ws-card-meta">
                  {ch.translated_name.name}
                </div>

                {/* Footer */}
                <div className="ws-card-footer">
                  <span className="ws-card-tag">
                    {PLACE[ch.revelation_place] ?? ch.revelation_place} · {ch.verses_count}v
                  </span>

                  {session ? (
                    <span className="ws-card-badge">
                      {session.pageCount > 0
                        ? `${session.publishedCount}/${session.pageCount} pages`
                        : "Started"}
                    </span>
                  ) : isStarting ? (
                    <span className="ws-card-badge ws-card-badge--loading">Starting…</span>
                  ) : (
                    <span className="ws-card-start-hint">Start →</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>

    {modalOpen && <NewWorkspaceModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
