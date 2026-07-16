"use client";

/**
 * usePresence — broadcasts own presence and subscribes to the full presence map.
 *
 * Listens for "presence-sync" and "presence-leave" messages from the PartyKit
 * server and maintains a local map of { connectionId → PresenceData }.
 *
 * Sends "presence-update" whenever the caller changes its own data.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type PartySocket from "partysocket";
import type { PresenceData } from "@/party/index";

export type { PresenceData };

type PresenceMap = Record<string, PresenceData>;

// 18 distinct colours for user avatars / cursors
const PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#7c3aed", "#0284c7", "#d97706",
  "#16a34a", "#dc2626", "#9333ea",
];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

interface UsePresenceOptions {
  socket:     PartySocket | null;
  userId:     string;
  name:       string;
  mode:       "editor" | "canvas" | "split" | "board";
  mushafPage?: number | null;
}

interface UsePresenceReturn {
  /** All currently-online users, keyed by connection id */
  others:          PresenceData[];
  /** Update own presence fields and broadcast */
  updatePresence:  (patch: Partial<Pick<PresenceData, "mode" | "cursor" | "mushafPage">>) => void;
}

export function usePresence({
  socket,
  userId,
  name,
  mode,
  mushafPage = null,
}: UsePresenceOptions): UsePresenceReturn {
  const [presenceMap, setPresenceMap] = useState<PresenceMap>({});

  // Track own connectionId so we can exclude self from "others".
  // PartySocket generates its id client-side, so it's available immediately.
  const ownConnId = useRef<string | null>(null);
  useEffect(() => {
    ownConnId.current = (socket as (PartySocket & { id?: string }) | null)?.id ?? null;
  }, [socket]);

  // Current own presence — keep in ref so the send closure stays fresh
  const ownPresenceRef = useRef<PresenceData>({
    userId,
    name,
    color:      getUserColor(userId),
    mode,
    cursor:     null,
    mushafPage: mushafPage ?? null,
  });

  // Sync prop changes into the ref
  useEffect(() => {
    ownPresenceRef.current = {
      ...ownPresenceRef.current,
      userId,
      name,
      mode,
      mushafPage: mushafPage ?? null,
    };
  }, [userId, name, mode, mushafPage]);

  // Send own presence as soon as socket connects (or reconnects)
  useEffect(() => {
    if (!socket) return;

    function onOpen() {
      socket!.send(JSON.stringify({
        type: "presence-update",
        data: ownPresenceRef.current,
      }));
    }

    function onMessage(evt: MessageEvent) {
      if (typeof evt.data !== "string") return;
      let msg: { type: string; presence?: PresenceMap; connectionId?: string };
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === "presence-sync" && msg.presence) {
        setPresenceMap(msg.presence);
      }
      if (msg.type === "presence-leave" && msg.connectionId) {
        setPresenceMap((prev) => {
          const next = { ...prev };
          delete next[msg.connectionId!];
          return next;
        });
      }
    }

    socket.addEventListener("open",    onOpen);
    socket.addEventListener("message", onMessage);

    // If already open, send immediately
    if (socket.readyState === WebSocket.OPEN) onOpen();

    return () => {
      socket.removeEventListener("open",    onOpen);
      socket.removeEventListener("message", onMessage);
    };
  }, [socket]);

  // Re-broadcast when mode or mushafPage changes
  useEffect(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      type: "presence-update",
      data: ownPresenceRef.current,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mushafPage, socket]);

  const updatePresence = useCallback(
    (patch: Partial<Pick<PresenceData, "mode" | "cursor" | "mushafPage">>) => {
      ownPresenceRef.current = { ...ownPresenceRef.current, ...patch };
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "presence-update",
          data: ownPresenceRef.current,
        }));
      }
    },
    [socket],
  );

  // Exclude ONLY our own connection — other tabs/devices of the same user
  // still count as collaborators (Google-Docs behaviour). The old userId
  // filter made same-account testing in two windows show nothing.
  const others = Object.entries(presenceMap)
    .filter(([connId]) => connId !== ownConnId.current)
    .map(([, p]) => p);

  return { others, updatePresence };
}
