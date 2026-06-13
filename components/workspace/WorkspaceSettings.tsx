"use client";

import { useState, useEffect } from "react";
import { X, Copy, RefreshCw, Check } from "lucide-react";
import type { MemberRole } from "@/lib/services/workspaces.service";

interface Member {
  workspaceId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
}

interface Props {
  workspaceId: string;
  workspaceName: string;
  workspaceType: string;
  membersCanManagePages: boolean;
  currentUserId: string;
  currentUserRole: MemberRole;
  onClose: () => void;
  onRenamed: (name: string) => void;
  onDeleted: () => void;
}

function getInitials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function WorkspaceSettings({
  workspaceId,
  workspaceName,
  workspaceType,
  membersCanManagePages: initialMembersCanManagePages,
  currentUserId,
  currentUserRole,
  onClose,
  onRenamed,
  onDeleted,
}: Props) {
  const isAdminOrOwner = currentUserRole === "owner" || currentUserRole === "admin";
  const isOwner = currentUserRole === "owner";

  // Permission policy toggle (admins)
  const [membersManage, setMembersManage] = useState(initialMembersCanManagePages);
  const [permSaving, setPermSaving] = useState(false);

  async function toggleMembersManage() {
    const next = !membersManage;
    setMembersManage(next); // optimistic
    setPermSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membersCanManagePages: next }),
      });
      if (!res.ok) setMembersManage(!next); // revert on failure
    } catch {
      setMembersManage(!next);
    } finally {
      setPermSaving(false);
    }
  }

  // Members
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  // Invite code
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Rename
  const [nameInput, setNameInput] = useState(workspaceName);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Action errors
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setMembersLoading(true);
    fetch(`/api/workspaces/${workspaceId}/members`)
      .then((r) => r.json())
      .then((d: { members?: Member[] }) => { if (d.members) setMembers(d.members); })
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceType === "group" && isAdminOrOwner) {
      setInviteLoading(true);
      fetch(`/api/workspaces/${workspaceId}/invite`)
        .then((r) => r.json())
        .then((d: { code?: string }) => { if (d.code) setInviteCode(d.code); })
        .catch(() => {})
        .finally(() => setInviteLoading(false));
    }
  }, [workspaceId, workspaceType, isAdminOrOwner]);

  async function handleRename() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === workspaceName) return;
    setRenameSaving(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setRenameError(d.error ?? "Failed to rename");
      } else {
        onRenamed(trimmed);
      }
    } catch {
      setRenameError("Network error");
    } finally {
      setRenameSaving(false);
    }
  }

  async function handleRegenerateCode() {
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, { method: "POST" });
      const d = await res.json() as { code?: string };
      if (d.code) setInviteCode(d.code);
    } catch { /* silent */ }
    finally { setInviteLoading(false); }
  }

  async function handleCopyCode() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRoleChange(targetUserId: string, newRole: "admin" | "member") {
    setActionError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${targetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setActionError(d.error ?? "Failed to update role");
        return;
      }
      setMembers((prev) =>
        prev.map((m) => m.userId === targetUserId ? { ...m, role: newRole } : m)
      );
    } catch { setActionError("Network error"); }
  }

  async function handleRemoveMember(targetUserId: string) {
    setActionError(null);
    const isSelf = targetUserId === currentUserId;
    const endpoint = `/api/workspaces/${workspaceId}/members/${targetUserId}`;
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setActionError(d.error ?? "Failed to remove member");
        return;
      }
      if (isSelf) {
        onDeleted(); // navigate away — user left
      } else {
        setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
      }
    } catch { setActionError("Network error"); }
  }

  async function handleDeleteWorkspace() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setActionError(d.error ?? "Failed to delete");
        setDeleting(false);
        setConfirmDelete(false);
        return;
      }
      onDeleted();
    } catch {
      setActionError("Network error");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function roleBadgeClass(role: string) {
    if (role === "owner")  return "ws-settings-member-role ws-settings-member-role--owner";
    if (role === "admin")  return "ws-settings-member-role ws-settings-member-role--admin";
    return "ws-settings-member-role ws-settings-member-role--member";
  }

  return (
    <div className="ws-settings-overlay" onClick={onClose}>
      <div className="ws-settings-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="ws-settings-header">
          <span style={{ fontWeight: 600, fontSize: 15 }}>Workspace Settings</span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", display: "flex", alignItems: "center" }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* General — rename (admin/owner only) */}
        {isAdminOrOwner && (
          <div className="ws-settings-section">
            <div className="ws-settings-section-title">General</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{
                  flex: 1,
                  border: "1px solid var(--line-strong)",
                  borderRadius: "var(--radius)",
                  padding: "6px 10px",
                  fontSize: 14,
                  background: "var(--bg)",
                  color: "var(--ink)",
                }}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
                maxLength={80}
                disabled={renameSaving}
              />
              <button
                onClick={handleRename}
                disabled={renameSaving || !nameInput.trim() || nameInput.trim() === workspaceName}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  borderRadius: "var(--radius)",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  opacity: renameSaving ? 0.6 : 1,
                }}
              >
                {renameSaving ? "Saving…" : "Rename"}
              </button>
            </div>
            {renameError && (
              <p style={{ color: "oklch(0.55 0.18 25)", fontSize: 12, marginTop: 4 }}>{renameError}</p>
            )}
          </div>
        )}

        {/* Invite code (group + admin/owner) */}
        {workspaceType === "group" && isAdminOrOwner && (
          <div className="ws-settings-section">
            <div className="ws-settings-section-title">Invite Code</div>
            <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>
              Share this code to invite people to this workspace.
            </p>
            <div className="ws-settings-invite-box">
              <span className="ws-settings-invite-code">
                {inviteLoading ? "Loading…" : (inviteCode ?? "—")}
              </span>
              <button
                title="Copy code"
                onClick={handleCopyCode}
                disabled={!inviteCode}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", display: "flex", alignItems: "center" }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <button
                title="Regenerate code"
                onClick={handleRegenerateCode}
                disabled={inviteLoading}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", display: "flex", alignItems: "center" }}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Permissions — role capability matrix + member-page toggle */}
        <div className="ws-settings-section">
          <div className="ws-settings-section-title">Permissions</div>
          <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>
            What each role can do in this {workspaceType === "group" ? "group" : "workspace"}.
          </p>
          <div className="ws-perm-grid">
            <div className="ws-perm-row ws-perm-row--head">
              <span>Capability</span>
              <span className="ws-perm-col">Admin</span>
              <span className="ws-perm-col">Member</span>
            </div>
            {[
              { label: "Create, rename & delete pages", admin: true, member: membersManage },
              { label: "Start new surah boards",         admin: true, member: false },
              { label: "Invite & manage members",        admin: true, member: false },
              { label: "Write page content & notes",     admin: true, member: true  },
              { label: "Draw & add text boxes",          admin: true, member: true  },
              { label: "Track reading progress",         admin: true, member: true  },
            ].map((cap) => (
              <div key={cap.label} className="ws-perm-row">
                <span>{cap.label}</span>
                <span className="ws-perm-col">{cap.admin ? "✓" : "—"}</span>
                <span className={`ws-perm-col${cap.member ? "" : " ws-perm-col--no"}`}>
                  {cap.member ? "✓" : "—"}
                </span>
              </div>
            ))}
          </div>

          {/* Admin toggle: extend page management to members */}
          {isAdminOrOwner && (
            <label className="ws-perm-toggle">
              <span className="ws-perm-toggle-text">
                <span className="ws-perm-toggle-label">Let members manage pages</span>
                <span className="ws-perm-toggle-sub">
                  Members can create, rename & delete pages — not just admins.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={membersManage}
                className="ws-switch"
                data-on={membersManage ? "true" : "false"}
                onClick={toggleMembersManage}
                disabled={permSaving}
              >
                <span className="ws-switch-knob" />
              </button>
            </label>
          )}
        </div>

        {/* Members */}
        <div className="ws-settings-section">
          <div className="ws-settings-section-title">
            Members {!membersLoading && `(${members.length})`}
          </div>
          {actionError && (
            <p style={{ color: "oklch(0.55 0.18 25)", fontSize: 12, marginBottom: 8 }}>{actionError}</p>
          )}
          {membersLoading ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)" }}>Loading…</p>
          ) : (
            <div>
              {members.map((m) => {
                const isSelf = m.userId === currentUserId;
                const canChangeRole = isOwner && m.role !== "owner";
                const canRemove = (isAdminOrOwner && m.role !== "owner" && !isSelf) || isSelf;

                return (
                  <div key={m.userId} className="ws-settings-member-row">
                    <div className="ws-settings-member-avatar">
                      {m.user.avatarUrl
                        ? <img src={m.user.avatarUrl} alt={m.user.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                        : getInitials(m.user.name)
                      }
                    </div>
                    <div className="ws-settings-member-info" style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                        {m.user.name}{isSelf && " (you)"}
                      </span>
                    </div>
                    <span className={roleBadgeClass(m.role)}>{m.role}</span>
                    <div className="ws-settings-member-actions">
                      {canChangeRole && (
                        <button
                          onClick={() => handleRoleChange(m.userId, m.role === "admin" ? "member" : "admin")}
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: "var(--radius)",
                            border: "1px solid var(--line-strong)",
                            background: "none",
                            cursor: "pointer",
                            color: "var(--ink-2)",
                          }}
                        >
                          {m.role === "admin" ? "Demote" : "Promote"}
                        </button>
                      )}
                      {canRemove && (
                        <button
                          onClick={() => handleRemoveMember(m.userId)}
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: "var(--radius)",
                            border: "1px solid var(--line-strong)",
                            background: "none",
                            cursor: "pointer",
                            color: isSelf ? "var(--ink-2)" : "oklch(0.55 0.18 25)",
                          }}
                        >
                          {isSelf ? "Leave" : "Remove"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Danger zone — owner only */}
        {isOwner && (
          <div className="ws-settings-danger">
            <div className="ws-settings-section-title" style={{ color: "oklch(0.55 0.18 25)" }}>Danger Zone</div>
            <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>
              Permanently delete this workspace and all its data.
            </p>
            <button
              onClick={handleDeleteWorkspace}
              disabled={deleting}
              style={{
                padding: "7px 16px",
                fontSize: 13,
                borderRadius: "var(--radius)",
                background: confirmDelete ? "oklch(0.55 0.18 25)" : "none",
                color: confirmDelete ? "#fff" : "oklch(0.55 0.18 25)",
                border: "1px solid oklch(0.55 0.18 25)",
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {deleting ? "Deleting…" : confirmDelete ? "Confirm — delete workspace" : "Delete workspace"}
            </button>
            {confirmDelete && !deleting && (
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  marginLeft: 8,
                  fontSize: 12,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-3)",
                }}
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
