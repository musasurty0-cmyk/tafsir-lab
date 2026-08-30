"use client";

/**
 * HomeClient — personal study dashboard.
 *
 * Sections:
 *   TopBar        — logo + user avatar
 *   WelcomeHero   — greeting, resume card OR first-time CTA
 *   WorkspaceGrid — study notebook cards
 *   JoinRow       — secondary invite-code action
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/client";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";
import Toast from "@/components/Toast";
import SettingsMenu from "@/components/SettingsMenu";
import JoinWorkspaceModal from "@/components/JoinWorkspaceModal";
import TutorialOverlay from "@/components/TutorialOverlay";
import TourBubble      from "@/components/TourBubble";
import { startTour }   from "@/lib/tour";
import type { MemberRole } from "@/lib/services/workspaces.service";
import type { RailItem } from "@/lib/services/bookmarks.service";
import AppSidebar from "@/components/AppSidebar";
import HomeRail from "@/components/HomeRail";
import StudyWithAI from "@/components/StudyWithAI";
import Announcement from "@/components/Announcement";
import Onboarding from "@/components/Onboarding";

// ── Types ──────────────────────────────────────────────────────────────────

interface SurahName { name: string; arabic: string }

interface WorkspaceItem {
  id:              string;
  name:            string;
  type:            string;
  ownerId:         string;
  role:            MemberRole;
  _count:          { members: number; surahs: number };
  lastSurahNumber: number | null;
  lastStudiedAt:   Date | string | null;
}

interface LastPage {
  id:    string;
  title: string;
  workspaceSurah: {
    surahNumber: number;
    workspace: { id: string; name: string };
  };
}

interface UserInfo { name: string; avatarUrl: string | null }

interface Props {
  workspaces:  WorkspaceItem[];
  lastPage:    LastPage | null;
  user:        UserInfo | null;
  surahNames:  Record<number, SurahName>;
  totalSurahs: number;
  bookmarks:   RailItem[];
  streak:      { current: number; today: number; goal: number } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function firstName(full: string) {
  return full.split(" ")[0];
}

function relativeDate(d: Date | string): string {
  const ms   = Date.now() - new Date(d).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
}

// ── Icons ──────────────────────────────────────────────────────────────────

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const PencilIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

// ── WelcomeHero ────────────────────────────────────────────────────────────

function WelcomeHero({
  user,
  lastPage,
  surahNames,
  totalSurahs,
  isNavigating,
  onCreateWorkspace,
  onNavigate,
}: {
  user:              UserInfo | null;
  lastPage:          LastPage | null;
  surahNames:        Record<number, SurahName>;
  totalSurahs:       number;
  isNavigating:      boolean;
  onCreateWorkspace: () => void;
  onNavigate:        (href: string) => void;
}) {

  const name = user?.name ? firstName(user.name) : null;

  let subtitle = "Your personal Qur’an study space.";
  // surahNumber 0 = the whiteboard sentinel — the page is a blank board,
  // not a surah. Show the workspace name and deep-link to the board.
  const lastIsBoard = lastPage?.workspaceSurah.surahNumber === 0;

  if (lastPage) {
    const sn = surahNames[lastPage.workspaceSurah.surahNumber];
    subtitle = lastIsBoard
      ? `Boards · ${lastPage.workspaceSurah.workspace.name}`
      : sn ? `Studying ${sn.name} · ${lastPage.workspaceSurah.workspace.name}` : subtitle;
  } else if (totalSurahs > 0) {
    subtitle = `${totalSurahs} surah${totalSurahs > 1 ? "s" : ""} in progress.`;
  }

  if (lastPage) {
    const { workspaceSurah: ws } = lastPage;
    const href = lastIsBoard
      ? `/workspaces/${ws.workspace.id}/whiteboard/${lastPage.id}`
      : `/workspaces/${ws.workspace.id}/surahs/${ws.surahNumber}/pages/${lastPage.id}`;
    const surah = surahNames[ws.surahNumber];

    return (
      <section className="hw-hero">
        {/* Greeting */}
        <div className="hw-greeting">
          <h1 className="hw-greeting-title">
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </h1>
          <p className="hw-greeting-sub">{subtitle}</p>
        </div>

        {/* Resume card */}
        <div
          className={`hw-resume${isNavigating ? " hw-resume--loading" : ""}`}
          role="button"
          tabIndex={isNavigating ? -1 : 0}
          aria-disabled={isNavigating}
          onClick={() => { if (!isNavigating) onNavigate(href); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !isNavigating) onNavigate(href); }}
        >
          <div className="hw-resume-accent" />
          <div className="hw-resume-body">
            <span className="hw-resume-label">{lastIsBoard ? "Continue on your board" : "Continue studying"}</span>
            <div className="hw-resume-surah">
              <span className="hw-resume-surah-name">
                {lastIsBoard
                  ? ws.workspace.name
                  : surah?.name ?? `Surah ${ws.surahNumber}`}
              </span>
              {!lastIsBoard && surah?.arabic && (
                <span className="hw-resume-surah-arabic" dir="rtl">
                  {surah.arabic}
                </span>
              )}
            </div>
            <p className="hw-resume-page">{lastPage.title}</p>
            <p className="hw-resume-ws">{lastIsBoard ? "Blank board" : ws.workspace.name}</p>
          </div>
          <button
            className={`hw-resume-btn${isNavigating ? " hw-resume-btn--loading" : ""}`}
            disabled={isNavigating}
            onClick={(e) => { e.stopPropagation(); if (!isNavigating) onNavigate(href); }}
            aria-label={isNavigating ? "Opening workspace…" : "Resume Study"}
          >
            {isNavigating ? (
              <>
                <span className="hw-nav-spinner" aria-hidden="true" />
                Opening…
              </>
            ) : (
              <>Resume Study <ArrowIcon /></>
            )}
          </button>
        </div>
      </section>
    );
  }

  // No activity yet
  return (
    <section className="hw-hero hw-hero--empty">
      <div className="hw-greeting">
        <h1 className="hw-greeting-title">
          {name ? `Welcome, ${name}` : "Welcome to TafsirLab"}
        </h1>
        <p className="hw-greeting-sub">
          Create a workspace to begin your Qur&#x2019;an study journey.
        </p>
      </div>
      <button className="hw-cta-btn" onClick={onCreateWorkspace}>
        Create your first workspace <ArrowIcon />
      </button>
    </section>
  );
}

// ── WorkspaceCard ──────────────────────────────────────────────────────────

function WorkspaceCard({
  ws,
  surahNames,
  isNavigating,
  onRenamed,
  onDeleted,
  onNavigate,
}: {
  ws:           WorkspaceItem;
  surahNames:   Record<number, SurahName>;
  isNavigating: boolean;
  onRenamed:    (id: string, name: string) => void;
  onDeleted:    (id: string) => void;
  onNavigate:   (href: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isOwner  = ws.role === "owner";

  const [editing,     setEditing]     = useState(false);
  const [draft,       setDraft]       = useState(ws.name);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(ws.name);
    setError(null);
    setEditing(true);
    setConfirmDel(false);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${ws.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted(ws.id);
      } else {
        setError("Failed to delete");
        setDeleting(false);
        setConfirmDel(false);
      }
    } catch {
      setError("Network error");
      setDeleting(false);
      setConfirmDel(false);
    }
  }

  async function commitEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === ws.name) { setEditing(false); setDraft(ws.name); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/workspaces/${ws.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? "Failed to rename"); setDraft(ws.name);
      } else {
        onRenamed(ws.id, trimmed);
      }
    } catch { setError("Network error"); setDraft(ws.name); }
    finally { setSaving(false); setEditing(false); }
  }

  const initials    = ws.name.slice(0, 2).toUpperCase();
  const lastSurah   = ws.lastSurahNumber ? surahNames[ws.lastSurahNumber] : null;
  const surahText   = ws._count.surahs === 1 ? "1 surah" : `${ws._count.surahs} surahs`;
  const lastDate    = ws.lastStudiedAt ? relativeDate(ws.lastStudiedAt) : null;

  const href        = `/workspaces/${ws.id}`;
  const blocked     = isNavigating || editing;

  return (
    <div
      className={`hw-ws-card${isNavigating ? " hw-ws-card--nav-busy" : ""}`}
      role="button"
      tabIndex={blocked ? -1 : 0}
      aria-disabled={isNavigating}
      onClick={() => !blocked && onNavigate(href)}
      onKeyDown={(e) => { if (e.key === "Enter" && !blocked) onNavigate(href); }}
    >
      {/* Card header */}
      <div className="hw-ws-card-header">
        <div className="hw-ws-card-avatar">{initials}</div>
        {isOwner && !editing && (
          <div className="hw-ws-card-actions" onClick={(e) => e.stopPropagation()}>
            {confirmDel ? (
              <>
                <button
                  className="hw-ws-card-del-confirm"
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Confirm delete"
                >
                  {deleting ? "…" : "Delete?"}
                </button>
                <button
                  className="hw-ws-card-edit"
                  onClick={(e) => { e.stopPropagation(); setConfirmDel(false); }}
                  title="Cancel"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <button className="hw-ws-card-edit" onClick={startEdit} title="Rename">
                  <PencilIcon />
                </button>
                <button className="hw-ws-card-del" onClick={handleDelete} title="Delete workspace">
                  <TrashIcon />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Name */}
      {editing ? (
        <input
          ref={inputRef}
          className="hw-ws-card-name-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter")  e.currentTarget.blur();
            if (e.key === "Escape") { setEditing(false); setDraft(ws.name); }
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={saving}
          maxLength={80}
        />
      ) : (
        <p className="hw-ws-card-name">{ws.name}</p>
      )}
      {error && <p className="hw-ws-card-error">{error}</p>}

      {/* Meta */}
      <div className="hw-ws-card-meta">
        <span className={`hw-ws-card-type hw-ws-card-type--${ws.type}`}>
          {ws.type === "private" ? "Private" : "Group"}
        </span>
        <span className="hw-ws-card-count">{surahText}</span>
      </div>

      {/* Last studied */}
      {(lastSurah || lastDate) && (
        <div className="hw-ws-card-last">
          {lastSurah && <span className="hw-ws-card-last-surah">{lastSurah.name}</span>}
          {lastDate  && <span className="hw-ws-card-last-date">{lastDate}</span>}
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const NAV_TIMEOUT_MS = 12000; // reset loading if navigation takes this long

export default function HomeClient({
  workspaces: initial,
  lastPage,
  user,
  surahNames,
  totalSurahs,
  bookmarks,
  streak,
}: Props) {
  const router = useRouter();
  const [workspaces,   setWorkspaces]   = useState(initial);
  const [modalOpen,    setModalOpen]    = useState(false);
  /** Where the "+ New" press happened, so the panel grows from it. */
  const [modalOrigin,  setModalOrigin]  = useState<{ x: number; y: number } | null>(null);
  const [joinOpen,     setJoinOpen]     = useState(false);
  const [tutKey,       setTutKey]       = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navError,     setNavError]     = useState<string | null>(null);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timeout on unmount
  useEffect(() => () => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
  }, []);

  function replayTutorial() {
    localStorage.removeItem("tl-tutorial-done");
    startTour();
    setTutKey((k) => k + 1);
  }

  const navigate = useCallback((href: string) => {
    if (isNavigating) return;

    // Show loading feedback immediately — before router.push
    setIsNavigating(true);
    setNavError(null);

    // Safety valve: if the new route doesn't load within NAV_TIMEOUT_MS,
    // reset the UI so the user can try again.
    navTimerRef.current = setTimeout(() => {
      setIsNavigating(false);
      setNavError("Could not open workspace. Please try again.");
    }, NAV_TIMEOUT_MS);

    try {
      pushWithSplash(router, href);
    } catch {
      clearTimeout(navTimerRef.current);
      setIsNavigating(false);
      setNavError("Could not open workspace. Please try again.");
    }
  }, [router, isNavigating]);

  function handleRenamed(id: string, name: string) {
    setWorkspaces((prev) => prev.map((ws) => ws.id === id ? { ...ws, name } : ws));
  }

  function handleDeleted(id: string) {
    setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    try { await getFirebaseAuth().signOut(); } catch { /* ignore */ }
    pushWithSplash(router, "/login");
    router.refresh();
  }

  return (
    <div className="home-page home-page--shell">
      <AppSidebar user={user} />

      {/* ── Navigation overlay — shown immediately on click ── */}
      {isNavigating && (
        <div className="hw-nav-overlay" role="status" aria-live="polite">
          <div className="hw-nav-overlay-content">
            <div className="hw-nav-overlay-spinner" aria-hidden="true" />
            <p className="hw-nav-overlay-text">Opening your workspace…</p>
          </div>
        </div>
      )}

      {/* ── Error toast ── */}
      <Toast message={navError} onDismiss={() => setNavError(null)} />

      {/* The brand block and the duplicate avatar that used to sit here are
          now the sidebar's job. What is left is the streak line and the
          per-page settings menu, which the sidebar does not carry. */}
      <header className="home-topbar home-topbar--shell">
        {streak && (
          <p className="home-streak">
            <span aria-hidden>🔥</span> {streak.current} day{streak.current === 1 ? "" : "s"}
            {" · "}
            <span title="Annotations today, against your daily goal">
              {streak.today}/{streak.goal} today
            </span>
          </p>
        )}
        <div className="home-header-right">
          <SettingsMenu user={user} onSignOut={handleSignOut} />
        </div>
      </header>

      {/* Content */}
      {/* The content region as a landmark. This page builds its own shell
          rather than using AppShell, so it needs its own. */}
      <main className="home-content" id="main">

        <StudyWithAI />

        {/* Welcome + resume */}
        <WelcomeHero
          user={user}
          lastPage={lastPage}
          surahNames={surahNames}
          totalSurahs={totalSurahs}
          isNavigating={isNavigating}
          onCreateWorkspace={() => setModalOpen(true)}
          onNavigate={navigate}
        />

        {/* Workspaces */}
        <section className="hw-ws-section">
          <div className="hw-ws-header">
            <h2 className="hw-ws-title">Your workspaces</h2>
            <button
              className="hw-ws-new-btn"
              onClick={(e) => {
                // Remember where the press happened so the panel can grow
                // out of this control rather than appearing from nowhere.
                const r = e.currentTarget.getBoundingClientRect();
                setModalOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
                setModalOpen(true);
              }}
            >
              + New
            </button>
          </div>

          {workspaces.length === 0 ? (
            <div className="hw-ws-empty">
              No workspaces yet.{" "}
              <button className="hw-ws-empty-btn" onClick={() => setModalOpen(true)}>
                Create one →
              </button>
            </div>
          ) : (
            <div className="hw-ws-grid">
              {workspaces.map((ws, index) => (
                <div key={ws.id} style={{ "--index": index } as React.CSSProperties}>
                  <WorkspaceCard
                    ws={ws}
                    surahNames={surahNames}
                    isNavigating={isNavigating}
                    onRenamed={handleRenamed}
                    onDeleted={handleDeleted}
                    onNavigate={navigate}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <Announcement />

        {/* Join + replay */}
        <div className="home-join-row">
          <button className="home-join-btn" onClick={() => setJoinOpen(true)}>
            Join a workspace with an invite code
          </button>
          <button className="home-join-btn" onClick={replayTutorial}>
            Replay tutorial
          </button>
        </div>

      </main>

      <HomeRail bookmarks={bookmarks} />

      {/* First-run explainer. Sits above the tour, which teaches the editor —
          this one explains the shape of the app before you are in it. */}
      <Onboarding />

      <TutorialOverlay key={tutKey} />
      <TourBubble />

      {modalOpen && (
        <NewWorkspaceModal
          originPoint={modalOrigin}
          onClose={() => { setModalOpen(false); setModalOrigin(null); }}
        />
      )}
      {joinOpen && (
        <JoinWorkspaceModal
          onClose={() => {
            setJoinOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
