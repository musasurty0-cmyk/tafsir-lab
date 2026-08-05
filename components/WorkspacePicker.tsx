"use client";

import { useState } from "react";
import Link from "next/link";
import type { MemberRole } from "@/lib/services/workspaces.service";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";

interface Workspace {
  id:        string;
  name:      string;
  type:      string;
  avatarUrl: string | null;
  role:      MemberRole;
  _count:    { members: number; surahs: number };
}

export default function WorkspacePicker({ workspaces }: { workspaces: Workspace[] }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="setup-screen">
        <div className="picker-card">
          <div className="setup-logo">T</div>
          <h1 className="setup-title">Your workspaces</h1>
          <p className="setup-body" style={{ marginBottom: 20 }}>
            You belong to {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}.
          </p>

          <div className="picker-list">
            {workspaces.map((ws) => (
              <Link key={ws.id} href={`/workspaces/${ws.id}`} className="picker-item">
                <div className="picker-avatar">
                  {ws.avatarUrl
                     
                    ? <img src={ws.avatarUrl} alt={ws.name} width={36} height={36} />
                    : ws.name.slice(0, 2).toUpperCase()
                  }
                </div>
                <div className="picker-info">
                  <div className="picker-name">{ws.name}</div>
                  <div className="picker-meta">
                    <span className={`ws-type-badge ws-type-badge--${ws.type}`} style={{ fontSize: 10, padding: "1px 6px" }}>
                      {ws.type === "private" ? "Private" : "Group"}
                    </span>
                    {" · "}
                    {ws._count.members} member{ws._count.members !== 1 ? "s" : ""}
                    {" · "}
                    {ws._count.surahs} surah{ws._count.surahs !== 1 ? "s" : ""}
                    {" · "}
                    <span style={{ textTransform: "capitalize" }}>{ws.role}</span>
                  </div>
                </div>
                <div className="picker-arrow">→</div>
              </Link>
            ))}
          </div>

          <button
            className="ws-new-btn"
            style={{ marginTop: 20, width: "100%" }}
            onClick={() => setModalOpen(true)}
          >
            + New workspace
          </button>
        </div>
      </div>

      {modalOpen && <NewWorkspaceModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
