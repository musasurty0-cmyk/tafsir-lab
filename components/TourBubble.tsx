"use client";

/**
 * TourBubble — the in-app tour of a study workspace.
 *
 * Rebuilt 31 Oct 2026, when the workspace had changed so much that the old
 * tour pointed at a formatting ribbon, a font-size box and a "tap the sūrah
 * name" step that no longer described the app. It now walks what a study
 * workspace actually is: the sheet you write anywhere on, the slash menu, the
 * pen on the notes, the four views, the Mushaf and Study Mode, the tafāsīr,
 * Lab AI, studying together, and pages.
 *
 * Step 0 runs on /home and builds the tutorial workspace; every later step
 * runs on the page it opens. Each step DECLARES the view and panels it needs
 * (STEPS[n].view), and moving to a step, forwards or back, asks
 * WorkspacePageView for exactly that state. The old tour emitted a mode on
 * the way forward and guessed on the way back, so Back could land on the
 * wrong view with the wrong drawer open.
 *
 * Events, so nothing has to thread props through the workspace:
 *   tl-tour-mode   "editor" | "canvas" | "split"     → WorkspacePageView
 *   tl-tour-panels { tafsir, ai, formatting }         → WorkspacePageView
 *   tl-tour-action "study" | "leave-study"            → ModeBPage (Study Mode)
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { fatihaNotesDoc, DEMO_CONNECTIONS } from "@/lib/demo/fatiha-notes";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getTour, setTour, clearTour, type TourState } from "@/lib/tour";
import TourSpotlight, { useSpotlightTarget } from "./TourSpotlight";

// ── Route matchers ────────────────────────────────────────────────────────────
const onHome  = (p: string) => p.startsWith("/home");
const onSurah = (p: string) => /^\/workspaces\/[^/]+\/surahs/.test(p);

type Mode = "editor" | "canvas" | "split";
interface View { mode: Mode; tafsir?: boolean; ai?: boolean; formatting?: boolean; study?: boolean }

/* Every target is a selector that exists in the shipped UI; a tour that
   points at nothing is worse than no tour. A step whose target is not on
   screen is narrated without a spotlight. Copy follows the house rules: what
   the app really does, in plain words, no em dashes. */
const STEPS: readonly {
  title: string; body: string; target?: string; view?: View;
}[] = [
  {
    title: "Welcome to TafsirLab.",
    body:  "We’ll open a tutorial workspace with real notes on al-Fātiḥah and show you round it. It takes about two minutes.",
  },
  {
    title: "Your study sheet.",
    body:  "These are real notes on the names of al-Fātiḥah. Click any empty spot and a text box opens right there, as in OneNote. Paste from OneNote or Word and it arrives tidy.",
    target: ".page-editor-content",
    view:  { mode: "editor" },
  },
  {
    title: "Type / for anything.",
    body:  "/ayah 2:255 puts a verse into your notes, /tafsir a passage of commentary, and /link joins two passages. /help lists everything.",
    target: ".page-editor-content",
    view:  { mode: "editor" },
  },
  {
    title: "Formatting, when you want it.",
    body:  "Headings, colour, highlight, lists and tables live here. Select any text and a small toolbar appears beside it as well.",
    target: ".topbar-actions [title$=\"formatting\"]",
    view:  { mode: "editor", formatting: true },
  },
  {
    title: "Write with a pen.",
    body:  "On an iPad, the Apple Pencil writes straight onto your notes, with a pen, highlighter and eraser. Fingers still scroll and the keyboard still types.",
    target: ".page-editor",
    view:  { mode: "editor" },
  },
  {
    title: "Four ways to look.",
    body:  "Your notes, the Mushaf, both side by side, or a blank whiteboard for working something out.",
    target: ".mode-toggle",
    view:  { mode: "split" },
  },
  {
    title: "The Mushaf.",
    body:  "Every page as it is printed. Press Study, or the sūrah’s name, to write on it.",
    target: ".qcf-page",
    view:  { mode: "canvas" },
  },
  {
    title: "Study Mode.",
    body:  "Pen, highlighter, arrow, eraser, lasso and text. Tap a word or an āyah to give it notes of its own on the same page; the rest of your ink steps back while you write.",
    target: ".study-rail-wrap[data-visible=\"true\"] .canvas-tool-rail",
    view:  { mode: "canvas", study: true },
  },
  {
    title: "116 tafāsīr.",
    body:  "Classical commentary in 33 languages, word by word, and background on each sūrah. Highlight a line and embed just that into your notes, or the whole entry.",
    target: ".drawer-overlay[data-open=\"true\"]",
    view:  { mode: "editor", tafsir: true },
  },
  {
    title: "Ask Lab AI.",
    body:  "Ask anything about the sūrah. It searches the tafāsīr and shows you where each part of its answer comes from.",
    target: ".lab",
    view:  { mode: "editor", ai: true },
  },
  {
    title: "Study together.",
    body:  "Invite others to a workspace and you write on the same pages live, with each person’s name on their cursor.",
    target: ".live-pill",
    view:  { mode: "editor" },
  },
  {
    title: "A page for every part.",
    body:  "Add pages in the sidebar for each part of your study. From your dashboard you can also start book study, the Forty Ḥadīth, boards and Arabic.",
    target: ".sidebar",
    view:  { mode: "editor" },
  },
];

const TOTAL_STEPS = STEPS.length;

/** Ask the workspace for exactly what a step shows. */
function show(view: View | undefined) {
  if (!view) return;
  window.dispatchEvent(new CustomEvent("tl-tour-mode", { detail: view.mode }));
  window.dispatchEvent(new CustomEvent("tl-tour-panels", {
    detail: { tafsir: !!view.tafsir, ai: !!view.ai, formatting: !!view.formatting },
  }));
  /* Study Mode belongs to the Mushaf, which mounts after the mode switch;
     give it a moment to be there to hear the request. */
  if (view.mode === "canvas") {
    const action = view.study ? "study" : "leave-study";
    setTimeout(() => window.dispatchEvent(new CustomEvent("tl-tour-action", { detail: action })), 350);
  }
}

const TUTORIAL_WORKSPACE = "Tutorial Workspace";
const TUTORIAL_PAGE      = "The Names of al-Fātiḥah";

/** The visitor's existing tutorial page, if they have one. */
async function findTutorialPage(): Promise<{ workspaceId: string; pageId: string } | null> {
  try {
    const res = await fetch("/api/workspaces");
    if (!res.ok) return null;
    const { workspaces = [] } = await res.json() as { workspaces?: { id: string; name: string }[] };
    for (const ws of workspaces.filter((w) => w.name === TUTORIAL_WORKSPACE)) {
      const pr = await fetch(`/api/workspaces/${ws.id}/surahs/1/pages`);
      if (!pr.ok) continue;
      const { pages = [] } = await pr.json() as { pages?: { id: string; title: string }[] };
      const page = pages.find((p) => p.title === TUTORIAL_PAGE);
      if (page) return { workspaceId: ws.id, pageId: page.id };
    }
  } catch { /* fall through and build a fresh one */ }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TourBubble() {
  const [tour,    setLocal]   = useState<TourState | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const pathname = usePathname();
  const router   = useRouter();
  const busy     = useRef(false);

  // ── Sync from localStorage ────────────────────────────────────────────────
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

  /* ── Arriving from /beta ──────────────────────────────────────────────────
     /api/beta/start has already built the workspace, the seeded page and the
     Connections that step 0 would otherwise create from the browser, so the
     tour joins at step 1 with those ids taken from the URL it landed on.
     Starting at 0 here would build a SECOND workspace and leave the visitor
     looking at the wrong one. The flag leaves the address bar at once, or
     the tour would restart on every reload. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("tour") !== "1") return;

    const m = pathname.match(/^\/workspaces\/([^/]+)(?:\/surahs\/\d+\/pages\/([^/]+))?/);
    // Replaying is the point of following this link, so a finished tour must not suppress it.
    localStorage.removeItem("tl-tutorial-done");
    setTour({ active: true, step: m?.[2] ? 1 : 0, workspaceId: m?.[1], pageId: m?.[2] });

    url.searchParams.delete("tour");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [pathname]);

  // ── Auto-advance when the visitor gets to the page on their own ──────────
  useEffect(() => {
    const t = getTour();
    if (!t?.active) return;
    if (onSurah(pathname) && t.step === 0) setTour({ ...t, step: 1 });
  }, [pathname]);

  /* Arriving on the page at a step (a reload, or straight from step 0): put
     the workspace in that step's view once it has had a moment to mount. */
  useEffect(() => {
    const t = getTour();
    if (!t?.active || !onSurah(pathname) || t.step < 1 || t.step >= TOTAL_STEPS) return;
    const id = setTimeout(() => show(STEPS[t.step].view), 600);
    return () => clearTimeout(id);
  }, [pathname]);

  /* Hooks must run unconditionally, so the target is resolved here rather
     than beside the render where the early returns live. */
  const spotRect = useSpotlightTarget(
    tour && tour.step < TOTAL_STEPS ? STEPS[tour.step]?.target : null,
  );

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => { clearTour(); setLocal(null); setLeaving(false); }, 260);
  }, []);

  /** Move to a step, putting the workspace in the view that step explains. */
  const goTo = useCallback((t: TourState, step: number) => {
    setError(null);
    setTour({ ...t, step });
    setLocal({ ...t, step });
    if (step < TOTAL_STEPS) show(STEPS[step].view);
  }, []);

  /* Back never undoes anything: no step after the first creates data. Step
     0 builds the workspace, so the tour never goes back to it. */
  const back = useCallback(() => {
    const t = getTour();
    if (!t || busy.current || t.step <= 1) return;
    goTo(t, t.step - 1);
  }, [goTo]);

  // ── Next ──────────────────────────────────────────────────────────────────
  const next = useCallback(async () => {
    const t = getTour();
    if (!t || busy.current) return;
    setError(null);

    if (t.step === 0) {
      busy.current = true;
      setLoading(true);
      try {
        /* Replaying the tour, or a demo account that was seeded with one,
           goes back to the tutorial workspace it already has rather than
           building another beside it every time. */
        const existing = await findTutorialPage();
        if (existing) {
          setTour({ ...t, step: 1, ...existing });
          pushWithSplash(router, `/workspaces/${existing.workspaceId}/surahs/1/pages/${existing.pageId}`);
          return;
        }

        const wsRes = await fetch("/api/workspaces", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name: TUTORIAL_WORKSPACE, type: "private" }),
        });
        if (!wsRes.ok) throw new Error("Couldn’t make the tutorial workspace. Try again.");
        const wsBody = await wsRes.json();
        const workspace = wsBody.workspace ?? wsBody;

        await fetch(`/api/workspaces/${workspace.id}/surahs`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ surahNumber: 1 }),
        });

        /* The page has real notes in it: walking actual study notes shows
           what each feature is for, where an empty page could only describe it. */
        const pgRes = await fetch(`/api/workspaces/${workspace.id}/surahs/1/pages`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ title: TUTORIAL_PAGE, tiptapContent: fatihaNotesDoc() }),
        });
        if (!pgRes.ok) throw new Error("Couldn’t open the tutorial page. Try again.");
        const pgBody = await pgRes.json();
        const page = pgBody.page ?? pgBody;

        /* Two Connections, so /link has something to show. A missing demo
           Connection is not worth stopping the tour for. */
        await Promise.allSettled(DEMO_CONNECTIONS.map((c) =>
          fetch(`/api/workspaces/${workspace.id}/connections`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ ...c, tags: [...c.tags] }),
          })));

        setTour({ ...t, step: 1, workspaceId: workspace.id, pageId: page.id });
        pushWithSplash(router, `/workspaces/${workspace.id}/surahs/1/pages/${page.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Setting up didn’t work. Try again.");
      } finally {
        setLoading(false);
        /* eslint-disable-next-line require-atomic-updates --
           `busy` is a re-entrancy mutex, not derived state: the guard at the
           top of next() and the `busy.current = true` above sit in the same
           tick, so two clicks cannot both get past it. Releasing it here is
           the only correct place, or the tour would wedge. */
        busy.current = false;
      }
    } else if (t.step < TOTAL_STEPS) {
      goTo(t, t.step + 1);
    } else {
      dismiss();
    }
  }, [router, dismiss, goTo]);

  if (!tour?.active) return null;
  const step = tour.step;

  // ── Visibility guard ──────────────────────────────────────────────────────
  const wrongPage =
    (step === 0 && !onHome(pathname)) ||
    (step >= 1 && step < TOTAL_STEPS && !onSurah(pathname));
  if (wrongPage && step < TOTAL_STEPS) return null;

  // ── Finale ────────────────────────────────────────────────────────────────
  if (step >= TOTAL_STEPS) {
    return (
      <div className={`tr-finale${leaving ? " tr-out" : " tr-in"}`} role="dialog" aria-label="Tour finished">
        <div className="tr-finale-card">
          <p className="tr-bismillah-ar" lang="ar" dir="rtl">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</p>
          <h2 className="tr-finale-title">You’re ready.</h2>
          <p className="tr-finale-msg">
            Your tutorial workspace stays on your dashboard. May your study be of benefit.
          </p>
          <button className="tr-begin-btn" onClick={dismiss} autoFocus>Begin studying</button>
        </div>
      </div>
    );
  }

  // ── A step ────────────────────────────────────────────────────────────────
  const s = STEPS[step];
  const last = step === TOTAL_STEPS - 1;

  return (
    <>
      {/* Dims the page and cuts a hole around what this step is about. It
          draws nothing when the step has no target or the target is off
          screen, so the card always works even if a selector goes stale. */}
      <TourSpotlight rect={spotRect} />
      <div
        className={`tr-bubble${s.view?.tafsir || s.view?.ai ? " tr-bubble--left" : ""}${leaving ? " tr-out" : " tr-in"}`}
        role="dialog" aria-live="polite" aria-label="Tour"
      >
        <div className="tr-bubble-top">
          <span className="tr-count">{step === 0 ? "Tour" : `${step} of ${TOTAL_STEPS - 1}`}</span>
          <button className="tr-skip" onClick={dismiss}>{step === 0 ? "Not now" : "End tour"}</button>
        </div>

        {/* Keyed so each step's words arrive, rather than swapping in place. */}
        <div className="tr-step" key={step}>
          <h3 className="tr-title">{s.title}</h3>
          <p className="tr-body">{s.body}</p>
        </div>

        {error && <p className="tr-error" role="alert">{error}</p>}

        <div className="tr-actions">
          {step > 1 && (
            <button className="tr-back-btn" onClick={back} disabled={loading}>Back</button>
          )}
          <button className="tr-next-btn" onClick={next} disabled={loading}>
            {loading ? "Setting up…" : step === 0 ? "Show me round" : last ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
