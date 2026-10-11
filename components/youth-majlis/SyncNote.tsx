"use client";

import { syncLine, useSyncStatus } from "./useLocal";

/** Where the student's progress is kept right now, with a way to sign in
 *  when it is only on this device. */
export default function SyncNote({ className = "" }: { className?: string }) {
  const s = useSyncStatus();
  const line = syncLine(s);
  if (!line) return null;
  return (
    <span className={`y-sync ${className}`} data-status={s}>
      <span className="y-sync-dot" aria-hidden />
      {line}
      {s === "local" && <> <a className="y-sync-link" href="/login">Sign in</a></>}
    </span>
  );
}
