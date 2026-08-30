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
import { getCollabToken } from "./collab-token";

export type RoomStatus = "connecting" | "connected" | "disconnected";

export interface Room {
  socket:  PartySocket | null;
  status:  RoomStatus;
  /** Increments on every (re)connection — consumers watch this to re-sync
   *  persisted state after the socket comes back from a drop. */
  epoch:   number;
  send:    (msg: object | ArrayBuffer) => void;
}

// Heartbeat tuning: ping cadence and how long silence is tolerated before we
// decide the (possibly half-open) socket is dead and force a reconnect.
const PING_MS  = 20000;
const STALE_MS = 45000;

export function useRoom(pageId: string): Room {
  const [socket, setSocket] = useState<PartySocket | null>(null);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [epoch,  setEpoch]  = useState(0);
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    if (!pageId) return;

    const s = new PartySocket({
      host:  PARTYKIT_HOST,
      room:  pageId,
      party: "main",
      /* Same gate as the Yjs provider: the party rejects any socket without a
         valid page-scoped token. `query` is re-evaluated on every reconnect,
         so each carries a fresh 2-minute token from the membership-gated
         endpoint. */
      query: async () => ({ token: await getCollabToken(pageId) }),
    });

    socketRef.current = s;
    setSocket(s);
    setStatus("connecting");

    // Last time we heard ANYTHING from the server (pong, presence, stroke…).
    let lastRecv = Date.now();

    const onOpen  = () => { lastRecv = Date.now(); setStatus("connected"); setEpoch((e) => e + 1); };
    const onClose = () => setStatus("disconnected");
    const onMsg   = () => { lastRecv = Date.now(); };
    s.addEventListener("open",    onOpen);
    s.addEventListener("close",   onClose);
    s.addEventListener("error",   onClose);
    s.addEventListener("message", onMsg);

    // Heartbeat: ping regularly and, if the server has gone silent past the
    // stale window (a half-open socket that never fired "close"), force a
    // reconnect. This is what stops "sync worked, then quietly stopped until
    // a manual refresh" — the dead socket is now detected and replaced.
    const beat = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (s.readyState === WebSocket.OPEN) {
        try { s.send(JSON.stringify({ type: "ping" })); } catch { /* ignore */ }
        if (now - lastRecv > STALE_MS) {
          lastRecv = now;               // avoid rapid reconnect storms
          setStatus("connecting");
          try { s.reconnect(); } catch { /* already reconnecting */ }
        }
      } else if (s.readyState !== WebSocket.CONNECTING) {
        setStatus("connecting");
        try { s.reconnect(); } catch { /* already reconnecting */ }
      }
    }, PING_MS);

    // iOS/iPadOS suspends background tabs and kills the WebSocket. When the
    // student returns (e.g. after checking a translation app mid-lesson),
    // reconnect immediately instead of waiting for the backoff timer.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (s.readyState !== WebSocket.OPEN) {
        setStatus("connecting");
        try { s.reconnect(); } catch { /* already reconnecting */ }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(beat);
      document.removeEventListener("visibilitychange", onVisible);
      s.removeEventListener("open",    onOpen);
      s.removeEventListener("close",   onClose);
      s.removeEventListener("error",   onClose);
      s.removeEventListener("message", onMsg);
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

  return { socket, status, epoch, send };
}
