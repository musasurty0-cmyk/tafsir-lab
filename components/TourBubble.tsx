"use client";

/**
 * TourBubble — floating in-app product tour.
 *
 * Rendered inside HomeClient, WorkspaceHome, WorkspacePageView, and SurahNoPages.
 * Reads tour state from localStorage and subscribes to the "tl-tour-update"
 * CustomEvent so all instances stay in sync without a React context.
 *
 * Steps:
 *   0  Home              — "Open a workspace to begin"
 *   1  Workspace (grid)  — "Open Al-Fātiḥah to start writing"
 *   2  Surah / page      — "Try writing something here"
 *   3  Finale            — Bismillah full-screen
 *
 * Auto-advances when the user navigates naturally (usePathname watch).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getTour, setTour, clearTour, type TourState } from "@/lib/tour";

interface Props {
  /** Pass from workspace pages so Next on step 1 can call the startSurah API. */
  workspaceId?: string;
}

// ── Route matchers ────────────────────────────────────────────────────────────
const onHome      = (p: string) => p.startsWith("/home");
const onWorkspace = (p: string) => /^\/workspaces\/[^/]+\/?$/.test(p);
const onSurah     = (p: string) => /^\/workspaces\/[^/]+\/surahs/.test(p);

export default function TourBubble({ workspaceId }: Props) {
  const [tour,    setLocal]   = useState<TourState | null>(null);
  const [leaving, setLeaving] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();
  const busy     = useRef(false);

  // ── Sync with localStorage ─────────────────────────────────────────────────
  useEffect(() => {
    function sync() { setLocal(getTour()); }
    sync();
    window.addEventListener("tl-tour-update", sync);
    window.addEventListener("storage",         sync);
    return () => {
      window.removeEventListener("tl-tour-update", sync);
      window.removeEventListener("storage",         sync);
    };
  }, []);

  // ── Auto-advance when user navigates naturally ─────────────────────────────
  useEffect(() => {
    const t = getTour();
    if (!t?.active) return;
    if (onSurah(pathname)     && t.step < 2) setTour({ ...t, step: 2 });
    else if (onWorkspace(pathname) && t.step < 1) setTour({ ...t, step: 1 });
  }, [pathname]);

  // ── Dismiss ────────────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => { clearTour(); setLocal(null); setLeaving(false); }, 300);
  }, []);

  // ── Next ───────────────────────────────────────────────────────────────────
  const next = useCallback(async () => {
    const t = getTour();
    if (!t || busy.current) return;

    if (t.step === 0) {
      // Navigate into the workspace
      const wsId = t.workspaceId;
      setTour({ ...t, step: 1 });
      if (wsId) router.push(`/workspaces/${wsId}`);
    } else if (t.step === 1) {
      // Start Al-Fātiḥah (surah 1) then navigate into it
      const wsId = workspaceId ?? t.workspaceId;
      if (!wsId) return;
      busy.current = true;
      try {
        await fetch(`/api/workspaces/${wsId}/surahs`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ surahNumber: 1 }),
        });
      } catch { /* already exists — that's fine */ }
      busy.current = false;
      setTour({ ...t, step: 2 });
      router.push(`/workspaces/${wsId}/surahs/1`);
    } else if (t.step === 2) {
      setTour({ ...t, step: 3 });
    } else if (t.step === 3) {
      dismiss();
    }
  }, [workspaceId, router, dismiss]);

  if (!tour?.active) return null;

  const step = tour.step;

  // ── Visibility guard: only render on the right page for each step ──────────
  const wrongPage =
    (step === 0 && !onHome(pathname))      ||
    (step === 1 && !onWorkspace(pathname)) ||
    (step === 2 && !onSurah(pathname));
  if (wrongPage && step < 3) return null;

  // ── Step 3: Bismillah finale ───────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className={`tr-finale${leaving ? " tr-out" : " tr-in"}`}>
        <div className="tr-finale-card">
          <p className="tr-bismillah-ar">
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </p>
          <p className="tr-bismillah-en">
            In the name of God, the Most Gracious, the Most Merciful
          </p>
          <div className="tr-finale-divider" />
          <p className="tr-finale-msg">
            You're all set. May your study be of benefit.
          </p>
          <button className="tr-begin-btn" onClick={dismiss}>
            Begin studying →
          </button>
        </div>
      </div>
    );
  }

  // ── Steps 0-2: floating bubble ─────────────────────────────────────────────
  const STEPS = [
    {
      title: "Your study dashboard",
      body:  "Your workspaces appear here. Each one is a study notebook. Let's open a workspace and get started.",
      cta:   tour.workspaceId ? "Open workspace →" : "Create a workspace first →",
      ok:    !!tour.workspaceId,
    },
    {
      title: "Your workspace",
      body:  "These are your surahs. Let's open Al-Fātiḥah — the first surah — to get started.",
      cta:   "Open Al-Fātiḥah →",
      ok:    true,
    },
    {
      title: "Your writing space",
      body:  "This is where you write tafsir and commentary. Try typing something here. Press '/' to embed a verse with /ayah.",
      cta:   "Done, continue →",
      ok:    true,
    },
  ] as const;

  const s = STEPS[step];

  return (
    <div className={`tr-bubble${leaving ? " tr-out" : " tr-in"}`}>
      <div className="tr-bubble-top">
        <div className="tr-dots">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`tr-dot${i === step ? " tr-dot--cur" : i < step ? " tr-dot--done" : ""}`}
            />
          ))}
        </div>
        <button className="tr-skip" onClick={dismiss}>
          Skip tour
        </button>
      </div>
      <h3 className="tr-title">{s.title}</h3>
      <p className="tr-body">{s.body}</p>
      <button className="tr-next-btn" onClick={next} disabled={!s.ok}>
        {s.cta}
      </button>
    </div>
  );
}
