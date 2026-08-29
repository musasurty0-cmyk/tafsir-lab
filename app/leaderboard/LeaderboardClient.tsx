"use client";

/**
 * LeaderboardClient — global and friends rankings.
 *
 * When the viewer has opted out of the public board, the page says so and
 * offers the switch rather than silently showing a list they are absent from.
 * A person looking for their own name and not finding it is a bug report
 * waiting to happen.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell, { type ShellStreak } from "@/components/AppShell";
import type { SidebarUser } from "@/components/AppSidebar";
import type { RankRow } from "@/lib/services/social.service";
import Avatar from "@/components/Avatar";

interface Props {
  user:        SidebarUser | null;
  isPublic:    boolean;
  initialRows: RankRow[];
  streak:      ShellStreak;
}

type Scope = "global" | "friends";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardClient({ user, isPublic, initialRows, streak }: Props) {
  const [scope, setScope] = useState<Scope>("global");
  const [rows, setRows]   = useState(initialRows);
  const [loading, setLoading] = useState(false);
  const [pub, setPub]     = useState(isPublic);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (scope === "global" && rows === initialRows) return;   // already have it
    let live = true;
    setLoading(true);
    fetch(`/api/leaderboard?scope=${scope}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rows?: RankRow[] } | null) => { if (live && d?.rows) setRows(d.rows); })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [scope, initialRows, rows]);

  async function togglePublic() {
    if (saving) return;
    const next = !pub;
    setPub(next); setSaving(true);
    const res = await fetch("/api/me", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicLeaderboard: next }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { setPub(!next); return; }
    // The global list changes membership when this flips.
    if (scope === "global") {
      const d = await fetch("/api/leaderboard?scope=global").then((r) => r.json()).catch(() => null);
      if (d?.rows) setRows(d.rows);
    }
  }

  return (
    <AppShell user={user} streak={streak}>
      <div className="an-tabs" role="tablist">
        {(["global", "friends"] as Scope[]).map((s) => (
          <button
            key={s} role="tab" aria-selected={scope === s}
            className="an-tab" data-active={scope === s ? "true" : "false"}
            onClick={() => setScope(s)}
          >
            {s === "global" ? "Everyone" : "Friends"}
          </button>
        ))}
      </div>

      {scope === "global" && !pub && (
        <section className="an-card an-notice">
          <p>
            You are hidden from the public board, so your name is not in this list.
          </p>
          <button className="an-btn an-btn--sm" onClick={togglePublic} disabled={saving}>
            {saving ? "…" : "Show me on the leaderboard"}
          </button>
        </section>
      )}

      <section className="an-card">
        {loading && rows.length === 0 ? (
          <p className="an-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="an-empty">
            <p className="an-empty-title">
              {scope === "friends" ? "No friends on the board yet" : "Nobody here yet"}
            </p>
            <p className="an-muted">
              {scope === "friends"
                ? <>Add someone on the <Link className="an-link" href="/friends">Friends</Link> page and you will both appear here.</>
                : "As people write annotations they will show up in this ranking."}
            </p>
          </div>
        ) : (
          <ol className="lb-list">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className="lb-row"
                data-self={r.isSelf ? "true" : "false"}
                style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}
              >
                <span className="lb-rank">{MEDAL[r.rank - 1] ?? r.rank}</span>
                <Avatar name={r.name} avatarUrl={r.avatarUrl} />
                <span className="fr-name">{r.name}{r.isSelf && <span className="lb-you"> you</span>}</span>
                <span className="lb-total">{r.total}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {scope === "global" && pub && (
        <p className="an-muted an-footnote">
          You are visible on this board.{" "}
          <button className="an-link" onClick={togglePublic} disabled={saving}>Hide me</button>
        </p>
      )}
    </AppShell>
  );
}
