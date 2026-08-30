"use client";

/**
 * BoardsHome — home screen for a "boards" workspace (a weekly class, etc.).
 *
 * Instead of the 114-surah grid, it lists the workspace's blank whiteboards and
 * lets you spin up a new one — each opens the standalone whiteboard canvas.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useT } from "@/lib/i18n/LocaleProvider";
import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MemberRole } from "@/lib/services/workspaces.service";
import WorkspaceSettings from "./WorkspaceSettings";
import Rail from "./Rail";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";
import { useHydrated } from "@/lib/use-hydrated";

interface Board { id: string; title: string; createdAt: Date | string; }

interface Props {
  workspaceId: string;
  workspace: { id: string; name: string; type: string; kind: string; ownerId: string; membersCanManagePages: boolean };
  role: MemberRole;
  boards: Board[];
}

/* Intl formats in the runtime's timezone. Vercel runs UTC and the reader does
   not, so a board created near midnight formats as a different day on the
   server than in the browser — which is a hydration mismatch, not a cosmetic
   one. Only ever called once the browser is in charge; see useHydrated. */
function fmt(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}
function todayTitle() {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date());
}

export default function BoardsHome({ workspaceId, workspace, role, boards: initialBoards }: Props) {
  const router = useRouter();
  const t = useT();
  const hydrated = useHydrated();

  useLayoutEffect(() => {
    document.getElementById("tl-nav-splash")?.remove();
    document.getElementById("tl-nav-splash-style")?.remove();
  }, []);

  const [boards]                    = useState<Board[]>(initialBoards);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);

  // New board inline flow
  const [creating, setCreating] = useState(false);
  const [title, setTitle]       = useState(() => todayTitle());
  const [saving, setSaving]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rename workspace (owner)
  const [wsName, setWsName]         = useState(workspace.name);
  const [renaming, setRenaming]     = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function startCreate() {
    setTitle(todayTitle());
    setCreating(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function createBoard() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || todayTitle() }),
      });
      const data = await res.json().catch(() => null) as { board?: { id: string } } | null;
      if (data?.board) {
        pushWithSplash(router, `/workspaces/${workspaceId}/whiteboard/${data.board.id}`);
      }
    } finally {
      setSaving(false);
      setCreating(false);
    }
  }

  async function commitRename() {
    const trimmed = wsName.trim();
    if (!trimmed || trimmed === workspace.name) { setWsName(workspace.name); setRenaming(false); return; }
    try {
      await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
    } catch { setWsName(workspace.name); }
    setRenaming(false);
  }

  return (
    <div className="workspace-home">
      {/* .workspace-home is a grid of [rail | content] — without the Rail the
          content collapses into the narrow rail column. */}
      <Rail activeWorkspaceId={workspaceId} />

      <div className="workspace-home-content">
        <div className="ws-home-header">
          <div className="ws-home-titles">
            {renaming ? (
              <input
                ref={nameInputRef}
                className="ws-home-name-input"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setWsName(workspace.name); setRenaming(false); } }}
                maxLength={80}
              />
            ) : (
              <h1
                className="ws-home-name"
                onClick={() => { if (role === "owner") { setRenaming(true); setTimeout(() => nameInputRef.current?.select(), 0); } }}
                title={role === "owner" ? "Click to rename" : undefined}
                style={{ cursor: role === "owner" ? "text" : "default" }}
              >
                {wsName} <span className="ws-home-kind-badge">{t("boards.badge")}</span>
              </h1>
            )}
            <p className="ws-home-sub">{t("boards.count", { n: boards.length })}</p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="ws-new-btn ws-new-btn--ghost" title="All notes across this workspace" onClick={() => pushWithSplash(router, `/workspaces/${workspaceId}/notes`)}>{t("ws.notes")}</button>
            <button className="ws-new-btn ws-new-btn--ghost" title="Every Connection recorded in this workspace" onClick={() => pushWithSplash(router, `/workspaces/${workspaceId}/connections`)}>Connections</button>
            <button className="ws-new-btn ws-new-btn--ghost" title="Workspace settings and members" onClick={() => setSettingsOpen(true)}>{t("ws.settings")}</button>
            <button className="ws-new-btn" onClick={() => setModalOpen(true)} title="Create new workspace">{t("ws.newWorkspace")}</button>
          </div>
        </div>

        {/* New board inline */}
        <div className="boards-new-row">
          {creating ? (
            <div className="boards-new-form">
              <input
                ref={inputRef}
                className="boards-new-input"
                value={title}
                placeholder={t("boards.namePlaceholder")}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createBoard(); if (e.key === "Escape") setCreating(false); }}
                maxLength={80}
                disabled={saving}
              />
              <button className="ws-new-btn" onClick={createBoard} disabled={saving}>{saving ? t("boards.creating") : t("boards.create")}</button>
              <button className="ws-new-btn ws-new-btn--ghost" onClick={() => setCreating(false)} disabled={saving}>{t("boards.cancel")}</button>
            </div>
          ) : (
            <button className="ws-new-btn boards-new-btn" onClick={startCreate}>{t("boards.new")}</button>
          )}
        </div>

        {/* Boards grid */}
        {boards.length === 0 ? (
          <div className="boards-empty">
            <p className="boards-empty-title">{t("boards.emptyTitle")}</p>
            <p className="boards-empty-body">{t("boards.emptyBody")}</p>
          </div>
        ) : (
          <div className="boards-grid">
            {boards.map((b) => (
              <Link key={b.id} href={`/workspaces/${workspaceId}/whiteboard/${b.id}`} className="board-card">
                <span className="board-card-icon">◇</span>
                <span className="board-card-title">{b.title}</span>
                <span className="board-card-date">{hydrated ? fmt(b.createdAt) : " "}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {settingsOpen && (
        <WorkspaceSettings
          workspaceId={workspaceId}
          workspaceName={wsName}
          workspaceType={workspace.type}
          membersCanManagePages={workspace.membersCanManagePages}
          currentUserId={workspace.ownerId}
          currentUserRole={role}
          onClose={() => setSettingsOpen(false)}
          initialIcon={(workspace as { icon?: string | null }).icon ?? null}
          onRenamed={(name) => { setWsName(name); setSettingsOpen(false); }}
          onDeleted={() => { setSettingsOpen(false); pushWithSplash(router, "/home"); }}
        />
      )}
      {modalOpen && <NewWorkspaceModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
