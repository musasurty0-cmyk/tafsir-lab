"use client";

/**
 * NoWorkspacesScreen — shown on first run when the user has no workspaces.
 * Provides a real "Create workspace" action.
 */

import { useState } from "react";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";

export default function NoWorkspacesScreen() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="setup-screen">
        <div className="setup-card">
          <div className="setup-logo">T</div>
          <h1 className="setup-title">Welcome to TafsirLab</h1>
          <p className="setup-body">
            You don&apos;t have any workspaces yet. Create one to start studying.
          </p>
          <button
            className="ws-new-btn"
            style={{ width: "100%", marginTop: 8, padding: "10px 0", fontSize: 14 }}
            onClick={() => setModalOpen(true)}
          >
            + Create your first workspace
          </button>
        </div>
      </div>

      {modalOpen && <NewWorkspaceModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
