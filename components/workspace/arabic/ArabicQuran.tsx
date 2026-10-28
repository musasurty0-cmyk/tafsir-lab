"use client";

/**
 * The Qurʾān, inside an Arabic study workspace.
 *
 * The same Mushaf page Qurʾān study draws (QCFMushafPage), on the same paper,
 * with the same page turner and zoom — only two things differ, and only
 * here: tapping a word opens what it is (dictionary form, root, grammar, and
 * which of your cards it is), and the words you are learning or have learnt
 * are drawn red and green. Qurʾān study itself is untouched.
 *
 * A word counts as one of yours when a card in your lessons matches it in
 * the Qurʾān with the same meaning (lib/arabic/quran-match), and every form
 * of that dictionary word is coloured — learn قَلْب and قُلُوبِهِمْ lights up.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCw, X } from "lucide-react";
import Rail from "../Rail";
import QCFMushafPage from "../QCFMushafPage";
import type { Chapter, QCFVerse } from "@/lib/types";
import { statusOf } from "@/lib/arabic/srs";
import { cardHeadword, lookup } from "@/lib/arabic/quran-match";
import { describe, rootLetters } from "@/lib/arabic/morph";
import {
  loadQuranIndex, loadRoots, loadMorph, type LemmaRow, type MorphWord, type RootIndex,
} from "@/lib/arabic/quran-index-client";
import { useOverlayMotion } from "@/lib/use-overlay-motion";
import { useDismissable } from "@/lib/use-dismissable";
import RootFamily, { LemmaForms, lemmaKind } from "./RootFamily";
import { lessonLabel } from "./lesson-label";

interface WordCard {
  id: string; english: string; arabic: string; box: number;
  lesson: { id: string; level: number; number: number | null; kind: string; title: string };
}
interface Picked { verseKey: string; position: number }

const CARD_WIDTH = 720;
const COLOUR_KEY = "tl-arabic-quran-colour";

export default function ArabicQuran({
  workspaceId, chapters, pages: surahPages, initialSurah, initialPage, initialWord,
}: {
  workspaceId: string; chapters: Chapter[]; initialSurah: number; initialPage?: number;
  /** This sūrah's Mushaf pages, from its own verses (as in Qurʾān study). */
  pages?: number[];
  initialWord?: { verseKey: string; position: number };
}) {
  const router = useRouter();
  useLayoutEffect(() => {
    document.getElementById("tl-nav-splash")?.remove();
    document.getElementById("tl-nav-splash-style")?.remove();
  }, []);

  const surah = initialSurah;
  const chapter = chapters.find((c) => c.id === surah) ?? chapters[0];
  const pages = useMemo(() => {
    if (surahPages?.length) return surahPages;
    const [a, b] = chapter.pages;
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }, [chapter, surahPages]);
  const [page, setPage] = useState(initialPage ?? pages[0]);

  // ── The page, exactly as Qurʾān study loads it ──────────────────────────
  /* Keyed by what was loaded, so "still loading" is simply "not this page
     yet" — nothing has to be reset when the page changes. */
  const [loaded, setLoaded] = useState<{ key: string; verses: QCFVerse[] } | null>(null);
  const pageKey = `${chapter.id}:${page}`;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/quran/page/${page}?v=2`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { verses?: QCFVerse[] }) => {
        if (!cancelled) {
          setLoaded({ key: pageKey, verses: (d.verses ?? []).filter((v) => v.verse_key.startsWith(`${chapter.id}:`)) });
        }
      })
      .catch(() => { if (!cancelled) setLoaded({ key: pageKey, verses: [] }); });
    return () => { cancelled = true; };
  }, [page, chapter.id, pageKey]);
  const loading = loaded?.key !== pageKey;
  const verses = useMemo(() => (loading ? [] : loaded!.verses), [loading, loaded]);

  // ── What you know ───────────────────────────────────────────────────────
  const [colour, setColour] = useState(true);
  useEffect(() => {
    // A preference from this browser's storage, so it can only be read here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { if (localStorage.getItem(COLOUR_KEY) === "off") setColour(false); } catch { /* private mode */ }
  }, []);
  const toggleColour = () => setColour((v) => {
    try { localStorage.setItem(COLOUR_KEY, v ? "off" : "on"); } catch { /* private mode */ }
    return !v;
  });

  const [byLemma, setByLemma] = useState<Map<string, { box: number; cards: WordCard[] }>>(new Map());
  useEffect(() => {
    let live = true;
    void (async () => {
      const [res, index] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/arabic/words`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        loadQuranIndex(),
      ]);
      if (!live || !index || !res?.cards) return;
      const m = new Map<string, { box: number; cards: WordCard[] }>();
      for (const c of res.cards as WordCard[]) {
        const hit = lookup(index, cardHeadword(c.arabic, false), c.english);
        /* A word added from here is stored as its dictionary form, so it is
           found by that exactly even where the bare form never occurs. */
        const keys = new Set([hit?.lemma, c.lesson.kind === "mine" ? c.arabic : undefined]);
        for (const key of keys) {
          if (!key) continue;
          const e = m.get(key) ?? { box: 0, cards: [] };
          e.box = Math.max(e.box, c.box);
          e.cards.push(c);
          m.set(key, e);
        }
      }
      setByLemma(m);
    })();
    return () => { live = false; };
  }, [workspaceId]);

  const [morphFor, setMorphFor] = useState<{ surah: number; a: Record<string, MorphWord[]> | null } | null>(null);
  const morph = morphFor?.surah === chapter.id ? morphFor.a : null;
  const [roots, setRoots] = useState<RootIndex | null>(null);
  useEffect(() => {
    let live = true;
    void loadMorph(chapter.id).then((m) => { if (live) setMorphFor({ surah: chapter.id, a: m }); });
    void loadRoots().then((r) => { if (live) setRoots(r); });
    return () => { live = false; };
  }, [chapter.id]);

  const wordStatus = useMemo(() => {
    const out = new Map<string, "learning" | "learnt">();
    if (!colour || !morph) return out;
    for (const v of verses) {
      const ayah = v.verse_key.split(":")[1];
      for (const w of v.words) {
        if (w.char_type_name !== "word") continue;
        const lemma = morph[ayah]?.[w.position - 1]?.[1];
        const known = lemma ? byLemma.get(lemma) : undefined;
        const s = statusOf(known?.box);
        if (s !== "unknown") out.set(`${v.verse_key}:${w.position}`, s);
      }
    }
    return out;
  }, [colour, morph, verses, byLemma]);

  // ── Navigation and zoom ────────────────────────────────────────────────
  const [picked, setPicked] = useState<Picked | null>(initialWord ?? null);
  const at = pages.indexOf(page);
  const goTo = useCallback((p: number) => { setPage(p); setPicked(null); }, []);
  const prev = useCallback(() => { if (at > 0) goTo(pages[at - 1]); }, [at, pages, goTo]);
  const next = useCallback(() => { if (at < pages.length - 1) goTo(pages[at + 1]); }, [at, pages, goTo]);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  /* Your cards for the words on this page that you are learning or have
     learnt — what "Practise this page" asks. */
  const pageCards = useMemo(() => {
    if (!morph) return [];
    const ids = new Set<string>();
    for (const v of verses) {
      const ayah = v.verse_key.split(":")[1];
      for (const w of v.words) {
        const lemma = w.char_type_name === "word" ? morph[ayah]?.[w.position - 1]?.[1] : undefined;
        for (const c of (lemma ? byLemma.get(lemma)?.cards : undefined) ?? []) if (c.box > 0) ids.add(c.id);
      }
    }
    return [...ids];
  }, [morph, verses, byLemma]);

  const addWord = useCallback(async (w: MorphWord, english: string) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/arabic/words`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arabic: w[1], english }),
    });
    const data = await res.json().catch(() => ({})) as { cardId?: string };
    if (!res.ok || !data.cardId) return false;
    // Colour it at once: a new word goes in as learning.
    setByLemma((m) => {
      const next = new Map(m);
      const e = next.get(w[1]) ?? { box: 0, cards: [] };
      if (!e.cards.some((c) => c.id === data.cardId)) {
        e.cards = [...e.cards, {
          id: data.cardId!, english, arabic: w[1], box: 1,
          lesson: { id: "", level: 0, number: null, kind: "mine", title: "My words" },
        }];
      }
      e.box = Math.max(e.box, 1);
      next.set(w[1], { ...e });
      return next;
    });
    return true;
  }, [workspaceId]);

  const cardRef = useRef<HTMLDivElement>(null);
  const noop = useCallback(() => {}, []);
  // A new sūrah is a new page list, which the server works out.
  const chooseSurah = (n: number) => {
    if (chapters.some((x) => x.id === n)) router.push(`/workspaces/${workspaceId}/arabic/quran?surah=${n}`);
  };

  const pickedWord = picked && morph ? morph[picked.verseKey.split(":")[1]]?.[picked.position - 1] ?? null : null;
  const pickedGlyph = picked
    ? verses.find((v) => v.verse_key === picked.verseKey)?.words.find((w) => w.position === picked.position) ?? null
    : null;

  return (
    <div className="aq-shell">
      <Rail activeWorkspaceId={workspaceId} />
      <div className="aq-main">
        <header className="aq-bar">
          <button type="button" className="ar-back" onClick={() => pushWithSplash(router, `/workspaces/${workspaceId}`)}>
            <ChevronLeft size={15} aria-hidden /> All lessons
          </button>
          <select
            className="aq-surah"
            value={surah}
            onChange={(e) => chooseSurah(Number(e.target.value))}
            aria-label="Sūrah"
          >
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.id}. {c.name_simple}</option>)}
          </select>
          <span className="aq-sp" />
          {pageCards.length > 0 && (
            <button
              type="button"
              className="nw-btn nw-btn--primary aq-practise"
              onClick={() => pushWithSplash(router,
                `/workspaces/${workspaceId}/arabic/practice?scope=cards&ids=${pageCards.join(",")}&surah=${chapter.id}&page=${page}`)}
            >
              Practise this page · {pageCards.length}
            </button>
          )}
          {colour && (
            <span className="aq-legend" aria-hidden>
              <span className="aq-dot aq-dot--learning" /> Learning
              <span className="aq-dot aq-dot--learnt" /> Learnt
            </span>
          )}
          <button type="button" className="ar-toggle" role="switch" aria-checked={colour} onClick={toggleColour}>
            <span className="ar-toggle-knob" aria-hidden /> Colour my words
          </button>
        </header>

        <div className="mode-b-canvas aq-canvas">
          {/* Scrolls on its own, so the zoom and the page turner stay put. */}
          <div className="aq-scroll">
          <div className="aq-inner" style={{ width: CARD_WIDTH, zoom }}>
            <QCFMushafPage
              verses={verses}
              pageNumber={page}
              chapter={chapter}
              loading={loading}
              cardRef={cardRef}
              onRegisterAyahRef={noop}
              onRegisterWordRef={noop}
              onOpenFocus={(verseKey, position) => { if (position != null) setPicked({ verseKey, position }); }}
              studyMode
              selectedWordKey={picked ? `${picked.verseKey}:${picked.position}` : null}
              wordStatus={wordStatus}
            />
          </div>
          </div>

          <div className="mode-b-zoom-controls">
            <button className="mode-b-zoom-btn" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z / 1.15).toFixed(2)))}><Minus size={13} /></button>
            <span className="mode-b-zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="mode-b-zoom-btn" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.8, +(z * 1.15).toFixed(2)))}><Plus size={13} /></button>
            <button className="mode-b-zoom-btn mode-b-zoom-reset" title="Reset view" aria-label="Reset view" onClick={() => setZoom(1)}><RotateCw size={12} /></button>
          </div>

          {pages.length > 1 && (
            <div className="mode-b-pager">
              <button className="mode-b-pager-btn" disabled={at <= 0} onClick={prev} title="Previous page (←)" aria-label="Previous page">
                <ChevronLeft size={16} strokeWidth={2.2} />
              </button>
              <span className="mode-b-pager-label" aria-live="polite">
                Page {page}
                <span className="mode-b-pager-of">{at + 1} of {pages.length}</span>
              </span>
              <button className="mode-b-pager-btn" disabled={at >= pages.length - 1} onClick={next} title="Next page (→)" aria-label="Next page">
                <ChevronRight size={16} strokeWidth={2.2} />
              </button>
            </div>
          )}
        </div>
      </div>

      <QuranWordPanel
        open={!!picked}
        word={pickedWord}
        glyph={pickedGlyph ? { code: pickedGlyph.code_v2, page: pickedGlyph.v2_page ?? page } : null}
        verseKey={picked?.verseKey ?? ""}
        roots={roots}
        mine={pickedWord?.[1] ? byLemma.get(pickedWord[1]) ?? null : null}
        workspaceId={workspaceId}
        onAdd={addWord}
        onClose={() => setPicked(null)}
      />
    </div>
  );
}

// ── The tapped word ───────────────────────────────────────────────────────

function QuranWordPanel(p: {
  open: boolean; word: MorphWord | null; glyph: { code: string; page: number } | null;
  verseKey: string; roots: RootIndex | null; mine: { box: number; cards: WordCard[] } | null;
  workspaceId: string; onAdd: (w: MorphWord, english: string) => Promise<boolean>; onClose: () => void;
}) {
  const { mounted, state } = useOverlayMotion(p.open, 220);
  useDismissable(p.onClose, p.open);
  const [adding, setAdding] = useState<"idle" | "busy" | "failed">("idle");
  const wordKey = p.word ? `${p.verseKey}:${p.word[1]}` : "";
  const [addingFor, setAddingFor] = useState(wordKey);
  if (addingFor !== wordKey) { setAddingFor(wordKey); setAdding("idle"); }
  if (!mounted || !p.word) return null;

  const [rootKey, lemma, pos, tags, meaning] = p.word;
  const r = rootKey ? p.roots?.roots[rootKey] : undefined;
  const lemmas = (r?.slice(1) ?? []) as LemmaRow[];
  const lemmaRow = lemmas.find((l) => l[0] === lemma);

  return (
    <>
      <div className="wl-scrim aq-scrim" data-state={state} onClick={p.onClose} />
      <aside className="wl" data-state={state} role="dialog" aria-label="This word">
        <div className="wl-body">
          <header className="wl-head">
            <button type="button" className="wl-close" onClick={p.onClose} aria-label="Close"><X size={16} /></button>
            {p.glyph && (
              <p className="aq-glyph" dir="rtl" style={{ fontFamily: `p${p.glyph.page}-v2` }}
                 // Quran Foundation glyph codes only — no user input.
                 dangerouslySetInnerHTML={{ __html: p.glyph.code }} />
            )}
            <p className="wl-en">{meaning}</p>
            <p className="wl-tr">{describe(pos, tags)} · {p.verseKey}</p>
          </header>

          <dl className="wl-facts">
            {lemma && <div><dt>Dictionary form</dt><dd className="wl-fact-ar" dir="rtl" lang="ar">{lemma}</dd></div>}
            {rootKey && <div><dt>Root</dt><dd className="wl-fact-ar" dir="rtl" lang="ar">{rootLetters(rootKey)}</dd></div>}
            {lemmaRow && <div><dt>In the Qurʾān</dt><dd>{lemmaRow[1].toLocaleString()} time{lemmaRow[1] === 1 ? "" : "s"} · {lemmaKind(lemmaRow)}</dd></div>}
          </dl>

          <section className="wl-sec">
            <h3 className="wl-h">In your lessons</h3>
            {p.mine?.cards.length ? (
              <ul className="aq-mine">
                {p.mine.cards.slice(0, 6).map((c) => (
                  <li key={c.id} data-status={statusOf(c.box)}>
                    <span className="aq-mine-ar" dir="rtl" lang="ar">{c.arabic}</span>
                    <span className="aq-mine-en">{c.english}</span>
                    <span className="aq-mine-where">{c.lesson.kind === "mine" ? "My words" : `${lessonLabel(c.lesson)}, ${c.lesson.title}`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="aq-add">
                <p className="wl-none">Not in your lessons yet.</p>
                {lemma && (
                  <button
                    type="button"
                    className="nw-btn nw-btn--primary"
                    disabled={adding === "busy"}
                    onClick={async () => {
                      setAdding("busy");
                      const english = (lemmaRow?.[4] || meaning).replace(/^\([^)]*\)\s*/, "").trim();
                      const ok = await p.onAdd(p.word!, english);
                      setAdding(ok ? "idle" : "failed");
                    }}
                  >
                    {adding === "busy" ? "Adding…" : "Add to my words"}
                  </button>
                )}
                {adding === "failed" && <p className="ar-error">That didn’t save. Try again.</p>}
              </div>
            )}
          </section>

          {lemmaRow && lemmaRow.length > 5 && (
            <section className="wl-sec">
              <h3 className="wl-h">As it appears in the Qurʾān</h3>
              <LemmaForms row={lemmaRow} />
            </section>
          )}

          {r && rootKey && (
            <section className="wl-sec">
              <h3 className="wl-h">Its root</h3>
              <RootFamily root={rootKey} total={r[0]} lemmas={lemmas} current={lemma} />
            </section>
          )}

          <p className="wl-credit">Roots and grammar from the Quranic Arabic Corpus. Meanings from quran.com.</p>
        </div>
      </aside>
    </>
  );
}
