"use client";

/**
 * AnalyticsClient — the two tabs, their fetches, and the empty states.
 *
 * Every panel here has a real empty state rather than a zero. "No annotations
 * yet" with a way forward is information; a grid of 0s is a dead screen that
 * looks broken.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import type { SidebarUser } from "@/components/AppSidebar";
import type { AnalyticsSummary, DayCount, MapRow, MapScope } from "@/lib/services/analytics.service";
import { pushWithSplash } from "@/lib/nav-splash";

interface Props {
  user:           SidebarUser | null;
  initialSummary: AnalyticsSummary;
  workspaces:     { id: string; name: string }[];
}

type Tab = "activity" | "map";

const SCOPES: { key: MapScope; label: string }[] = [
  { key: "all",    label: "All" },
  { key: "pages",  label: "Pages" },
  { key: "surahs", label: "Surahs" },
  { key: "verses", label: "Verses" },
  { key: "words",  label: "Words" },
];

const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Calendar cells for a month, Monday-first, with leading blanks. */
function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first  = new Date(y, m - 1, 1);
  const days   = new Date(y, m, 0).getDate();
  const lead   = (first.getDay() + 6) % 7;          // Mon = 0
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}

export default function AnalyticsClient({ user, initialSummary, workspaces }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("activity");

  // ── Activity ────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState(initialSummary);
  const [month, setMonth]     = useState(() => monthKey(new Date()));
  const [days, setDays]       = useState<DayCount[]>([]);
  const [loadingDays, setLoadingDays] = useState(true);

  /* The server rendered with UTC because it cannot know the viewer's zone.
     This refetch with the real offset is what puts an evening annotation in
     Auckland on the right square. */
  useEffect(() => {
    const tz = new Date().getTimezoneOffset();
    let live = true;
    setLoadingDays(true);
    fetch(`/api/analytics?month=${month}&tz=${tz}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { summary: AnalyticsSummary; days: DayCount[] } | null) => {
        if (!live || !d) return;
        setSummary(d.summary);
        setDays(d.days);
      })
      .catch(() => {})
      .finally(() => { if (live) setLoadingDays(false); });
    return () => { live = false; };
  }, [month]);

  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d.count])), [days]);
  const grid  = useMemo(() => monthGrid(month), [month]);
  const todayKey = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }, []);

  const shiftMonth = useCallback((delta: number) => {
    setMonth((cur) => {
      const [y, m] = cur.split("-").map(Number);
      return monthKey(new Date(y, m - 1 + delta, 1));
    });
  }, []);

  // ── Annotation map ──────────────────────────────────────────────────────
  const [scope, setScope]           = useState<MapScope>("all");
  const [wsFilter, setWsFilter]     = useState<string>("");
  const [rows, setRows]             = useState<MapRow[]>([]);
  const [loadingMap, setLoadingMap] = useState(false);
  /* State, not a ref: this decides whether the list renders "Loading…" or an
     empty state, and a ref read during render is invisible to React — the
     first successful load would not repaint the panel. */
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (tab !== "map") return;
    let live = true;
    setLoadingMap(true);
    const qs = new URLSearchParams({ scope });
    if (wsFilter) qs.set("workspaceId", wsFilter);
    fetch(`/api/analytics/map?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rows: MapRow[] } | null) => { if (live && d) { setRows(d.rows); setMapLoaded(true); } })
      .catch(() => {})
      .finally(() => { if (live) setLoadingMap(false); });
    return () => { live = false; };
  }, [tab, scope, wsFilter]);

  const pct = summary.pagesTotal ? Math.round((summary.pages / summary.pagesTotal) * 100) : 0;
  const goalPct = summary.dailyGoal
    ? Math.min(100, Math.round((summary.todayCount / summary.dailyGoal) * 100)) : 0;

  return (
    <AppShell
      user={user}
      streak={{ current: summary.streak, today: summary.todayCount, goal: summary.dailyGoal }}
    >
      <div className="an-tabs" role="tablist">
        {(["activity", "map"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className="an-tab"
            data-active={tab === t ? "true" : "false"}
            onClick={() => setTab(t)}
          >
            {t === "activity" ? "Activity" : "Annotation Map"}
          </button>
        ))}
      </div>

      {/* ── Activity ───────────────────────────────────────────────────── */}
      {tab === "activity" && (
        <div className="an-pane" key="activity">
          <section className="an-card an-hero">
            <h2 className="an-hero-title">
              {summary.total === 0
                ? "No reflections captured yet"
                : `You have captured ${summary.total} reflection${summary.total === 1 ? "" : "s"}!`}
            </h2>
            <div className="an-stats">
              <Stat value={summary.total} label="Total" tone="sky" />
              <Stat value={`${summary.surahs}/${summary.surahsTotal}`} label="Surahs" tone="emerald" />
              <Stat value={`${summary.pages}/${summary.pagesTotal}`} label={`Pages (${pct}%)`} tone="violet" />
              <Stat value={summary.streak} label="Day Streak" tone="amber" />
            </div>
            {summary.total === 0 && (
              <p className="an-empty-cta">
                Open a sūrah and write your first note — it will show up here straight away.{" "}
                <button className="an-link" onClick={() => pushWithSplash(router, "/home")}>
                  Go to your notebooks →
                </button>
              </p>
            )}
          </section>

          <div className="an-row">
            <section className="an-card an-calendar">
              <header className="an-cal-head">
                <button className="an-cal-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                  <ChevronLeft size={20} />
                </button>
                <h3 className="an-cal-title">
                  {MONTH_FMT.format(new Date(`${month}-01T00:00:00`))}
                </h3>
                <button className="an-cal-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
                  <ChevronRight size={20} />
                </button>
              </header>

              <div className="an-cal-dow" aria-hidden>
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
              </div>

              <div className="an-cal-grid" data-loading={loadingDays ? "true" : "false"}>
                {grid.map((day, i) =>
                  day === null
                    ? <span key={`b${i}`} className="an-cal-cell an-cal-cell--blank" />
                    : (
                      <span
                        key={day}
                        className="an-cal-cell"
                        data-today={day === todayKey ? "true" : "false"}
                        data-level={level(byDay.get(day) ?? 0)}
                        title={`${day} · ${byDay.get(day) ?? 0} annotation${(byDay.get(day) ?? 0) === 1 ? "" : "s"}`}
                        style={{ animationDelay: `${Math.min(i, 34) * 12}ms` }}
                      >
                        {Number(day.slice(-2))}
                      </span>
                    ),
                )}
              </div>
            </section>

            <section className="an-card an-progress">
              <h3 className="an-card-title">Daily Progress</h3>
              <div className="an-bar" role="img" aria-label={`${summary.todayCount} of ${summary.dailyGoal} annotations today`}>
                <span className="an-bar-fill" style={{ width: `${goalPct}%` }} />
              </div>
              <p className="an-progress-count">
                {summary.todayCount}/{summary.dailyGoal} Annotations
              </p>

              <div className="an-progress-streak">
                <span>Your Streak</span>
                <strong>{summary.streak} <span aria-hidden>🔥</span></strong>
              </div>
              <p className="an-progress-best">Best run: {summary.bestStreak} day{summary.bestStreak === 1 ? "" : "s"}</p>

              {summary.mostAnnotated && (
                <p className="an-progress-best">
                  Most annotated: Sūrah {summary.mostAnnotated.surahNumber} ({summary.mostAnnotated.count})
                </p>
              )}

              <button className="an-btn" onClick={() => pushWithSplash(router, "/friends")}>
                Streaks with friends →
              </button>
            </section>
          </div>
        </div>
      )}

      {/* ── Annotation map ─────────────────────────────────────────────── */}
      {tab === "map" && (
        <div className="an-pane" key="map">
          <section className="an-card">
            <div className="an-filters">
              <select
                className="an-select"
                value={wsFilter}
                onChange={(e) => setWsFilter(e.target.value)}
                aria-label="Notebook"
              >
                <option value="">All notebooks</option>
                {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>

              <a className="an-btn an-btn--ghost" href="/api/analytics/export" download>
                <Download size={16} aria-hidden /> Export Annotations
              </a>
            </div>

            <div className="an-chips" role="tablist" aria-label="Scope">
              {SCOPES.map((s) => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={scope === s.key}
                  className="an-chip"
                  data-active={scope === s.key ? "true" : "false"}
                  onClick={() => setScope(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <section className="an-card">
            <h3 className="an-card-title">Summary</h3>
            <div className="an-stats">
              <Stat value={summary.total} label="Total Annotations" tone="sky" />
              <Stat value={`${summary.surahs}/${summary.surahsTotal}`} label="Surahs" tone="emerald" />
              <Stat value={`${summary.pages}/${summary.pagesTotal}`} label="Pages" tone="violet" />
              <Stat
                value={summary.mostAnnotated ? `Sūrah ${summary.mostAnnotated.surahNumber}` : "N/A"}
                label="Most Annotated" tone="amber"
              />
            </div>
          </section>

          <section className="an-card an-maplist">
            {loadingMap && !mapLoaded
              ? <p className="an-muted">Loading…</p>
              : rows.length === 0
                ? (
                  <div className="an-empty">
                    <p className="an-empty-title">No annotations yet</p>
                    <p className="an-muted">
                      Anything you write on a verse, a word or a page will be mapped here.
                    </p>
                  </div>
                )
                : (
                  <ul className="an-rows">
                    {rows.map((r, i) => (
                      <li
                        key={`${r.kind}-${r.surahNumber}-${r.ayahNumber}-${r.mushafPage}-${i}`}
                        className="an-mrow"
                        style={{ animationDelay: `${Math.min(i, 20) * 18}ms` }}
                      >
                        <span className="an-kind" data-kind={r.kind}>{r.kind}</span>
                        <span className="an-where">
                          {r.kind === "page"
                            ? `Page ${r.mushafPage}`
                            : r.ayahNumber != null
                              ? `${r.surahNumber}:${r.ayahNumber}`
                              : `Sūrah ${r.surahNumber}`}
                        </span>
                        <span className="an-count">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

/** 0-4, for the calendar's heat ramp. */
function level(n: number) {
  return n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 12 ? 3 : 4;
}

function Stat({ value, label, tone }: { value: number | string; label: string; tone: string }) {
  return (
    <div className="an-stat" data-tone={tone}>
      <strong className="an-stat-value">{value}</strong>
      <span className="an-stat-label">{label}</span>
    </div>
  );
}
