"use client";

/**
 * WorkspaceHome — the 114 sūrahs as one grid, with a search field.
 *
 * "Studying" means there is real work in a sūrah: a note, ink, or written
 * text (hasWork, from the server). Opening one only creates its session, so
 * a sūrah opened by mistake stays plain; nothing needs undoing. Opening a
 * sūrah that already has a session goes straight to it; one that doesn't is
 * started first (admins only in a group workspace).
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
import { Lock, Search, Users, X } from "lucide-react";
import type { WorkspaceSurahSummary } from "@/app/workspaces/[workspaceId]/page";
import Rail from "./Rail";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";
import WorkspaceSettings from "./WorkspaceSettings";
import TourBubble from "@/components/TourBubble";

const PLACE: Record<string, string> = { makkah: "Makki", madinah: "Madani" };

/** "Al-Baqarah", "al baqara", "Baqarah" all match: no accents, hyphens or spaces. */
const normLatin = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** Arabic without its marks, tatweel or alef forms, so "البقرة" finds "ٱلْبَقَرَة". */
const normArabic = (s: string) =>
  s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0629/g, "\u0647").replace(/\u0649/g, "\u064A").replace(/[^\u0621-\u064A]/g, "");

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
  const [query,      setQuery]      = useState("");
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

  // Build lookup for O(1) checks. A session is what opening creates; only
  // one with work in it counts as studying.
  const startedMap = new Map<number, WorkspaceSurahSummary>(
    workspaceSurahs.map((s) => [s.surahNumber, s])
  );
  const isStudying = (n: number) => !!startedMap.get(n)?.hasWork;
  const studyingCount = workspaceSurahs.filter((s) => s.hasWork).length;

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

  const q = normLatin(query);
  const qa = normArabic(query);
  const visible = chapters.filter((ch) => {
    if (filter === "started" && !isStudying(ch.id)) return false;
    if (filter === "not-started" && isStudying(ch.id)) return false;
    if (!q && !qa) return true;
    if (/^\d+$/.test(query.trim())) return String(ch.id).startsWith(query.trim());
    return (q && (normLatin(ch.name_simple).includes(q) || normLatin(ch.translated_name.name).includes(q)))
      || (qa && normArabic(ch.name_arabic).includes(qa));
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
            </div>
            <p className="ws-home-sub">
              <span className="ws-home-kind">
                {workspace.type === "private"
                  ? <><Lock size={11} strokeWidth={2.2} aria-hidden /> Private</>
                  : <><Users size={12} strokeWidth={2.2} aria-hidden /> Group</>}
              </span>
              <span aria-hidden> · </span>
              {t("ws.surahsInProgress", { n: studyingCount })}
            </p>
          </div>

          {/* Workspace actions */}
          <div className="ws-home-actions">
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
              const count = f === "all" ? 114 : f === "started" ? studyingCount : 114 - studyingCount;
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

        {/* Find a sūrah by name, meaning or number, in English or Arabic. */}
        <label className="sfind">
          <Search size={15} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
              if (e.key === "Enter" && visible.length === 1) handleCardClick(visible[0]);
            }}
            placeholder="Find a sūrah: name, meaning or number"
            aria-label="Find a sūrah"
            spellCheck={false}
          />
          {query && (
            <button type="button" className="sfind-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={13} aria-hidden />
            </button>
          )}
        </label>

        {visible.length === 0 ? (
          <p className="sgrid-empty">No sūrah matches “{query.trim()}”.</p>
        ) : (
        <div
          className="sgrid"
          data-anim-direction={(() => {
            const order = ["all", "started", "not-started"];
            const prev = order.indexOf(prevFilter);
            const cur = order.indexOf(filter);
            if (prev === cur) return "none";
            return cur > prev ? "left" : "right";
          })()}
        >
          {visible.map((ch) => {
            const session     = startedMap.get(ch.id);
            const studying    = !!session?.hasWork;
            const isStarting  = starting   === ch.id;
            const isOpening   = navigating === ch.id;
            const isBusy      = isStarting || isOpening;
            // Members can open existing boards but can't create new ones.
            const memberLocked = !session && !canManageBoards;

            return (
              <button
                key={ch.id}
                type="button"
                className="scard"
                data-studying={studying ? "true" : "false"}
                data-loading={isBusy ? "true" : "false"}
                data-locked={memberLocked ? "true" : "false"}
                onClick={() => handleCardClick(ch)}
                title={memberLocked ? "Only admins can start a new sūrah" : undefined}
                disabled={isBusy || memberLocked}
              >
                <span className="scard-top">
                  <span className="scard-num">{ch.id}</span>
                  {isBusy ? (
                    <span className="scard-state scard-state--busy"><span className="ws-card-spinner" />{isStarting ? "Starting" : "Opening"}</span>
                  ) : studying ? (
                    <span className="scard-state"><i aria-hidden />Studying</span>
                  ) : memberLocked ? (
                    <span className="scard-state scard-state--muted"><Lock size={10} aria-hidden /> Admin</span>
                  ) : null}
                </span>
                <span className="scard-ar" lang="ar" dir="rtl">{ch.name_arabic}</span>
                <span className="scard-en">{ch.name_simple}</span>
                <span className="scard-sub">{ch.translated_name.name}</span>
                <span className="scard-meta">{PLACE[ch.revelation_place] ?? ch.revelation_place} · {ch.verses_count} āyāt</span>
              </button>
            );
          })}
        </div>
        )}
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
