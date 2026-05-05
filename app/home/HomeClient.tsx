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

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/client";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";
import JoinWorkspaceModal from "@/components/JoinWorkspaceModal";
import TutorialOverlay from "@/components/TutorialOverlay";
import TourBubble      from "@/components/TourBubble";
import { startTour }   from "@/lib/tour";
import type { MemberRole } from "@/lib/services/workspaces.service";

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

// ── WelcomeHero ────────────────────────────────────────────────────────────

function WelcomeHero({
  user,
  lastPage,
  surahNames,
  totalSurahs,
  onCreateWorkspace,
  onNavigate,
}: {
  user:              UserInfo | null;
  lastPage:          LastPage | null;
  surahNames:        Record<number, SurahName>;
  totalSurahs:       number;
  onCreateWorkspace: () => void;
  onNavigate:        (href: string) => void;
}) {

  const name = user?.name ? firstName(user.name) : null;

  // Subtitle: last surah context or generic
  let subtitle = "Your personal Qur\u2019an study space.";
  if (lastPage) {
    const sn = surahNames[lastPage.workspaceSurah.surahNumber];
    subtitle  = sn ? `Studying ${sn.name} \u00b7 ${lastPage.workspaceSurah.workspace.name}` : subtitle;
  } else if (totalSurahs > 0) {
    subtitle = `${totalSurahs} surah${totalSurahs > 1 ? "s" : ""} in progress.`;
  }

  if (lastPage) {
    const { workspaceSurah: ws } = lastPage;
    const href  = `/workspaces/${ws.workspace.id}/surahs/${ws.surahNumber}/pages/${lastPage.id}`;
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
          className="hw-resume"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate(href)}
          onKeyDown={(e) => { if (e.key === "Enter") onNavigate(href); }}
        >
          <div className="hw-resume-accent" />
          <div className="hw-resume-body">
            <span className="hw-resume-label">Continue studying</span>
            <div className="hw-resume-surah">
              <span className="hw-resume-surah-name">
                {surah?.name ?? `Surah ${ws.surahNumber}`}
              </span>
              {surah?.arabic && (
                <span className="hw-resume-surah-arabic" dir="rtl">
                  {surah.arabic}
                </span>
              )}
            </div>
            <p className="hw-resume-page">{lastPage.title}</p>
            <p className="hw-resume-ws">{ws.workspace.name}</p>
          </div>
          <button
            className="hw-resume-btn"
            onClick={(e) => { e.stopPropagation(); onNavigate(href); }}
          >
            Resume Study <ArrowIcon />
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
  onRenamed,
  onNavigate,
}: {
  ws:         WorkspaceItem;
  surahNames: Record<number, SurahName>;
  onRenamed:  (id: string, name: string) => void;
  onNavigate: (href: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isOwner  = ws.role === "owner";

  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(ws.name);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(ws.name);
    setError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
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

  return (
    <div
      className="hw-ws-card"
      role="button"
      tabIndex={0}
      onClick={() => !editing && onNavigate(`/workspaces/${ws.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter" && !editing) onNavigate(`/workspaces/${ws.id}`); }}
    >
      {/* Card header */}
      <div className="hw-ws-card-header">
        <div className="hw-ws-card-avatar">{initials}</div>
        {isOwner && !editing && (
          <button className="hw-ws-card-edit" onClick={startEdit} title="Rename">
            <PencilIcon />
          </button>
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

export default function HomeClient({
  workspaces: initial,
  lastPage,
  user,
  surahNames,
  totalSurahs,
}: Props) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState(initial);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [joinOpen,   setJoinOpen]   = useState(false);
  const [tutKey,     setTutKey]     = useState(0);

  function replayTutorial() {
    localStorage.removeItem("tl-tutorial-done");
    startTour();
    setTutKey((k) => k + 1);
  }


  const navigate = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  const userInitials = user?.name
    ? user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  function handleRenamed(id: string, name: string) {
    setWorkspaces((prev) => prev.map((ws) => ws.id === id ? { ...ws, name } : ws));
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    try { await getFirebaseAuth().signOut(); } catch { /* ignore */ }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="home-page">
      {/* Top bar */}
      <header className="home-topbar">
        <div className="home-brand">
          <div className="home-brand-logo">T</div>
          <span className="home-brand-name">TafsirLab</span>
        </div>
        <button
          className="home-user-avatar"
          title={`${user?.name ?? "User"} · Sign out`}
          onClick={handleSignOut}
        >
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt={user.name} />
            : userInitials}
        </button>
      </header>

      {/* Content */}
      <div className="home-content">

        {/* Welcome + resume */}
        <WelcomeHero
          user={user}
          lastPage={lastPage}
          surahNames={surahNames}
          totalSurahs={totalSurahs}
          onCreateWorkspace={() => setModalOpen(true)}
          onNavigate={navigate}
        />

        {/* Workspaces */}
        <section className="hw-ws-section">
          <div className="hw-ws-header">
            <h2 className="hw-ws-title">Your workspaces</h2>
            <button className="hw-ws-new-btn" onClick={() => setModalOpen(true)}>
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
                    onRenamed={handleRenamed}
                    onNavigate={navigate}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Join + replay */}
        <div className="home-join-row">
          <button className="home-join-btn" onClick={() => setJoinOpen(true)}>
            Join a workspace with an invite code
          </button>
          <button className="home-join-btn" onClick={replayTutorial}>
            Replay tutorial
          </button>
        </div>

      </div>

      <TutorialOverlay key={tutKey} />
      <TourBubble />

      {modalOpen && <NewWorkspaceModal onClose={() => setModalOpen(false)} />}
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
