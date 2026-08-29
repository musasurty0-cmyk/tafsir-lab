"use client";

/**
 * ExploreClient — Surah / Juz / Page tabs plus full-text search.
 *
 * Typing a reference ("2:255", "18", "page 42") is recognised before any
 * request is made, because a person who knows where they are going should not
 * wait on the network to be taken there. Only a phrase reaches the API.
 *
 * Every result opens somewhere real. A surah needs a notebook to be opened in,
 * so when the user has more than one the row asks which — rather than guessing
 * and landing them in the wrong place.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen, Layers, FileText } from "lucide-react";
import AppShell, { type ShellStreak } from "@/components/AppShell";
import type { SidebarUser } from "@/components/AppSidebar";
import type { Chapter } from "@/lib/types";
import { JUZ_STARTS, juzEnd } from "@/lib/quran-meta";
import { parseReference, searchChapters } from "@/lib/quran-search";
import { pushWithSplash } from "@/lib/nav-splash";

interface Props {
  user:       SidebarUser | null;
  chapters:   Chapter[];
  workspaces: { id: string; name: string }[];
  streak:     ShellStreak;
}

type Tab = "surah" | "juz" | "page";
const TABS: { key: Tab; label: string; Icon: typeof BookOpen }[] = [
  { key: "surah", label: "Surah", Icon: BookOpen },
  { key: "juz",   label: "Juz",   Icon: Layers },
  { key: "page",  label: "Page",  Icon: FileText },
];

interface VerseHit {
  verseKey: string; surah: number; ayah: number;
  arabic: string; translation?: string;
}

export default function ExploreClient({ user, chapters, workspaces, streak }: Props) {
  const router = useRouter();
  const [tab, setTab]     = useState<Tab>("surah");
  const [q, setQ]         = useState("");
  const [filter, setFilter] = useState("");
  const [hits, setHits]   = useState<VerseHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Which notebook to open into. One workspace needs no question asked.
  const [wsId, setWsId] = useState(workspaces[0]?.id ?? "");

  const byNumber = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);

  const open = useCallback((surah: number, ayah?: number) => {
    if (!wsId) return;
    const base = `/workspaces/${wsId}/surahs/${surah}`;
    pushWithSplash(router, ayah ? `${base}?ayah=${ayah}` : base);
  }, [router, wsId]);

  /* A reference is resolved here, never over the network. Only a phrase is
     worth a request, and only once the typing settles. */
  const ref = useMemo(() => parseReference(q), [q]);
  const latest = useRef("");
  useEffect(() => {
    const term = q.trim();
    latest.current = term;
    if (ref || term.length < 2) { setHits([]); setSearching(false); return; }

    setSearching(true);
    const id = setTimeout(() => {
      fetch(`/api/quran/search?q=${encodeURIComponent(term)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { results?: VerseHit[] } | null) => {
          if (latest.current !== term) return;      // a later query already won
          setHits(d?.results ?? []);
        })
        .catch(() => {})
        .finally(() => { if (latest.current === term) setSearching(false); });
    }, 320);
    return () => clearTimeout(id);
  }, [q, ref]);

  const surahMatches = useMemo(() => {
    const term = filter.trim();
    if (!term) return chapters;
    return searchChapters(term, chapters).map((h) => h.chapter);
  }, [filter, chapters]);

  const pages = useMemo(() => Array.from({ length: 604 }, (_, i) => i + 1), []);

  return (
    <AppShell user={user} streak={streak}>
      <section className="an-card">
        <h2 className="ex-heading">Explore the Qur&#x2019;an</h2>
        <p className="an-muted">Search by sūrah, page, or verse reference.</p>

        <div className="fr-search ex-search">
          <Search size={19} aria-hidden />
          <input
            className="fr-input"
            placeholder="Try 2:255, or a phrase you remember…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && ref) open(ref.surah, ref.ayah); }}
            aria-label="Search the Qur'an"
          />
        </div>

        {workspaces.length > 1 && (
          <label className="ex-ws">
            <span className="an-muted">Open in</span>
            <select className="an-select" value={wsId} onChange={(e) => setWsId(e.target.value)}>
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        )}
        {workspaces.length === 0 && (
          <p className="an-muted">
            You have no study notebooks yet, so there is nowhere to open a sūrah.
            Create one from Home first.
          </p>
        )}

        {/* A recognised reference answers immediately, above everything else. */}
        {ref && (
          <button className="ex-ref" onClick={() => open(ref.surah, ref.ayah)} disabled={!wsId}>
            <span className="ex-ref-key">
              {ref.surah}{ref.ayah != null ? `:${ref.ayah}` : ""}
            </span>
            <span className="ex-ref-name">
              {byNumber.get(ref.surah)?.name_simple ?? `Sūrah ${ref.surah}`}
              {ref.ayah != null ? ` · āyah ${ref.ayah}` : ""}
            </span>
            <span className="ex-ref-go">Open →</span>
          </button>
        )}

        {!ref && q.trim().length >= 2 && (
          <div className="ex-hits">
            {searching && hits.length === 0 && <p className="an-muted">Searching…</p>}
            {!searching && hits.length === 0 && (
              <p className="an-muted">Nothing matched that phrase.</p>
            )}
            {hits.map((h, i) => (
              <button
                key={h.verseKey} className="ex-hit"
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                onClick={() => open(h.surah, h.ayah)}
                disabled={!wsId}
              >
                <span className="ex-hit-key">{h.verseKey}</span>
                <span className="ex-hit-ar" dir="rtl">{h.arabic}</span>
                {h.translation && <span className="ex-hit-tr">{h.translation}</span>}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="an-card">
        <div className="an-tabs" role="tablist">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key} role="tab" aria-selected={tab === key}
              className="an-tab ex-tab" data-active={tab === key ? "true" : "false"}
              onClick={() => setTab(key)}
            >
              <Icon size={15} aria-hidden /> {label}
            </button>
          ))}
        </div>

        {tab === "surah" && (
          <div className="an-pane" key="surah">
            <input
              className="set-input" placeholder="Filter sūrahs…"
              value={filter} onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter surahs"
            />
            <ul className="ex-list">
              {surahMatches.map((c, i) => (
                <li key={c.id} style={{ animationDelay: `${Math.min(i, 18) * 14}ms` }}>
                  <button className="ex-row" onClick={() => open(c.id)} disabled={!wsId}>
                    <span className="ex-num" data-n={c.id % 9}>{c.id}</span>
                    <span className="ex-row-main">
                      <span className="ex-row-title">{c.name_simple}</span>
                      <span className="ex-row-sub">
                        {c.verses_count} verses · {c.revelation_place === "makkah" ? "Meccan" : "Medinan"} · Page {c.pages[0]}
                      </span>
                    </span>
                    <span className="ex-row-ar" dir="rtl">{c.name_arabic}</span>
                  </button>
                </li>
              ))}
              {surahMatches.length === 0 && <li className="an-muted fr-note">No sūrah matches that.</li>}
            </ul>
          </div>
        )}

        {tab === "juz" && (
          <div className="an-pane" key="juz">
            <ul className="ex-list ex-list--grid">
              {JUZ_STARTS.map(([s, a], i) => {
                const [es, ea] = juzEnd(i + 1);
                return (
                  <li key={i} style={{ animationDelay: `${Math.min(i, 18) * 14}ms` }}>
                    <button className="ex-row" onClick={() => open(s, a)} disabled={!wsId}>
                      <span className="ex-num" data-n={(i + 1) % 9}>{i + 1}</span>
                      <span className="ex-row-main">
                        <span className="ex-row-title">Juz&#x2019; {i + 1}</span>
                        <span className="ex-row-sub">
                          {byNumber.get(s)?.name_simple ?? s} {s}:{a} → {es}:{ea}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {tab === "page" && (
          <div className="an-pane" key="page">
            <p className="an-muted">
              604 pages of the Madīnah muṣḥaf. Each opens at the sūrah it begins with.
            </p>
            <div className="ex-pages">
              {pages.map((p) => {
                /* The first sūrah whose range covers this page — which is the
                   sūrah the page opens with, since ranges are ordered. */
                const c = chapters.find((ch) => p >= ch.pages[0] && p <= ch.pages[1]);
                return (
                  <button
                    key={p} className="ex-page"
                    title={c ? `${c.name_simple} · page ${p}` : `Page ${p}`}
                    onClick={() => c && open(c.id)}
                    disabled={!wsId || !c}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
