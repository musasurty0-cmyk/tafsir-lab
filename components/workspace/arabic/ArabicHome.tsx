"use client";

/**
 * ArabicHome — the home of an Arabic study workspace.
 *
 * The course's own shape: five stages, each a run of levels, each level the
 * lessons imported so far. Nothing assumes how long a level is — the course
 * releases lessons as it goes, so a level shows what has arrived and a stage
 * with nothing in it yet is one quiet line.
 *
 * Revision and preparation files sit where they fall, labelled rather than
 * numbered, so lesson 13 here is lesson 13 in class.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Languages, Search, X, Check, ArrowRight, Plus, BookOpen } from "lucide-react";
import type { MemberRole } from "@/lib/services/workspaces.service";
import { isAdmin } from "@/lib/services/workspaces.service";
import { STAGES } from "@/lib/arabic/parse";
import Rail from "../Rail";
import WorkspaceSettings from "../WorkspaceSettings";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";
import Toast from "@/components/Toast";
import ArabicImport from "./ArabicImport";
import { lessonLabel } from "./lesson-label";

export interface LessonRow {
  id: string; level: number; fileNo: number; number: number | null;
  kind: string; title: string; cardCount: number; state: "covered" | "current" | null;
}

interface Hit {
  id: string; english: string; arabic: string; translit: string | null; gender: string | null; isSentence: boolean;
  lesson: { id: string; level: number; number: number | null; kind: string; title: string };
}

export interface ReviewSummary {
  byLesson: Record<string, { learning: number; learnt: number; due: number }>;
  due: number; fresh: number; freshTotal: number;
}

interface Props {
  workspaceId: string;
  workspace: { id: string; name: string; type: string; kind: string; ownerId: string; membersCanManagePages: boolean };
  role: MemberRole;
  lessons: LessonRow[];
  summary: ReviewSummary;
}

export default function ArabicHome({ workspaceId, workspace, role, lessons, summary }: Props) {
  const router = useRouter();
  useLayoutEffect(() => {
    document.getElementById("tl-nav-splash")?.remove();
    document.getElementById("tl-nav-splash-style")?.remove();
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalOpen, setModalOpen]       = useState(false);
  const [importOpen, setImportOpen]     = useState(false);
  const [notice, setNotice]             = useState<string | null>(null);
  const [wsName, setWsName]             = useState(workspace.name);

  const admin = isAdmin(role);
  const current = lessons.find((l) => l.state === "current") ?? null;
  const taught = lessons.filter((l) => l.kind === "lesson");
  const covered = taught.filter((l) => l.state === "covered" || l.state === "current").length;

  const levels = useMemo(() => {
    const m = new Map<number, LessonRow[]>();
    for (const l of lessons) m.set(l.level, [...(m.get(l.level) ?? []), l]);
    return m;
  }, [lessons]);

  // ── Search ────────────────────────────────────────────────────────────
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const reqId = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const id = ++reqId.current;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/arabic/search?q=${encodeURIComponent(term)}`);
        const data = await res.json() as { results?: Hit[] };
        if (id === reqId.current) setHits(data.results ?? []);
      } catch { if (id === reqId.current) setHits([]); }
    }, 180);
    return () => window.clearTimeout(t);
  }, [q, workspaceId]);

  // An empty box shows the course, whatever the last search returned.
  const shownHits = q.trim() ? hits : null;

  const open = (lessonId: string) => pushWithSplash(router, `/workspaces/${workspaceId}/arabic/${lessonId}`);

  return (
    <div className="workspace-home">
      <Toast message={notice} onDismiss={() => setNotice(null)} tone="success" />
      <Rail activeWorkspaceId={workspaceId} />

      <div className="workspace-home-content ar-home">
        <div className="ws-home-header">
          <div className="ws-home-titles">
            <h1 className="ws-home-name">{wsName}</h1>
            <p className="ws-home-sub">
              <span className="ws-home-kind"><Languages size={12} strokeWidth={2.2} aria-hidden /> Arabic study</span>
              {taught.length > 0 && (<>
                <span aria-hidden> · </span>
                {covered} of {taught.length} lessons covered
              </>)}
            </p>
          </div>
          <div className="ws-home-actions">
            {lessons.length > 0 && (
              <button
                className="ws-new-btn ws-new-btn--ghost"
                onClick={() => pushWithSplash(router, `/workspaces/${workspaceId}/arabic/quran`)}
                title="Read the Qurʾān with the words you know coloured"
              >
                <BookOpen size={14} aria-hidden /> Qurʾān
              </button>
            )}
            {admin && lessons.length > 0 && (
              <button className="ws-new-btn ws-new-btn--ghost" onClick={() => setImportOpen(true)}>
                <Plus size={14} aria-hidden /> Add lessons
              </button>
            )}
            <button className="ws-new-btn ws-new-btn--ghost" onClick={() => setSettingsOpen(true)}>Settings</button>
            <button className="ws-new-btn" onClick={() => setModalOpen(true)}>New workspace</button>
          </div>
        </div>

        {lessons.length === 0 ? (
          <section className="ar-first">
            <h2 className="ar-first-title">Bring in your course’s flashcards.</h2>
            <p className="ar-first-sub">
              Each lesson file becomes a lesson here, sorted into its level. Revision files are kept in place
              without taking a lesson number.
            </p>
            {admin ? (
              <ArabicImport
                workspaceId={workspaceId}
                existing={[]}
                askPlace
                onDone={(s) => { setNotice(s); router.refresh(); }}
              />
            ) : (
              <p className="ar-note">The workspace’s owner hasn’t added any lessons yet.</p>
            )}
          </section>
        ) : (
          <>
            <div className="ar-today">
              <button
                type="button"
                className="ar-review"
                data-empty={summary.due + summary.fresh === 0 ? "true" : "false"}
                onClick={() => pushWithSplash(router, `/workspaces/${workspaceId}/arabic/practice`)}
              >
                <span className="ar-review-n">{summary.due + summary.fresh}</span>
                <span className="ar-review-t">
                  {summary.due + summary.fresh === 0 ? "Nothing due" : "cards to review today"}
                  <span className="ar-review-m">
                    {summary.due + summary.fresh === 0
                      ? "Practise any lesson, or come back tomorrow."
                      : `${summary.due} due${summary.fresh ? ` · ${summary.fresh} new from lessons you’ve covered` : ""}`}
                  </span>
                </span>
                <ArrowRight size={18} aria-hidden className="ar-continue-go" />
              </button>
            {current && (
              <button type="button" className="ar-continue" onClick={() => open(current.id)}>
                <span className="ar-continue-k">You’re on</span>
                <span className="ar-continue-t">{current.title}</span>
                <span className="ar-continue-m">{lessonLabel(current)} · {current.cardCount} cards</span>
                <ArrowRight size={18} aria-hidden className="ar-continue-go" />
              </button>
            )}
            </div>

            <label className="ar-search">
              <Search size={15} aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a word you’ve learnt, in English or Arabic"
                aria-label="Search your cards"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Clear search"><X size={14} /></button>
              )}
            </label>

            {/* Words you added yourself from the Qurʾān, ahead of the course. */}
            {!shownHits && levels.get(0)?.map((l) => (
              <section key={l.id} className="ar-stage ar-mine">
                <h2 className="ar-stage-title">My words</h2>
                <p className="ar-stage-sub">Words you added from the Qurʾān</p>
                <div className="ar-lessons">
                  <Link href={`/workspaces/${workspaceId}/arabic/${l.id}`} className="ar-lesson" data-kind="mine" data-state="none">
                    <span className="ar-lesson-n">{l.cardCount}</span>
                    <span className="ar-lesson-t">word{l.cardCount === 1 ? "" : "s"} of your own</span>
                    <StatusBar total={l.cardCount} s={summary.byLesson[l.id]} />
                    <span className="ar-lesson-m"><span>Open</span></span>
                  </Link>
                </div>
              </section>
            ))}

            {shownHits ? (
              <SearchResults hits={shownHits} workspaceId={workspaceId} />
            ) : (
              STAGES.map((stage, si) => {
                const stageLevels = Array.from({ length: stage.to - stage.from + 1 }, (_, i) => stage.from + i);
                const any = stageLevels.some((lv) => levels.has(lv));
                if (!any) {
                  return (
                    <div key={si} className="ar-stage ar-stage--empty">
                      <p className="ar-stage-title">{stage.title}</p>
                      <p className="ar-stage-sub">Levels {stage.from}–{stage.to} · not released yet</p>
                    </div>
                  );
                }
                return (
                  <section key={si} className="ar-stage">
                    <h2 className="ar-stage-title">{stage.title}</h2>
                    <p className="ar-stage-sub">Levels {stage.from}–{stage.to}</p>
                    {stageLevels.map((lv) => {
                      const ls = levels.get(lv);
                      if (!ls) return <p key={lv} className="ar-level-empty">Level {lv} · not released yet</p>;
                      const n = ls.filter((l) => l.kind === "lesson").length;
                      return (
                        <div key={lv} className="ar-level">
                          <p className="ar-level-name">
                            Level {lv}
                            <span>{n} lesson{n === 1 ? "" : "s"} so far</span>
                          </p>
                          <div className="ar-lessons">
                            {ls.map((l) => (
                              <Link
                                key={l.id}
                                href={`/workspaces/${workspaceId}/arabic/${l.id}`}
                                className="ar-lesson"
                                data-state={l.state ?? "none"}
                                data-kind={l.kind}
                              >
                                <span className="ar-lesson-n">
                                  {l.number ?? (l.kind === "prep" ? "Prep" : "Revision")}
                                </span>
                                <span className="ar-lesson-t">{l.title}</span>
                                <StatusBar total={l.cardCount} s={summary.byLesson[l.id]} />
                                <span className="ar-lesson-m">
                                  {l.state === "current" ? <span className="ar-current">Current</span>
                                    : l.state === "covered" ? <span className="ar-covered"><Check size={12} strokeWidth={3} aria-hidden /> Covered</span>
                                    : null}
                                  <span>{l.cardCount} cards</span>
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </section>
                );
              })
            )}
            {/* Levels past the last stage still get shown. */}
            {!shownHits && [...levels.keys()].filter((lv) => lv > STAGES[STAGES.length - 1].to).length > 0 && (
              <p className="ar-note">Some lessons are in levels beyond 15.</p>
            )}
          </>
        )}
      </div>

      {importOpen && (
        <div className="modal-backdrop" onClick={() => setImportOpen(false)}>
          <div className="modal-card modal-card--ws ar-import-sheet" role="dialog" aria-modal="true" aria-label="Add lessons" onClick={(e) => e.stopPropagation()}>
            <h2 className="nw-title">Add lessons</h2>
            <div className="nw-body">
              <ArabicImport
                workspaceId={workspaceId}
                existing={lessons.map((l) => ({ level: l.level, fileNo: l.fileNo }))}
                askPlace={false}
                onCancel={() => setImportOpen(false)}
                onDone={(s) => { setImportOpen(false); setNotice(s); router.refresh(); }}
              />
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <WorkspaceSettings
          workspaceId={workspaceId}
          workspaceName={wsName}
          workspaceType={workspace.type}
          membersCanManagePages={workspace.membersCanManagePages}
          currentUserId={workspace.ownerId}
          currentUserRole={role}
          onClose={() => setSettingsOpen(false)}
          onRenamed={(name) => { setWsName(name); setSettingsOpen(false); }}
          onDeleted={() => { setSettingsOpen(false); pushWithSplash(router, "/home"); }}
        />
      )}
      {modalOpen && <NewWorkspaceModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

/** Learnt in green, learning in red, the rest left in ink — three colours, no more. */
function StatusBar({ total, s }: { total: number; s?: { learning: number; learnt: number } }) {
  if (!s || total === 0) return <span className="ar-sbar" aria-hidden />;
  const g = Math.round((s.learnt / total) * 100);
  const r = Math.round((s.learning / total) * 100);
  return (
    <span className="ar-sbar" title={`${s.learnt} learnt · ${s.learning} learning · ${total - s.learnt - s.learning} not known`}>
      <span className="ar-sbar-g" style={{ width: `${g}%` }} />
      <span className="ar-sbar-r" style={{ width: `${r}%` }} />
    </span>
  );
}

function SearchResults({ hits, workspaceId }: { hits: Hit[]; workspaceId: string }) {
  if (hits.length === 0) return <p className="ar-note ar-search-none">No card matches that yet.</p>;
  return (
    <ul className="ar-hits">
      {hits.map((h) => (
        <li key={h.id}>
          <Link href={`/workspaces/${workspaceId}/arabic/${h.lesson.id}#c-${h.id}`} className="ar-hit">
            <span className="ar-hit-en">
              {h.english}{h.gender && <span className="ar-g">{h.gender}</span>}
              <span className="ar-hit-where">{lessonLabel(h.lesson)}, {h.lesson.title}</span>
            </span>
            <span className="ar-hit-ar" dir="rtl" lang="ar">{h.arabic}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
