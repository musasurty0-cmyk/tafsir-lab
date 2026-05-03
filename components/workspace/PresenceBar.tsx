"use client";
import { useState, useEffect } from "react";

interface PresenceUser {
  id: string;
  isTyping: boolean;
  userId: string;
  user: { id: string; name: string; avatarUrl: string | null };
}

interface Props {
  pageId: string;
  currentUserId: string;
}

export default function PresenceBar({ pageId, currentUserId }: Props) {
  const [presence, setPresence] = useState<PresenceUser[]>([]);

  // Ping presence every 20s to keep self alive
  useEffect(() => {
    if (!pageId) return;
    const ping = () =>
      fetch(`/api/pages/${pageId}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTyping: false }),
      }).catch(() => {});
    ping();
    const interval = setInterval(ping, 20_000);
    return () => clearInterval(interval);
  }, [pageId]);

  // Poll others' presence every 8s
  useEffect(() => {
    if (!pageId) return;
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/pages/${pageId}/presence`)
        .then((r) => r.ok ? r.json() : null)
        .then((data: { presence?: PresenceUser[] } | null) => {
          if (data?.presence) setPresence(data.presence);
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 8_000);
    return () => clearInterval(interval);
  }, [pageId]);

  const others = presence.filter((p) => p.user?.id !== currentUserId);
  if (others.length === 0) return null;

  const typing = others.filter((p) => p.isTyping);
  const typingNames = typing.map((p) => p.user.name.split(" ")[0]);

  return (
    <div className="presence-bar">
      <div className="presence-avatars">
        {others.slice(0, 5).map((p) => {
          const initials = p.user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <div key={p.user.id} className="presence-avatar" title={p.user.name}>
              {p.user.avatarUrl ? (
                <img src={p.user.avatarUrl} alt={p.user.name} />
              ) : (
                initials
              )}
            </div>
          );
        })}
      </div>
      {typing.length > 0 && (
        <span className="presence-typing">
          {typingNames.length === 1
            ? `${typingNames[0]} is typing…`
            : `${typingNames.slice(0, -1).join(", ")} and ${typingNames.at(-1)} are typing…`}
        </span>
      )}
    </div>
  );
}
