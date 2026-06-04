"use client";

/**
 * useRoom — manages one PartySocket connection per page.
 *
 * The socket is created once on mount and torn down on unmount.
 * All consumers (usePresence, DrawingCanvas, PageEditor) share the
 * same socket instance via this hook.
 *
 * Room id = pageId (one room per workspace page).
 */

import { useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";

export type RoomStatus = "connecting" | "connected" | "disconnected";

export interface Room {
  socket:  PartySocket;
  status:  RoomStatus;
  send:    (msg: object | ArrayBuffer) => void;
}

const PARTYKIT_HOST =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999")
    : "localhost:1999";

export function useRoom(pageId: string): Room {
  const socketRef = useRef<PartySocket | null>(null);
  const [status, setStatus] = useState<RoomStatus>("connecting");

  useEffect(() => {
    const socket = new PartySocket({
      host:  PARTYKIT_HOST,
      room:  pageId,
      // Use wss in production, ws in local dev
      party: "main",
    });

    socketRef.current = socket;
    setStatus("connecting");

    socket.addEventListener("open",  () => setStatus("connected"));
    socket.addEventListener("close", () => setStatus("disconnected"));
    socket.addEventListener("error", () => setStatus("disconnected"));

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [pageId]);

  function send(msg: object | ArrayBuffer) {
    const s = socketRef.current;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    if (msg instanceof ArrayBuffer) {
      s.send(msg);
    } else {
      s.send(JSON.stringify(msg));
    }
  }

  return {
    socket: socketRef.current as PartySocket,
    status,
    send,
  };
}
