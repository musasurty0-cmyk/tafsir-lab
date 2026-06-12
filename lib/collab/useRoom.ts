"use client";

/**
 * useRoom — manages one PartySocket connection per page.
 *
 * The socket is created once on mount and torn down on unmount.
 * All consumers (usePresence, DrawingCanvas) share the same socket
 * instance via this hook.
 *
 * Room id = pageId (one room per workspace page).
 *
 * The socket is held in STATE (not a ref) so consumers re-render and
 * receive the instance once it exists — a ref would stay null in every
 * consumer that captured it on first render.
 */

import { useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import { PARTYKIT_HOST } from "./config";

export type RoomStatus = "connecting" | "connected" | "disconnected";

export interface Room {
  socket:  PartySocket | null;
  status:  RoomStatus;
  send:    (msg: object | ArrayBuffer) => void;
}

export function useRoom(pageId: string): Room {
  const [socket, setSocket] = useState<PartySocket | null>(null);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    if (!pageId) return;

    const s = new PartySocket({
      host:  PARTYKIT_HOST,
      room:  pageId,
      party: "main",
    });

    socketRef.current = s;
    setSocket(s);
    setStatus("connecting");

    const onOpen  = () => setStatus("connected");
    const onClose = () => setStatus("disconnected");
    s.addEventListener("open",  onOpen);
    s.addEventListener("close", onClose);
    s.addEventListener("error", onClose);

    return () => {
      s.removeEventListener("open",  onOpen);
      s.removeEventListener("close", onClose);
      s.removeEventListener("error", onClose);
      s.close();
      socketRef.current = null;
      setSocket(null);
    };
  }, [pageId]);

  function send(msg: object | ArrayBuffer) {
    const s = socketRef.current;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    if (msg instanceof ArrayBuffer) s.send(msg);
    else s.send(JSON.stringify(msg));
  }

  return { socket, status, send };
}
