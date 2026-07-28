"use client";

/**
 * TourBubble — in-app product tour.
 *
 * Steps (route-aware):
 *   0  /home            — creates tutorial workspace + page, navigates in
 *   1  page / editor    — write something
 *   2  page / canvas    — draw on the Mushaf  (emits tl-tour-mode:canvas)
 *   3  page / split     — write + Mushaf side by side (emits tl-tour-mode:split)
 *   4  page / tafsir    — Ibn Kathir panel   (emits tl-tour-action:open-tafsir)
 *   5  finale           — Bismillah full-screen
 *
 * WorkspacePageView listens for "tl-tour-mode" and "tl-tour-action" CustomEvents
 * to switch view modes and open panels without prop-threading.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getTour, setTour, clearTour, type TourState } from "@/lib/tour";
import TourSpotlight, { useSpotlightTarget } from "./TourSpotlight";

// ── Route matchers ────────────────────────────────────────────────────────────
const onHome  = (p: string) => p.startsWith("/home");
const onSurah = (p: string) => /^\/workspaces\/[^/]+\/surahs/.test(p);

// ── Step content ──────────────────────────────────────────────────────────────
const STEPS: readonly {
  title: string; body: string; cta: string; target?: string;
}[] = [
  {
    title: "Welcome to TafsirLab",
    body:  "We'll create a tutorial workspace and open the editor so you can see how everything works.",
    cta:   "Set up my tutorial →",
  },
  {
    title: "Write your tafsir",
    body:  "This is your writing space. Type your notes, press '/' for commands — try /ayah 1:1 to embed a verse with Arabic text and translation.",
    cta:   "Next: annotate the Mushaf →",
    target: ".page-editor-content",
  },
  {
    title: "Annotate the Mushaf",
    body:  "You're now in Mushaf view. Tap the surah name to open study mode, then draw straight onto the page.",
    cta:   "Next: try split mode →",
    target: ".qcf-page",
  },
  {
    title: "Study side by side",
    body:  "Split mode shows the editor and the Mushaf at the same time. Write your notes while keeping the Quran open beside you.",
    cta:   "Next: view the tafsir →",
    target: ".mode-toggle",
  },
  {
    title: "Ibn Kathīr tafsir",
    body:  "The tafsir panel loads classical commentary. In the editor type /tafsir 1:1 to embed it directly into your notes.",
    cta:   "Done →",
    target: ".drawer-overlay[data-open='true']",
  },
];

const TOTAL_STEPS = STEPS.length; // 5 bubble steps; step 5 is the finale

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

  // ── Auto-advance when user navigates naturally ────────────────────────────
  useEffect(() => {
    const t = getTour();
    if (!t?.active) return;
    // If user somehow got to surah page while tour is still on step 0
    if (onSurah(pathname) && t.step === 0) setTour({ ...t, step: 1 });
  }, [pathname]);

  // ── Dismiss ───────────────────────────────────────────────────────────────
  /* Hooks must run unconditionally, so the target is resolved here rather
     than beside the render where the early returns live. */
  const spotRect = useSpotlightTarget(
    tour && tour.step < TOTAL_STEPS ? STEPS[tour.step]?.target : null,
  );

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => { clearTour(); setLocal(null); setLeaving(false); }, 300);
  }, []);

  /* Back. Only ever moves the pointer and re-emits that step's view mode —
     it never undoes anything, because no step beyond the first creates data.
     Step 0 is excluded in the UI: it is the one step that DOES create the
     tutorial workspace, so returning to it must not be possible. */
  const back = useCallback(() => {
    const t = getTour();
    if (!t || busy.current || t.step <= 1) {
      if (t && t.step === 1) return;  // nothing to return to
      return;
    }
    const prev = t.step - 1;
    setTour({ ...t, step: prev });
    setLocal({ ...t, step: prev });
    setError(null);
    // Restore the view that step was explaining.
    if (prev === 2) emitMode("canvas");
    else if (prev === 3) emitMode("split");
    else if (prev >= 1) emitMode("editor");
  }, []);

  // ── Emit mode/action events to WorkspacePageView ──────────────────────────
  function emitMode(mode: "editor" | "canvas" | "split") {
    window.dispatchEvent(new CustomEvent("tl-tour-mode", { detail: mode }));
  }
  function emitAction(action: string) {
    window.dispatchEvent(new CustomEvent("tl-tour-action", { detail: action }));
  }

  // ── Next ──────────────────────────────────────────────────────────────────
  const next = useCallback(async () => {
    const t = getTour();
    if (!t || busy.current) return;
    setError(null);

    if (t.step === 0) {
      // Create tutorial workspace → start surah 1 → create page → navigate
      busy.current = true;
      setLoading(true);
      try {
        // 1. Create workspace
        const wsRes = await fetch("/api/workspaces", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name: "Tutorial Workspace", type: "private" }),
        });
        if (!wsRes.ok) throw new Error("Could not create workspace");
        const wsBody = await wsRes.json();
        const workspace = wsBody.workspace ?? wsBody; // handle both shapes

        // 2. Start surah 1 (idempotent)
        await fetch(`/api/workspaces/${workspace.id}/surahs`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ surahNumber: 1 }),
        });

        // 3. Create a page
        const pgRes = await fetch(`/api/workspaces/${workspace.id}/surahs/1/pages`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ title: "My First Notes" }),
        });
        if (!pgRes.ok) throw new Error("Could not create page");
        const pgBody = await pgRes.json();
        const page = pgBody.page ?? pgBody; // API returns { page: {...} }

        // 4. Store IDs, advance step, navigate
        setTour({ ...t, step: 1, workspaceId: workspace.id, pageId: page.id });
        pushWithSplash(router, `/workspaces/${workspace.id}/surahs/1/pages/${page.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Setup failed — please try again.");
      } finally {
        setLoading(false);
        busy.current = false;
      }

    } else if (t.step === 1) {
      // Switch to Mushaf canvas
      emitMode("canvas");
      setTour({ ...t, step: 2 });

    } else if (t.step === 2) {
      // Switch to split mode
      emitMode("split");
      setTour({ ...t, step: 3 });

    } else if (t.step === 3) {
      // Open tafsir drawer, switch back to editor view
      emitMode("editor");
      setTimeout(() => emitAction("open-tafsir"), 120);
      setTour({ ...t, step: 4 });

    } else if (t.step === 4) {
      // Advance to Bismillah finale
      setTour({ ...t, step: 5 });

    } else if (t.step === 5) {
      dismiss();
    }
  }, [router, dismiss]);

  if (!tour?.active) return null;

  const step = tour.step;

  // ── Visibility guard ──────────────────────────────────────────────────────
  const wrongPage =
    (step === 0 && !onHome(pathname)) ||
    (step >= 1 && step <= 4 && !onSurah(pathname));
  if (wrongPage && step < 5) return null;

  // ── Step 5: Bismillah finale ──────────────────────────────────────────────
  if (step === 5) {
    return (
      <div className={`tr-finale${leaving ? " tr-out" : " tr-in"}`}>
        <div className="tr-finale-card">
          <p className="tr-bismillah-ar">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
          <p className="tr-bismillah-en">
            In the name of God, the Most Gracious, the Most Merciful
          </p>
          <div className="tr-finale-divider" />
          <p className="tr-finale-msg">
            Your tutorial workspace is ready. May your study be of benefit.
          </p>
          <button className="tr-begin-btn" onClick={dismiss}>
            Begin studying →
          </button>
        </div>
      </div>
    );
  }

  // ── Steps 0–4: floating bubble ────────────────────────────────────────────
  const s = STEPS[step];

  return (
    <>
    {/* Dims the page and cuts a hole around whatever this step is about.
        Renders nothing when the step has no target or the target is not on
        screen, so the bubble always works even if a selector goes stale. */}
    <TourSpotlight rect={spotRect} />
    <div className={`tr-bubble${leaving ? " tr-out" : " tr-in"}`}>
      <div className="tr-bubble-top">
        <div className="tr-dots">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span
              key={i}
              className={`tr-dot${
                i === step     ? " tr-dot--cur"  :
                i < step       ? " tr-dot--done" : ""
              }`}
            />
          ))}
        </div>
        <button className="tr-skip" onClick={dismiss}>Skip tour</button>
      </div>

      <h3 className="tr-title">{s.title}</h3>
      <p  className="tr-body">{s.body}</p>

      {error && <p className="tr-error">{error}</p>}

      <div className="tr-actions">
        {/* Back appears from the second step on — nothing to go back to
            from the first, and a permanently disabled control is noise. */}
        {step > 0 && (
          <button className="tr-back-btn" onClick={back} disabled={loading}>
            Back
          </button>
        )}
        <button
          className="tr-next-btn"
          onClick={next}
          disabled={loading}
        >
          {loading ? "Setting up…" : s.cta}
        </button>
      </div>
    </div>
    </>
  );
}
