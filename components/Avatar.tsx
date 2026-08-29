"use client";

/**
 * Avatar — a picture if there is one that loads, initials otherwise.
 *
 * The onError fallback is the point. A stored avatarUrl can stop resolving at
 * any time — a Google photo URL expires, a host blocks the referrer, the user
 * is offline — and a bare <img> then paints the browser's broken-image glyph,
 * which looks like the app is broken rather than like a missing photo. Falling
 * back to initials means the row still reads correctly in every one of those
 * cases.
 */

import { useState } from "react";

interface Props {
  name:      string;
  avatarUrl?: string | null;
  className?: string;
  /** Rendered instead of initials when there is no name to derive them from. */
  fallback?:  string;
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function Avatar({ name, avatarUrl, className = "fr-avatar", fallback }: Props) {
  /* The URL that failed, not a boolean. A new URL then retries on its own,
     because `failed === avatarUrl` is false again — where a boolean would stay
     true and keep showing initials forever, including after the user uploads a
     working photo. No effect required to reset it. */
  const [failed, setFailed] = useState<string | null>(null);

  if (!avatarUrl || failed === avatarUrl) {
    return <span className={className}>{fallback ?? initials(name)}</span>;
  }
  return (
    <img
      src={avatarUrl}
      alt=""
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setFailed(avatarUrl)}
    />
  );
}
