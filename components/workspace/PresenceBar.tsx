"use client";

/**
 * PresenceBar — shows who is currently online on this page.
 *
 * Receives the live `others` array from usePresence (PartyKit-backed).
 * Renders coloured avatar circles; hovering shows name + mode tooltip.
 */

import { useState } from "react";
import type { PresenceData } from "@/lib/collab/usePresence";

function EditorIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  );
}

function CanvasIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function Avatar({ user, index }: { user: PresenceData; index: number }) {
  const [hovered, setHovered] = useState(false);
  const initials =
    user.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div
      className="presence-avatar-wrap"
      style={{ zIndex: 10 - index }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="presence-avatar"
        style={{ background: user.color, borderColor: "var(--bg)" }}
      >
        {initials}
        <span className="presence-mode-badge">
          {user.mode === "canvas" ? <CanvasIcon /> : <EditorIcon />}
        </span>
      </div>

      {hovered && (
        <div className="presence-tooltip">
          <span className="presence-tooltip-name">{user.name}</span>
          <span className="presence-tooltip-mode">
            {user.mode === "canvas" ? "Canvas" : user.mode === "split" ? "Split" : "Editor"}
          </span>
        </div>
      )}
    </div>
  );
}

interface Props {
  others: PresenceData[];
}

export default function PresenceBar({ others }: Props) {
  if (others.length === 0) return null;

  const visible  = others.slice(0, 5);
  const overflow = others.length - 5;

  return (
    <div className="presence-bar">
      {visible.map((u, i) => (
        <Avatar key={u.userId} user={u} index={i} />
      ))}
      {overflow > 0 && (
        <div
          className="presence-avatar presence-avatar--overflow"
          style={{ zIndex: 0, borderColor: "var(--bg)" }}
          title={`${overflow} more online`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
