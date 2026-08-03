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

import { pushWithSplash } from "@/lib/nav-splash";
import { useT } from "@/lib/i18n/LocaleProvider";
import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import type { Chapter } from "@/lib/types";
import type { MemberRole } from "@/lib/services/workspaces.service";
import { isAdmin } from "@/lib/services/workspaces.service";
import { Lock } from "lucide-react";
import type { WorkspaceSurahSummary } from "@/app/workspaces/[workspaceId]/page";
import Rail from "./Rail";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";
import WorkspaceSettings from "./WorkspaceSettings";
import TourBubble from "@/components/TourBubble";

const PLACE: Record<string, string> = { makkah: "Makki", madinah: "Madani" };

interface Props {
  workspaceId: string;
  workspace: { id: string; name: string; type: string; ownerId: string; membersCanManagePages: boolean };
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
  const t = useT();

  // Remove navigation splash screen injected by HomeClient on mount.
  useLayoutEffect(() => {
    document.getElementById("tl-nav-splash")?.remove();
    document.getElementById("tl-nav-splash-style")?.remove();
  }, []);

  const [starting,   setStarting]   = useState<number | null>(null);
  const [navigating, setNavigating] = useState<number | null>(null);
  const [filter,     setFilter]     = useState<"all" | "started" | "not-started">("all");
  const [prevFilter, setPrevFilter] = useState(filter);
  const tabsRef = useRef<Record<string, HTMLButtonElement | null>>({ all: null, started: null, "not-started": null });
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const canManageBoards = isAdmin(role);

  const handleCardClick = useCallback(
    async (chapter: Chapter) => {
      const session = startedMap.get(chapter.id);

      if (session) {
        // Already started — show immediate feedback then navigate.
        setNavigating(chapter.id);
        pushWithSplash(router, `/workspaces/${workspaceId}/surahs/${chapter.id}`);
        return;
      }

      // Not started: only admins may create a new board. Members can't.
      if (!isAdmin(role)) return;

      // Not started — POST to startSurah, then navigate.
      setStarting(chapter.id);
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/surahs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            surahNumber: chapter.id,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          console.error("startSurah failed:", err);
          setStarting(null);
          return;
        }
        // Navigate — the surah page will show empty page list (no pages yet).
        pushWithSplash(router, `/workspaces/${workspaceId}/surahs/${chapter.id}`);
      } catch (err) {
        console.error("startSurah error:", err);
        setStarting(null);
      }
    },
    [startedMap, workspaceId, router, role]
  );

  const visible = chapters.filter((ch) => {
    if (filter === "started") return startedMap.has(ch.id);
    if (filter === "not-started") return !startedMap.has(ch.id);
    return true;
  });

  // Update sliding indicator position when filter changes or on resize.
  // useLayoutEffect so the pill is positioned before paint (no zero-width flash).
  useLayoutEffect(() => {
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
              {t("ws.surahsInProgress", { n: workspaceSurahs.length })}
            </p>
          </div>

          {/* Workspace actions */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="ws-new-btn ws-new-btn--ghost"
              title="All notes across this workspace"
              onClick={() => pushWithSplash(router, `/workspaces/${workspaceId}/notes`)}
            >
              {t("ws.notes")}
            </button>
            <button
              className="ws-new-btn ws-new-btn--ghost"
              title="Every Connection recorded in this workspace"
              onClick={() => pushWithSplash(router, `/workspaces/${workspaceId}/connections`)}
            >
              Connections
            </button>
            <button
              className="ws-new-btn ws-new-btn--ghost"
              title="Blank whiteboard — verses, tafsīr & pen"
              onClick={() => pushWithSplash(router, `/workspaces/${workspaceId}/whiteboard`)}
            >
              {t("ws.blankBoard")}
            </button>
            {role === "owner" && (
              <button
                className="ws-new-btn ws-new-btn--ghost"
                onClick={startRename}
                title="Rename workspace"
              >
                {t("ws.rename")}
              </button>
            )}
            <button
              className="ws-new-btn ws-new-btn--ghost"
              title="Workspace settings and members"
              onClick={() => setSettingsOpen(true)}
            >
              {t("ws.settings")}
            </button>
            <button
              className="ws-new-btn"
              onClick={() => setModalOpen(true)}
              title="Create new workspace"
            >
              {t("ws.newWorkspace")}
            </button>
          </div>

          <div className="ws-filter-tabs" ref={tabsContainerRef}>
            <div className="ws-filter-indicator" aria-hidden />
            {(["all", "started", "not-started"] as const).map((f) => {
              const label = f === "all" ? t("ws.filter.all") : f === "started" ? t("ws.filter.started") : t("ws.filter.notStarted");
              const count = f === "all" ? 114 : f === "started" ? workspaceSurahs.length : 114 - workspaceSurahs.length;
              return (
                <button
                  key={f}
                  ref={(el) => { tabsRef.current[f] = el; }}
                  className="ws-filter-tab"
                  data-active={filter === f ? "true" : "false"}
                  onClick={() => { setPrevFilter(filter); setFilter(f); }}
                >
                  {label}
                  <span className="ws-filter-count">{count}</span>
                </button>
              );
            })}
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
          {visible.map((ch, index) => {
            const session     = startedMap.get(ch.id);
            const isStarting  = starting   === ch.id;
            const isOpening   = navigating === ch.id;
            const isBusy      = isStarting || isOpening;
            // Members can open started boards but can't create new ones.
            const memberLocked = !session && !canManageBoards;

            return (
              <button
                key={ch.id}
                className="ws-surah-card ws-surah-card--animate"
                style={{ animationDelay: `${Math.min(index * 15, 300)}ms` }}
                data-started={session ? "true" : "false"}
                data-loading={isBusy ? "true" : "false"}
                data-locked={memberLocked ? "true" : "false"}
                onClick={() => handleCardClick(ch)}
                title={
                  isBusy ? "Opening…"
                  : session ? `Open — ${session.pageCount} page${session.pageCount !== 1 ? "s" : ""}`
                  : memberLocked ? "Only admins can start a new surah board"
                  : "Start studying"
                }
                disabled={isBusy || memberLocked}
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

                  {isOpening ? (
                    <span className="ws-card-badge ws-card-badge--loading">
                      <span className="ws-card-spinner" />Opening…
                    </span>
                  ) : session ? (
                    <span className="ws-card-badge">
                      {session.pageCount > 0
                        ? `${session.publishedCount}/${session.pageCount} pages`
                        : "Started"}
                    </span>
                  ) : isStarting ? (
                    <span className="ws-card-badge ws-card-badge--loading">Starting…</span>
                  ) : memberLocked ? (
                    <span className="ws-card-locked-hint"><Lock size={10} /> Admin only</span>
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

    {settingsOpen && (
      <WorkspaceSettings
        workspaceId={workspaceId}
        workspaceName={wsName}
        workspaceType={workspace.type}
        membersCanManagePages={workspace.membersCanManagePages}
        currentUserId={workspace.ownerId}
        currentUserRole={role}
        initialIcon={(workspace as { icon?: string | null }).icon ?? null}
        onClose={() => setSettingsOpen(false)}
        onRenamed={(name) => {
          setWsName(name);
          setSettingsOpen(false);
        }}
        onDeleted={() => {
          setSettingsOpen(false);
          pushWithSplash(router, "/home");
        }}
      />
    )}
    <TourBubble />
    </>
  );
}
