"use client";

/**
 * Rail — leftmost vertical navigation column.
 *
 * Contains only elements that do something:
 *   • Logo → home "/"
 *   • Home icon → active workspace home
 *   • Workspace switcher (one button per workspace)
 *   • "+" → create new workspace (opens modal)
 *
 * Dead buttons (Library, Search, Inbox, Settings, account avatar)
 * have been removed. Nothing is disabled here.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { workspaceInitials, workspaceTone } from "@/lib/workspace-icon";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";

// ── Icons ─────────────────────────────────────────────────────────────────

const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5"  y1="12" x2="19" y2="12"/>
  </svg>
);

// ── Types ─────────────────────────────────────────────────────────────────

interface WorkspaceItem {
  id:   string;
  name: string;
  type: string;
  /** Assigned glyph. Null falls back to the workspace's initials. */
  icon?: string | null;
}

interface Props {
  activeWorkspaceId: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function Rail({ activeWorkspaceId }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [modalOpen,  setModalOpen]  = useState(false);

  // Home is "active" when on the /home route
  const isHome = pathname === "/home";

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { workspaces?: WorkspaceItem[] } | null) => {
        if (data?.workspaces) setWorkspaces(data.workspaces);
      })
      .catch(() => {});
  }, []);



  return (
    <>
      <nav className="rail" aria-label="Main navigation">
        {/* Logo → /home */}
        <button
          className="rail-logo"
          title="TafsirLab"
          onClick={() => pushWithSplash(router, "/home")}
        >
          T
        </button>

        {/* Home → /home (exits workspace context) */}
        <button
          className="rail-btn"
          data-active={isHome ? "true" : "false"}
          title="Home"
          onClick={() => pushWithSplash(router, "/home")}
        >
          <HomeIcon />
        </button>

        <div className="rail-divider" />

        {/* Workspace switcher */}
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            className="rail-ws"
            data-active={ws.id === activeWorkspaceId ? "true" : "false"}
            title={ws.name}
            /* A tone per workspace so several of them stay distinguishable at
               a glance, even when all are showing initials. */
            data-tone={workspaceTone(ws.id, ws.name)}
            onClick={() => pushWithSplash(router, `/workspaces/${ws.id}`)}
          >
            {/* Initials, always. Workspaces used to be given an emoji at
                creation; a rail of glyphs read as decoration rather than as
                navigation, and the letters of the name are what people
                actually recognise. The stored column is ignored. */}
            {workspaceInitials(ws.name)}
          </button>
        ))}

        {/* Create new workspace */}
        <button
          className="rail-btn rail-btn--add"
          title="New workspace"
          onClick={() => setModalOpen(true)}
        >
          <PlusIcon />
        </button>
      </nav>

      {modalOpen && (
        <NewWorkspaceModal onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
