"use client";

/**
 * One lesson's cards, in the groups the course file gives them.
 *
 * Words are tiles — the Arabic large, the meaning under it — and sentences
 * are rows, because a sentence is read across rather than taken in at a
 * glance. The transliteration can be hidden, for when a student wants to
 * read the Arabic without the crutch; the choice is remembered on this device.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Check, MapPin, Play, Sparkles, NotebookPen } from "lucide-react";
import { statusOf } from "@/lib/arabic/srs";
import WordLens, { type LensCard } from "./WordLens";
import Rail from "../Rail";
import Toast from "@/components/Toast";
import { lessonLabel } from "./lesson-label";

interface Card {
  id: string; grp: number; english: string; arabic: string;
  translit: string | null; gender: string | null; isSentence: boolean;
}
interface Nav { id: string; level: number; number: number | null; kind: string; title: string }

interface Props {
  workspaceId: string;
  lesson: Nav & { cardCount: number; state: "covered" | "current" | null; cards: Card[] };
  /** This reader's box for each card answered so far (lib/arabic/srs). */
  boxes: Record<string, number>;
  prev: Nav | null;
  next: Nav | null;
}

const TRANSLIT_KEY = "tl-arabic-translit";
type Show = "all" | "words" | "sentences";

export default function ArabicLesson({ workspaceId, lesson, boxes, prev, next }: Props) {
  const router = useRouter();
  useLayoutEffect(() => {
    document.getElementById("tl-nav-splash")?.remove();
    document.getElementById("tl-nav-splash-style")?.remove();
  }, []);

  /* Follows the server's copy when it changes — moving to another lesson
     reuses this component — and is set optimistically in between. */
  const [state, setState] = useState(lesson.state);
  const [seen, setSeen] = useState(`${lesson.id}:${lesson.state}`);
  if (seen !== `${lesson.id}:${lesson.state}`) {
    setSeen(`${lesson.id}:${lesson.state}`);
    setState(lesson.state);
  }
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "error">("success");

  const [translit, setTranslit] = useState(true);
  useEffect(() => {
    /* Restoring a preference from the browser's storage, which does not exist
       until the browser does — reading it during render would make the server
       and client disagree. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { if (localStorage.getItem(TRANSLIT_KEY) === "off") setTranslit(false); } catch { /* private mode */ }
  }, []);
  const toggleTranslit = () => setTranslit((v) => {
    try { localStorage.setItem(TRANSLIT_KEY, v ? "off" : "on"); } catch { /* private mode */ }
    return !v;
  });

  const sentences = lesson.cards.filter((c) => c.isSentence).length;
  const words = lesson.cards.length - sentences;
  const [show, setShow] = useState<Show>("all");

  const groups = useMemo(() => {
    const shown = lesson.cards.filter((c) =>
      show === "all" || (show === "words" ? !c.isSentence : c.isSentence));
    const m = new Map<number, Card[]>();
    for (const c of shown) m.set(c.grp, [...(m.get(c.grp) ?? []), c]);
    return [...m.values()];
  }, [lesson.cards, show]);

  // A search result links to its card; bring it into view once it is drawn.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ block: "center" }); el.setAttribute("data-flash", "true"); }
  }, []);

  async function put(body: object, next: typeof state, message: string) {
    if (saving) return;
    setSaving(true);
    const before = state;
    setState(next);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/arabic/lessons/${lesson.id}/state`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setNoticeTone("success");
      setNotice(message);
      router.refresh();
    } catch {
      setState(before);
      setNoticeTone("error");
      setNotice("That didn’t save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const [lens, setLens] = useState<LensCard | null>(null);
  const [opening, setOpening] = useState(false);
  /* The lesson's notes and board: made the first time, then the same one. */
  const openBoard = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/arabic/lessons/${lesson.id}/board`, { method: "POST" });
      const data = await res.json() as { pageId?: string };
      if (!res.ok || !data.pageId) throw new Error();
      pushWithSplash(router, `/workspaces/${workspaceId}/whiteboard/${data.pageId}`);
    } catch {
      setNoticeTone("error");
      setNotice("Couldn’t open this lesson’s notes. Try again.");
      setOpening(false);
    }
  };
  const back = () => pushWithSplash(router, `/workspaces/${workspaceId}`);
  const practise = (scope: "lesson" | "unlock") =>
    pushWithSplash(router, `/workspaces/${workspaceId}/arabic/practice?scope=${scope}&lesson=${lesson.id}`);
  const unseen = lesson.cards.filter((c) => !c.isSentence && !(c.id in boxes)).length;
  const learnt = lesson.cards.filter((c) => statusOf(boxes[c.id]) === "learnt").length;
  const learning = lesson.cards.filter((c) => statusOf(boxes[c.id]) === "learning").length;

  return (
    <div className="workspace-home">
      <Toast message={notice} onDismiss={() => setNotice(null)} tone={noticeTone} />
      <WordLens card={lens} onClose={() => setLens(null)} />
      <Rail activeWorkspaceId={workspaceId} />

      <div className="workspace-home-content ar-lesson-page">
        <button type="button" className="ar-back" onClick={back}>
          <ChevronLeft size={15} aria-hidden /> All lessons
        </button>

        <header className="ar-lesson-head">
          <p className="ar-lesson-kicker">{lessonLabel(lesson)}</p>
          <h1 className="ar-lesson-title">{lesson.title}</h1>
          <p className="ar-lesson-meta">
            {words} word{words === 1 ? "" : "s"}{sentences ? ` · ${sentences} sentence${sentences === 1 ? "" : "s"}` : ""}
            {(learnt > 0 || learning > 0) && (<>
              <span aria-hidden> · </span>
              <span className="ar-k-learnt">{learnt} learnt</span>
              <span aria-hidden> · </span>
              <span className="ar-k-learning">{learning} learning</span>
            </>)}
          </p>

          <div className="ar-practise-row">
            {unseen > 0 && (
              <button type="button" className="nw-btn nw-btn--primary" onClick={() => practise("unlock")}>
                <Sparkles size={15} aria-hidden /> Unlock test · {unseen} word{unseen === 1 ? "" : "s"}
              </button>
            )}
            <button type="button" className={`nw-btn ${unseen > 0 ? "nw-btn--soft" : "nw-btn--primary"}`} onClick={() => practise("lesson")}>
              <Play size={14} aria-hidden /> Practise this lesson
            </button>
            <button type="button" className="nw-btn nw-btn--soft" onClick={openBoard} disabled={opening}>
              <NotebookPen size={14} aria-hidden /> {opening ? "Opening…" : "Notes and board"}
            </button>
          </div>

          <div className="ar-lesson-actions">
            <button
              type="button"
              className="ar-state-btn"
              data-on={state === "covered" || state === "current" ? "true" : "false"}
              disabled={saving}
              onClick={() => state === "covered" || state === "current"
                ? put({ state: null }, null, "Marked as not covered")
                : put({ state: "covered" }, "covered", "Marked as covered")}
            >
              <Check size={14} strokeWidth={2.6} aria-hidden />
              {state === "covered" || state === "current" ? "Covered" : "Mark as covered"}
            </button>
            {state !== "current" && lesson.kind === "lesson" && (
              <button
                type="button"
                className="ar-state-btn"
                disabled={saving}
                onClick={() => put({ placeHere: true }, "current", "This is now your current lesson")}
                title="Earlier lessons are marked as covered"
              >
                <MapPin size={14} aria-hidden /> I’m on this lesson
              </button>
            )}
            {state === "current" && <span className="ar-current ar-current--lg">Your current lesson</span>}

            <span className="ar-actions-sp" />

            {sentences > 0 && words > 0 && (
              <div className="ar-seg" role="radiogroup" aria-label="Show">
                {(["all", "words", "sentences"] as const).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={show === v}
                          data-active={show === v ? "true" : "false"} onClick={() => setShow(v)}>
                    {v === "all" ? "All" : v === "words" ? "Words" : "Sentences"}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="ar-toggle" role="switch" aria-checked={translit} onClick={toggleTranslit}>
              <span className="ar-toggle-knob" aria-hidden /> Transliteration
            </button>
          </div>
        </header>

        <div className="ar-groups" data-translit={translit ? "on" : "off"}>
          {groups.map((g, gi) => {
            const gw = g.filter((c) => !c.isSentence);
            const gs = g.filter((c) => c.isSentence);
            return (
              <section key={gi} className="ar-group">
                {gw.length > 0 && (
                  <div className="ar-words">
                    {gw.map((c) => (
                      <div key={c.id} id={`c-${c.id}`} className="ar-word" data-status={statusOf(boxes[c.id])}>
                        <button type="button" className="ar-ar ar-ar--btn" dir="rtl" lang="ar"
                                onClick={() => setLens(c)} title="Open this word">{c.arabic}</button>
                        <span className="ar-en">
                          {c.english}{c.gender && <span className="ar-g" title={c.gender === "f" ? "Feminine" : "Masculine"}>{c.gender}</span>}
                        </span>
                        {c.translit && <span className="ar-tr">{c.translit}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {gs.length > 0 && (
                  <ul className="ar-sentences">
                    {gs.map((c) => (
                      <li key={c.id} id={`c-${c.id}`} className="ar-sentence" data-status={statusOf(boxes[c.id])}>
                        <span className="ar-ar" dir="rtl" lang="ar">{c.arabic}</span>
                        <span className="ar-en">{c.english}</span>
                        {c.translit && <span className="ar-tr">{c.translit}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <nav className="ar-pager" aria-label="Other lessons">
          {prev ? (
            <Link href={`/workspaces/${workspaceId}/arabic/${prev.id}`} className="ar-pager-link">
              <ChevronLeft size={16} aria-hidden />
              <span><span className="ar-pager-k">{lessonLabel(prev)}</span>{prev.title}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link href={`/workspaces/${workspaceId}/arabic/${next.id}`} className="ar-pager-link ar-pager-link--next">
              <span><span className="ar-pager-k">{lessonLabel(next)}</span>{next.title}</span>
              <ChevronRight size={16} aria-hidden />
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
