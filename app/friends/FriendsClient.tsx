"use client";

/**
 * FriendsClient — search, requests, and the friend list.
 *
 * Optimistic on every action: adding, accepting and removing all update the
 * list before the server answers and roll back if it refuses. A social action
 * that takes a visible beat to appear feels broken in a way a slow page does
 * not.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, UserPlus, Check, X, Trash2 } from "lucide-react";
import AppShell, { type ShellStreak } from "@/components/AppShell";
import type { SidebarUser } from "@/components/AppSidebar";
import type { FriendEdge, PublicUser } from "@/lib/services/social.service";
import Toast from "@/components/Toast";
import Avatar from "@/components/Avatar";

interface Props {
  user:           SidebarUser | null;
  initialFriends: FriendEdge[];
  streak:         ShellStreak;
}

export default function FriendsClient({ user, initialFriends, streak }: Props) {
  const [friends, setFriends] = useState(initialFriends);
  const [q, setQ]             = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [toast, setToast]     = useState<string | null>(null);

  const accepted = friends.filter((f) => f.status === "accepted");
  const incoming = friends.filter((f) => f.status === "pending" && f.incoming);
  const outgoing = friends.filter((f) => f.status === "pending" && !f.incoming);

  // Debounced search. The ref holds the in-flight term so a slow early
  // response cannot overwrite the results of a later, faster one.
  const latest = useRef("");
  useEffect(() => {
    const term = q.trim();
    latest.current = term;
    if (term.length < 2) { setResults([]); setSearching(false); return; }

    setSearching(true);
    const id = setTimeout(() => {
      fetch(`/api/friends?q=${encodeURIComponent(term)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { results?: PublicUser[] } | null) => {
          if (latest.current !== term) return;
          setResults(d?.results ?? []);
        })
        .catch(() => {})
        .finally(() => { if (latest.current === term) setSearching(false); });
    }, 280);
    return () => clearTimeout(id);
  }, [q]);

  const add = useCallback(async (p: PublicUser) => {
    setResults((r) => r.filter((x) => x.id !== p.id));
    const optimistic: FriendEdge = { ...p, status: "pending", incoming: false, since: new Date().toISOString() };
    setFriends((f) => [optimistic, ...f]);

    const res = await fetch("/api/friends", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: p.id }),
    }).catch(() => null);

    if (!res?.ok) {
      setFriends((f) => f.filter((x) => x.id !== p.id));
      setToast("Could not send that request.");
      return;
    }
    const d = await res.json().catch(() => null) as { status?: string } | null;
    if (d?.status === "accepted") {
      setFriends((f) => f.map((x) => (x.id === p.id ? { ...x, status: "accepted" } : x)));
      setToast(`You and ${p.name} are now friends.`);
    }
  }, []);

  const respond = useCallback(async (p: FriendEdge, accept: boolean) => {
    const before = friends;
    setFriends((f) => accept
      ? f.map((x) => (x.id === p.id ? { ...x, status: "accepted" as const } : x))
      : f.filter((x) => x.id !== p.id));

    const res = await fetch("/api/friends", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherId: p.id, accept }),
    }).catch(() => null);

    if (!res?.ok) { setFriends(before); setToast("That didn't go through."); }
  }, [friends]);

  const remove = useCallback(async (p: FriendEdge) => {
    const before = friends;
    setFriends((f) => f.filter((x) => x.id !== p.id));
    const res = await fetch(`/api/friends?id=${p.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { setFriends(before); setToast("Could not remove them."); }
  }, [friends]);

  return (
    <AppShell user={user} streak={streak}>
      <section className="an-card">
        <h2 className="an-card-title">Add a friend</h2>
        <div className="fr-search">
          <Search size={18} aria-hidden />
          <input
            className="fr-input"
            placeholder="Search by name, or their exact email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search for people"
          />
        </div>

        {q.trim().length >= 2 && (
          <ul className="fr-list">
            {searching && results.length === 0 && <li className="an-muted fr-note">Searching…</li>}
            {!searching && results.length === 0 && (
              <li className="an-muted fr-note">
                Nobody new matches that. An email has to match exactly.
              </li>
            )}
            {results.map((p, i) => (
              <li key={p.id} className="fr-row" style={{ animationDelay: `${i * 30}ms` }}>
                <Avatar {...p} />
                <span className="fr-name">{p.name}</span>
                <button className="an-btn an-btn--sm" onClick={() => add(p)}>
                  <UserPlus size={15} aria-hidden /> Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {incoming.length > 0 && (
        <section className="an-card">
          <h2 className="an-card-title">Requests</h2>
          <ul className="fr-list">
            {incoming.map((p, i) => (
              <li key={p.id} className="fr-row" style={{ animationDelay: `${i * 30}ms` }}>
                <Avatar {...p} />
                <span className="fr-name">{p.name}</span>
                <button className="an-btn an-btn--sm" onClick={() => respond(p, true)}>
                  <Check size={15} aria-hidden /> Accept
                </button>
                <button className="an-btn an-btn--sm an-btn--ghost" onClick={() => respond(p, false)}>
                  <X size={15} aria-hidden /> Decline
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="an-card">
        <h2 className="an-card-title">
          Friends {accepted.length > 0 && <span className="an-muted">· {accepted.length}</span>}
        </h2>

        {accepted.length === 0 ? (
          <div className="an-empty">
            <p className="an-empty-title">No friends yet</p>
            <p className="an-muted">
              Search above to add someone. Once you do, you can compare streaks on the leaderboard.
            </p>
          </div>
        ) : (
          <ul className="fr-list">
            {accepted.map((p, i) => (
              <li key={p.id} className="fr-row" style={{ animationDelay: `${i * 30}ms` }}>
                <Avatar {...p} />
                <span className="fr-name">{p.name}</span>
                <button
                  className="an-btn an-btn--sm an-btn--ghost"
                  onClick={() => remove(p)}
                  title={`Remove ${p.name}`}
                >
                  <Trash2 size={15} aria-hidden /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="an-card">
          <h2 className="an-card-title">Sent</h2>
          <ul className="fr-list">
            {outgoing.map((p) => (
              <li key={p.id} className="fr-row">
                <Avatar {...p} />
                <span className="fr-name">{p.name}</span>
                <span className="an-muted">Awaiting reply</span>
                <button className="an-btn an-btn--sm an-btn--ghost" onClick={() => remove(p)}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} autoDismissMs={4000} />
    </AppShell>
  );
}
