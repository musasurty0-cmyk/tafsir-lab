"use client";

/**
 * ProgressControl — personal + group ayah progress buttons.
 *
 * Personal progress: any member can freely set any status.
 * Group progress:    members may only advance; admin+ can reverse.
 *                    Reversal buttons are disabled (not hidden) for members
 *                    so the permission model is transparent.
 *
 * Both controls are optimistic: the callback is called immediately,
 * the parent reverts on API error.
 */

import type { ProgressStatus } from "@/lib/services/progress.service";
import type { MemberRole } from "@/lib/services/workspaces.service";

const STATUS_RANK: Record<ProgressStatus, number> = {
  not_studied: 0,
  pending:     1,
  studied:     2,
};

const LABELS: Record<ProgressStatus, string> = {
  not_studied: "Not studied",
  pending:     "In progress",
  studied:     "Studied",
};

const STATUSES: ProgressStatus[] = ["not_studied", "pending", "studied"];

interface Props {
  surahNumber:    number;
  ayahNumber:     number;
  personalStatus: ProgressStatus | null;
  groupEntry:     { status: ProgressStatus; lastChangedBy: string } | null;
  role:           MemberRole;
  onPersonalChange: (status: ProgressStatus) => void;
  onGroupChange:    (status: ProgressStatus) => void;
}

function isAdmin(role: MemberRole) {
  return role === "owner" || role === "admin";
}

function StatusButton({
  status,
  current,
  disabled,
  onClick,
}: {
  status:   ProgressStatus;
  current:  ProgressStatus | null;
  disabled?: boolean;
  onClick:  () => void;
}) {
  const isActive = status === current;
  return (
    <button
      className="prog-btn"
      data-status={status}
      data-active={isActive ? "true" : "false"}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={isActive}
      title={disabled ? "Members cannot reverse group progress" : undefined}
    >
      {/* The word, not a dash, a ring and a tick: nobody could tell which
          mark meant "in progress" without hovering, and a finger cannot hover. */}
      {LABELS[status]}
    </button>
  );
}

export default function ProgressControl({
  personalStatus,
  groupEntry,
  role,
  onPersonalChange,
  onGroupChange,
}: Props) {
  const groupStatus = groupEntry?.status ?? null;
  const admin = isAdmin(role);

  return (
    <div className="progress-control">
      {/* Personal */}
      <div className="prog-row">
        <span className="prog-label">You</span>
        <div className="prog-btns" role="group" aria-label="Your progress">
          {STATUSES.map((s) => (
            <StatusButton
              key={s}
              status={s}
              current={personalStatus}
              onClick={() => onPersonalChange(s)}
            />
          ))}
        </div>
      </div>

      {/* Group */}
      <div className="prog-row">
        <span className="prog-label">Group</span>
        <div className="prog-btns" role="group" aria-label="The group's progress">
          {STATUSES.map((s) => {
            // Members: disable if this status would be a regression.
            const wouldRegress =
              groupStatus !== null &&
              STATUS_RANK[s] < STATUS_RANK[groupStatus];
            const disabled = !admin && wouldRegress;
            return (
              <StatusButton
                key={s}
                status={s}
                current={groupStatus}
                disabled={disabled}
                onClick={() => onGroupChange(s)}
              />
            );
          })}
        </div>
        {/* "Last changed by" used to follow here, but it printed the first
            eight characters of an account id, which tells a reader nothing. */}
      </div>
    </div>
  );
}
