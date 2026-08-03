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
import { fatihaNotesDoc, DEMO_CONNECTIONS } from "@/lib/demo/fatiha-notes";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getTour, setTour, clearTour, type TourState } from "@/lib/tour";
import TourSpotlight, { useSpotlightTarget } from "./TourSpotlight";

// ── Route matchers ────────────────────────────────────────────────────────────
const onHome  = (p: string) => p.startsWith("/home");
const onSurah = (p: string) => /^\/workspaces\/[^/]+\/surahs/.test(p);

// ── Step content ──────────────────────────────────────────────────────────────
/* Every target below is a selector that actually exists in the shipped UI —
   a tour that points at nothing is worse than no tour. Steps without a target
   are narrated over the page rather than anchored. Kept short: this is an
   orientation, not documentation. */
const STEPS: readonly {
  title: string; body: string; cta: string; target?: string;
}[] = [
  {
    title: "Welcome to TafsirLab",
    body:  "We'll create a tutorial workspace and open the editor so you can see how everything works.",
    cta:   "Set up my tutorial →",
  },
  {
    title: "Write your tafsīr",
    body:  "These are real notes on the seven names of al-Fātiḥah — scroll them. Type '/' for commands: /ayah embeds a verse, /tafsir embeds commentary, /help lists everything.",
    cta:   "Next: formatting →",
    target: ".page-editor-content",
  },
  {
    title: "Format as you write",
    body:  "Bold, colour, headings, lists and quotes. Undo and redo sit at the left, and the format painter copies styling from one passage to another.",
    cta:   "Next: size and tables →",
    target: ".et-ribbon-strip",
  },
  {
    title: "Font size and tables",
    body:  "Set any size before or after typing — Arabic often wants more than the English beside it. The table button inserts a grid you can extend row by row.",
    cta:   "Next: the workspace →",
    target: ".et-size",
  },
  {
    title: "The page grows with you",
    body:  "Notes start at the left and the sheet extends as you fill it — down as you write, sideways when a table or a moved box needs the room. Click any empty spot to start a new block of text there.",
    cta:   "Next: switch views →",
    target: ".page-editor",
  },
  {
    title: "Editor, Canvas, Split, Board",
    body:  "Annotate the Muṣḥaf, write beside it, or open a blank board. Scroll to zoom — far enough out to see a whole study page at once.",
    cta:   "Next: the Muṣḥaf →",
    target: ".mode-toggle",
  },
  {
    title: "Annotate the Muṣḥaf",
    body:  "Tap the Surah name to enter study mode, then draw straight onto the page. The āyah blocks in your notes resize from any corner.",
    cta:   "Next: tafsīr →",
    target: ".qcf-page",
  },
  {
    title: "Tafsīr and Surah Info",
    body:  "Classical commentary from dozens of sources. Surah Info is a separate section — background on the Surah as a whole, kept out of the commentary.",
    cta:   "Next: embedding →",
    target: ".drawer-tabs",
  },
  {
    title: "Embed all of it, or just a line",
    body:  "Highlight a passage in the commentary and embed only that, or take the whole entry. Either way the source and āyah travel with it.",
    cta:   "Next: Connections →",
    target: ".tafsir-embed",
  },
  {
    title: "Connect two passages",
    body:  "Type /link to record a munāsabah. You choose BOTH ends — the passage you are linking from and the one you are linking to. The notes above suggest one worth making.",
    cta:   "Next: the map →",
    target: ".page-editor-content",
  },
  {
    /* Anchored to the sidebar, which IS on screen. The Connections view and
       the book shelf live elsewhere in the workspace, so they are described
       as somewhere to go rather than as something you are looking at — the
       previous wording pointed at them as if they were visible here. */
    title: "Connections you can already see",
    body:  "Two are seeded in this workspace: one joins al-Fātiḥah to al-Ḥijr 15:87, one stays inside al-Fātiḥah. Open Connections from the workspace to see them as a list and as a map.",
    cta:   "Next: your pages →",
    target: ".tree",
  },
  {
    title: "Pages, boards and books",
    body:  "Add pages in the sidebar — they open the moment you create them. The workspace home also has blank boards, and book study for annotating a classical matn.",
    cta:   "Done →",
    target: ".sidebar",
  },
];

const TOTAL_STEPS = STEPS.length;

/** The view mode each step needs. Absent means "leave the view alone". */
const STEP_MODE: Record<number, "editor" | "canvas" | "split"> = {
  1: "editor",   // write your tafsīr
  2: "editor",   // formatting
  3: "editor",   // size + tables
  4: "editor",   // the growing sheet
  5: "split",    // the mode switcher itself
  6: "canvas",   // annotate the Muṣḥaf
  7: "editor",   // tafsīr drawer sits over the editor
  8: "editor",   // embedding
  9: "editor",   // /link
  10: "editor",  // Connections
  11: "editor",  // pages and books
};

/** Steps whose target only exists once the drawer is open. */
const STEP_OPENS_TAFSIR = new Set([7, 8]);

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

        /* 3. Create the page WITH real notes in it. The tour used to open an
              empty page and describe features in the abstract; walking actual
              study notes shows what the features are for. */
        const pgRes = await fetch(`/api/workspaces/${workspace.id}/surahs/1/pages`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            title: "The Names of al-Fātiḥah",
            tiptapContent: fatihaNotesDoc(),
          }),
        });
        if (!pgRes.ok) throw new Error("Could not create page");
        const pgBody = await pgRes.json();
        const page = pgBody.page ?? pgBody; // API returns { page: {...} }

        /* 4. Seed a couple of Connections so the list and the map are not
              empty when the tour reaches them. One crosses Surahs and one
              stays inside al-Fātiḥah, because the map draws those differently
              and both cases are worth seeing. Failures are swallowed: a
              missing demo Connection is not worth blocking the tour over. */
        await Promise.allSettled(DEMO_CONNECTIONS.map((c) =>
          fetch(`/api/workspaces/${workspace.id}/connections`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ ...c, tags: [...c.tags] }),
          })));

        // 5. Store IDs, advance step, navigate
        setTour({ ...t, step: 1, workspaceId: workspace.id, pageId: page.id });
        pushWithSplash(router, `/workspaces/${workspace.id}/surahs/1/pages/${page.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Setup failed — please try again.");
      } finally {
        setLoading(false);
        busy.current = false;
      }

    } else if (t.step < TOTAL_STEPS) {
      /* The view each step needs to be looking at. Derived from the step
         index rather than a chain of hard-coded branches, so adding a step
         does not require rewiring the ones after it — the previous version
         hard-coded step 5 as the finale in four separate places, and any new
         step silently ended the tour early. */
      const mode = STEP_MODE[t.step + 1];
      if (mode) emitMode(mode);
      if (STEP_OPENS_TAFSIR.has(t.step + 1)) {
        setTimeout(() => emitAction("open-tafsir"), 120);
      }
      setTour({ ...t, step: t.step + 1 });

    } else {
      dismiss();
    }
  }, [router, dismiss]);

  if (!tour?.active) return null;

  const step = tour.step;

  // ── Visibility guard ──────────────────────────────────────────────────────
  const wrongPage =
    (step === 0 && !onHome(pathname)) ||
    (step >= 1 && step < TOTAL_STEPS && !onSurah(pathname));
  if (wrongPage && step < TOTAL_STEPS) return null;

  // ── Finale, after the last bubble ─────────────────────────────────────────
  if (step >= TOTAL_STEPS) {
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
