"use client";

/**
 * HadithHome — the forty-two, as the home screen of a Nawawi workspace.
 *
 * The same idea as the sūrah grid and deliberately the same furniture (rail,
 * header, cards, started/unstarted state), because a reader who has studied a
 * sūrah here should not have to learn a second app to study a hadith. What
 * differs is what a card can usefully say: a sūrah is known by its name, so
 * its card is a name and a count; a hadith is known by its content, so its
 * card carries the opening words of the narration under a short title.
 *
 * Numbers 1–42, not 1–40. The collection is called "the Forty" and an-Nawawi
 * included forty-two; the extra two are part of it, not an appendix, so they
 * are on the grid like everything else.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MemberRole } from "@/lib/services/workspaces.service";
import { HADITHS, HADITH_COUNT, COLLECTION_ARABIC, preview } from "@/lib/hadith";
import WorkspaceSettings from "./WorkspaceSettings";
import Rail from "./Rail";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";
import { useT } from "@/lib/i18n/LocaleProvider";

/** What the server knows about hadith that have been opened before. */
export interface HadithSessionSummary {
  hadithNumber: number;
  pageCount: number;
  firstPageId: string | null;
}

interface Props {
  workspaceId: string;
  currentUserId: string;
  workspace: { id: string; name: string; type: string; kind: string; ownerId: string; membersCanManagePages: boolean };
  role: MemberRole;
  sessions: HadithSessionSummary[];
}

export default function HadithHome({ workspaceId, currentUserId, workspace, role, sessions }: Props) {
  const router = useRouter();
  const t = useT();

  useLayoutEffect(() => {
    document.getElementById("tl-nav-splash")?.remove();
    document.getElementById("tl-nav-splash-style")?.remove();
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [wsName, setWsName] = useState(workspace.name);
  const [renaming, setRenaming] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  /* The card that was clicked, so it can show it is working. Opening a hadith
     for the first time creates its session and its first page, which is a
     round trip the reader should see acknowledged. */
  const [opening, setOpening] = useState<number | null>(null);

  const started = new Map(sessions.map((s) => [s.hadithNumber, s]));

  async function open(n: number) {
    if (opening !== null) return;
    const existing = started.get(n);
    if (existing?.firstPageId) {
      pushWithSplash(router, `/workspaces/${workspaceId}/hadith/${n}/pages/${existing.firstPageId}`);
      return;
    }
    setOpening(n);
    try {
      /* The session and its first page are made server-side so that opening a
         hadith is one decision, not a form. Same as starting a sūrah. */
      const res = await fetch(`/api/workspaces/${workspaceId}/hadith/${n}/start`, { method: "POST" });
      const data = await res.json().catch(() => null) as { pageId?: string } | null;
      if (data?.pageId) {
        pushWithSplash(router, `/workspaces/${workspaceId}/hadith/${n}/pages/${data.pageId}`);
        return;
      }
      setOpening(null);
    } catch {
      setOpening(null);
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

  const studied = sessions.filter((s) => s.pageCount > 0).length;

  return (
    <div className="workspace-home">
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") { setWsName(workspace.name); setRenaming(false); }
                }}
                maxLength={80}
              />
            ) : (
              <h1
                className="ws-home-name"
                onClick={() => { if (role === "owner") { setRenaming(true); setTimeout(() => nameInputRef.current?.select(), 0); } }}
                title={role === "owner" ? "Click to rename" : undefined}
                style={{ cursor: role === "owner" ? "text" : "default" }}
              >
                {wsName} <span className="ws-home-kind-badge">{COLLECTION_ARABIC}</span>
              </h1>
            )}
            <p className="ws-home-sub">
              {studied > 0
                ? `${studied} of ${HADITH_COUNT} studied`
                : `${HADITH_COUNT} hadith · collected by Imam an-Nawawi`}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="ws-new-btn ws-new-btn--ghost" onClick={() => pushWithSplash(router, `/workspaces/${workspaceId}/notes`)}>{t("ws.notes")}</button>
            <button className="ws-new-btn ws-new-btn--ghost" onClick={() => setSettingsOpen(true)}>{t("ws.settings")}</button>
            <button className="ws-new-btn" onClick={() => setModalOpen(true)}>{t("ws.newWorkspace")}</button>
          </div>
        </div>

        <div className="hd-grid">
          {HADITHS.map((h) => {
            const s = started.get(h.number);
            const isOpening = opening === h.number;
            return (
              <button
                key={h.number}
                type="button"
                className="hd-card"
                data-started={s && s.pageCount > 0 ? "true" : "false"}
                data-busy={isOpening ? "true" : "false"}
                disabled={opening !== null}
                onClick={() => open(h.number)}
              >
                <span className="hd-num">{h.number}</span>
                <span className="hd-body">
                  <span className="hd-title">{h.title}</span>
                  {/* The opening words, in English only — a truncated Arabic
                      narration reads as a misquotation. */}
                  <span className="hd-preview">{preview(h, 96)}</span>
                </span>
                <span className="hd-meta">
                  {isOpening
                    ? "Opening…"
                    : s && s.pageCount > 0
                      ? `${s.pageCount} page${s.pageCount === 1 ? "" : "s"}`
                      : h.reference ?? ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {settingsOpen && (
        <WorkspaceSettings
          workspaceId={workspaceId}
          workspaceName={wsName}
          workspaceType={workspace.type}
          membersCanManagePages={workspace.membersCanManagePages}
          currentUserId={currentUserId}
          currentUserRole={role}
          onClose={() => setSettingsOpen(false)}
          onRenamed={(n) => setWsName(n)}
          onDeleted={() => { window.location.href = "/home"; }}
        />
      )}
      {modalOpen && <NewWorkspaceModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
