"use client";

/**
 * A practice session: choose how, answer, see what you missed.
 *
 * The ways to be asked:
 *   flash     a flashcard: recall it, turn it over, grade yourself
 *             Again / Hard / Good / Easy, as in Anki
 *   type      the meaning, write the Arabic
 *   recall    the meaning, pick the Arabic
 *   meaning   the Arabic, pick its meaning
 *   listen    hear it, pick its meaning        (when the browser has an Arabic voice)
 *   context   the word highlighted in an āyah, pick its meaning
 *   cloze     an āyah with the word taken out, pick the word that fills it
 * The last two only for words that really occur in the Qurʾān, vowels and
 * all (lib/arabic/quran-match).
 *
 * "Mixed" asks from English into Arabic: mostly writing it, then picking it,
 * then the āyah gap. Arabic into English is the easy direction (the owner
 * found the meanings guessable from the options, 29 Oct 2026), so it is
 * there to choose but not mixed in.
 *
 * Each card's first answer in a session is what counts; a miss comes back a
 * few cards later so it is seen right once before the session ends. A
 * flashcard graded Again comes back until it isn't, up to three times.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Volume2, Check, X, ArrowRight, BookOpen, RotateCcw, Delete, Keyboard } from "lucide-react";
import Rail from "../Rail";
import { makeOptions, checkTyped, type Drill, type DrillCard, type Option, type Typed } from "@/lib/arabic/drill";
import { waitLabel, type Rating } from "@/lib/arabic/srs";
import { cardHeadword, lookup, type QuranHit } from "@/lib/arabic/quran-match";
import { loadQuranIndex, loadAyah, arabicVoice, speak, type Ayah } from "@/lib/arabic/quran-index-client";

type Scope = "due" | "lesson" | "unlock" | "cards";
type Choice = Drill | "mixed";
/** Which side of a flashcard is the front. */
type Face = "en" | "ar" | "both";

interface QueueCard extends DrillCard {
  translit: string | null; gender: string | null; box: number; due: boolean;
}
interface Item {
  key: string; card: QueueCard; drill: Drill; options: Option[];
  hit: QuranHit | null; place: { verseKey: string; word: number } | null;
  /** 0 the first time; each time a miss brings it back, one more. */
  round: number;
  /** A flashcard's front. */
  face: "en" | "ar";
}
interface Missed { card: QueueCard; chose: string; hit: QuranHit | null; drill: Drill }

interface Props {
  workspaceId: string;
  scope: Scope;
  lesson: { id: string; title: string; label: string } | null;
  /** For scope "cards": the cards to practise, and where to go back to. */
  cardIds?: string[];
  from?: { href: string; label: string; title: string } | null;
}

const DRILLS: { id: Choice; name: string; hint: string }[] = [
  { id: "mixed",   name: "Mixed",       hint: "English into Arabic: write it, pick it, fill the āyah" },
  { id: "flash",   name: "Flashcards",  hint: "Recall it, turn the card, grade yourself" },
  { id: "type",    name: "Write it",    hint: "See the meaning, write the Arabic" },
  { id: "recall",  name: "Recall",      hint: "See the meaning, pick the Arabic" },
  { id: "meaning", name: "Meaning",     hint: "See the Arabic, pick the meaning" },
  { id: "listen",  name: "Listen",      hint: "Hear it, pick the meaning" },
  { id: "context", name: "In context",  hint: "The word in an āyah, pick the meaning" },
  { id: "cloze",   name: "Āyah cloze",  hint: "Fill the gap in an āyah" },
];

const TRANSLIT_KEY = "tl-arabic-translit";

export default function ArabicPractice({ workspaceId, scope, lesson, cardIds, from }: Props) {
  const router = useRouter();
  useLayoutEffect(() => {
    document.getElementById("tl-nav-splash")?.remove();
    document.getElementById("tl-nav-splash-style")?.remove();
  }, []);

  const [phase, setPhase] = useState<"setup" | "loading" | "run" | "done">(scope === "unlock" ? "loading" : "setup");
  const [choice, setChoice] = useState<Choice>(scope === "unlock" ? "meaning" : "mixed");
  const [count, setCount] = useState(20);
  const [sentences, setSentences] = useState(false);
  const [face, setFace] = useState<Face>("en");
  const [voice, setVoice] = useState(false);
  const [translit, setTranslit] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Both live in the browser — its voices, and the transliteration choice
     made on the lesson page — so they can only be read once it is here. */
  useEffect(() => {
    const check = () => setVoice(!!arabicVoice());
    check();
    window.speechSynthesis?.addEventListener?.("voiceschanged", check);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { if (localStorage.getItem(TRANSLIT_KEY) === "off") setTranslit(false); } catch { /* private mode */ }
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", check);
  }, []);

  // ── Session ────────────────────────────────────────────────────────────
  const [items, setItems] = useState<Item[]>([]);
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  /** A written answer and how it was marked, once it is checked. */
  const [typed, setTyped] = useState<{ text: string; verdict: Typed } | null>(null);
  /** A flashcard turned over. */
  const [revealed, setRevealed] = useState(false);
  const [firstTotal, setFirstTotal] = useState(0);
  const [firstRight, setFirstRight] = useState(0);
  const [missed, setMissed] = useState<Missed[]>([]);
  const [ayahs, setAyahs] = useState<Record<string, Ayah | null>>({});
  const answered = useRef(new Set<string>());

  /* The cards a session would use, fetched while you choose, so the setup
     can say up front how many of them the Qurʾān drills can actually ask —
     and the session then uses exactly those cards. */
  const settingsKey = `${scope}:${lesson?.id ?? ""}:${count}:${sentences ? 1 : 0}`;
  const [preview, setPreview] = useState<{ key: string; cards: QueueCard[]; pool: DrillCard[]; quran: number } | null>(null);

  const fetchQueue = useCallback(async () => {
    const q = new URLSearchParams({
      scope, limit: String(scope === "unlock" || count === 0 ? 500 : count), sentences: sentences ? "1" : "0",
    });
    if (lesson) q.set("lesson", lesson.id);
    if (scope === "cards" && cardIds?.length) q.set("ids", cardIds.join(","));
    const res = await fetch(`/api/workspaces/${workspaceId}/arabic/review?${q}`);
    const data = await res.json() as { cards?: QueueCard[]; pool?: DrillCard[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Couldn’t load the cards.");
    return { cards: data.cards ?? [], pool: data.pool ?? [] };
  }, [scope, count, sentences, lesson, workspaceId, cardIds]);

  useEffect(() => {
    if (phase !== "setup") return;
    let live = true;
    const t = window.setTimeout(async () => {
      try {
        const [{ cards, pool }, index] = await Promise.all([fetchQueue(), loadQuranIndex()]);
        const quran = index
          ? cards.filter((c) => lookup(index, cardHeadword(c.arabic, c.isSentence), c.english)).length
          : 0;
        if (live) setPreview({ key: settingsKey, cards, pool, quran });
      } catch { /* the setup still works; it just cannot say */ }
    }, 150);
    return () => { live = false; window.clearTimeout(t); };
  }, [phase, fetchQueue, settingsKey]);

  const start = useCallback(async (override?: QueueCard[]) => {
    setPhase("loading");
    setError(null);
    try {
      let cards: QueueCard[];
      let pool: DrillCard[];
      if (override) {
        cards = override;
        pool = items.map((i) => i.card);
      } else if (preview?.key === settingsKey) {
        ({ cards, pool } = preview);
      } else {
        ({ cards, pool } = await fetchQueue());
      }
      if (cards.length === 0) {
        setError(scope === "unlock" ? "You’ve answered every card in this lesson already." : "Nothing is due. Come back later, or practise a lesson.");
        setPhase(scope === "unlock" ? "done" : "setup");
        return;
      }

      const needsQuran = choice === "mixed" || choice === "context" || choice === "cloze";
      const index = needsQuran ? await loadQuranIndex() : null;
      const built: Item[] = [];
      for (const card of cards) {
        const hit = index ? lookup(index, cardHeadword(card.arabic, card.isSentence), card.english) : null;
        let drill: Drill;
        if (choice === "mixed") {
          // Writing a whole sentence is a slog; a sentence is picked instead.
          const ways: Drill[] = card.isSentence ? ["recall"] : ["type", "type", "recall"];
          if (hit) ways.push("cloze");
          drill = ways[Math.floor(Math.random() * ways.length)];
        } else drill = choice;
        if ((drill === "context" || drill === "cloze") && !hit) continue;
        if (drill === "listen" && !voice) drill = "meaning";
        const place = hit ? hit.places[Math.floor(Math.random() * Math.min(3, hit.places.length))] : null;
        const own = drill === "type" || drill === "flash";      // no options to pick from
        built.push({
          key: `${card.id}:0`, card, drill, hit, place, round: 0,
          face: face === "both" ? (Math.random() < 0.5 ? "en" : "ar") : face,
          options: own ? [] : makeOptions(card, pool.length > 3 ? pool : [...pool, ...cards], drill),
        });
      }
      if (built.length === 0) {
        setError("None of these words appear in the Qurʾān in this form. Try Meaning or Recall.");
        setPhase("setup");
        return;
      }
      answered.current = new Set();
      setItems(built);
      setAt(0);
      setPicked(null);
      setTyped(null);
      setRevealed(false);
      setFirstTotal(0);
      setFirstRight(0);
      setMissed([]);
      setPhase("run");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t load the cards.");
      setPhase("setup");
    }
  }, [scope, choice, face, voice, items, preview, settingsKey, fetchQueue]);

  // The unlock test needs no choices; it starts at once.
  const started = useRef(false);
  useEffect(() => {
    if (scope === "unlock" && !started.current) { started.current = true; void start(); }
  }, [scope, start]);

  const item = items[at];

  // Load the āyah for this question and the next, so it is there when needed.
  useEffect(() => {
    for (const it of [items[at], items[at + 1]]) {
      const vk = it?.place?.verseKey;
      if (!vk || vk in ayahs) continue;
      void loadAyah(vk).then((a) => setAyahs((m) => ({ ...m, [vk]: a })));
    }
  }, [at, items, ayahs]);

  // Listening plays as the card appears.
  useEffect(() => {
    if (phase === "run" && item?.drill === "listen") speak(item.card.arabic);
  }, [phase, item]);

  /** Counts a card's first answer, saves it, and brings a miss back. */
  const record = useCallback((it: Item, correct: boolean, chose: string, rating?: Rating) => {
    if (!answered.current.has(it.card.id)) {
      answered.current.add(it.card.id);
      setFirstTotal((n) => n + 1);
      if (correct) setFirstRight((n) => n + 1);
      else setMissed((m) => [...m, { card: it.card, chose, hit: it.hit, drill: it.drill }]);
      void fetch(`/api/workspaces/${workspaceId}/arabic/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: [{ cardId: it.card.id, correct, unlock: scope === "unlock", ...(rating ? { rating } : {}) }] }),
      }).catch(() => { /* the next answer carries on; the schedule is forgiving */ });
    }
    // A miss comes back a few cards later, once (a flashcard until it is
    // known, up to three times), except in the unlock test, which is only
    // asking what you already know.
    const again = it.drill === "flash" ? it.round < 3 : it.round === 0;
    if (!correct && again && scope !== "unlock") {
      setItems((xs) => {
        const copy = { ...it, key: `${it.card.id}:${it.round + 1}`, round: it.round + 1, options: [...it.options].sort(() => Math.random() - 0.5) };
        const pos = Math.min(xs.length, at + 4);
        return [...xs.slice(0, pos), copy, ...xs.slice(pos)];
      });
    }
  }, [workspaceId, scope, at]);

  const choose = useCallback((o: Option) => {
    if (!item || picked) return;
    setPicked(o.id);
    record(item, o.correct, o.text);
  }, [item, picked, record]);

  const submitTyped = useCallback((text: string) => {
    if (!item || picked) return;
    const verdict = checkTyped(text, item.card.arabic);
    setPicked("typed");
    setTyped({ text: text.trim(), verdict });
    record(item, verdict === "right", text.trim());
  }, [item, picked, record]);

  const next = useCallback(() => {
    if (at + 1 >= items.length) { setPhase("done"); return; }
    setAt((n) => n + 1);
    setPicked(null);
    setTyped(null);
    setRevealed(false);
  }, [at, items.length]);
  const advance = useCallback(() => { if (picked) next(); }, [picked, next]);

  // A flashcard is graded once it is turned over, and grading moves straight on.
  const grade = useCallback((rating: Rating) => {
    if (!item || !revealed) return;
    record(item, rating !== "again", "Again", rating);
    next();
  }, [item, revealed, record, next]);

  // A right answer moves on by itself after a moment; a wrong one waits.
  useEffect(() => {
    if (!picked || !item) return;
    const right = item.drill === "type" ? typed?.verdict === "right" : item.options.find((o) => o.id === picked)?.correct;
    if (!right) return;
    // Written answers wait longer, to read the vowelled form of what you wrote.
    const t = window.setTimeout(advance, item.drill === "type" ? 1400 : 850);
    return () => window.clearTimeout(t);
  }, [picked, item, typed, advance]);

  useEffect(() => {
    if (phase !== "run") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (item?.drill === "flash") {
        if (!revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setRevealed(true); }
        else if (revealed && n >= 1 && n <= 4) { e.preventDefault(); grade(GRADES[n - 1].rating); }
        return;
      }
      if (n >= 1 && n <= (item?.options.length ?? 0)) { e.preventDefault(); choose(item!.options[n - 1]); }
      else if ((e.key === "Enter" || e.key === " ") && picked) { e.preventDefault(); advance(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, item, picked, revealed, choose, advance, grade]);

  const leave = () => pushWithSplash(router,
    from ? from.href : lesson ? `/workspaces/${workspaceId}/arabic/${lesson.id}` : `/workspaces/${workspaceId}`);
  const title = scope === "unlock" ? "What do you already know?"
    : from ? from.title : lesson ? lesson.title : "Today’s review";

  return (
    <div className="workspace-home">
      <Rail activeWorkspaceId={workspaceId} />
      <div className="workspace-home-content ap-page">
        <button type="button" className="ar-back" onClick={leave}>
          <ChevronLeft size={15} aria-hidden /> {from ? from.label : lesson ? lesson.label : "All lessons"}
        </button>

        {phase === "setup" && (
          <Setup
            title={title}
            choice={choice} setChoice={setChoice}
            count={count} setCount={setCount}
            sentences={sentences} setSentences={setSentences}
            face={face} setFace={setFace}
            voice={voice} error={error}
            preview={preview?.key === settingsKey ? { total: preview.cards.length, quran: preview.quran } : null}
            onStart={() => void start()}
          />
        )}

        {phase === "loading" && <p className="ap-loading">Getting your cards ready…</p>}

        {phase === "run" && item && (
          <Question
            key={item.key}
            item={item}
            index={at}
            total={items.length}
            picked={picked}
            ayah={item.place ? ayahs[item.place.verseKey] : undefined}
            translit={translit}
            voice={voice}
            typed={typed}
            revealed={revealed}
            onChoose={choose}
            onType={submitTyped}
            onReveal={() => setRevealed(true)}
            onGrade={grade}
            onNext={advance}
            onEnd={() => setPhase("done")}
          />
        )}

        {phase === "done" && (
          <Results
            unlock={scope === "unlock"}
            right={firstRight}
            total={firstTotal}
            missed={missed}
            message={error}
            onDone={leave}
            onAgain={missed.length ? () => void start(missed.map((m) => m.card)) : undefined}
          />
        )}
      </div>
    </div>
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────

function Setup(p: {
  title: string; choice: Choice; setChoice: (c: Choice) => void;
  count: number; setCount: (n: number) => void;
  sentences: boolean; setSentences: (b: boolean) => void;
  face: Face; setFace: (f: Face) => void;
  voice: boolean; error: string | null; onStart: () => void;
  preview: { total: number; quran: number } | null;
}) {
  const drills = DRILLS.filter((d) => d.id !== "listen" || p.voice);
  const quranOnly = p.choice === "context" || p.choice === "cloze";
  const usesQuran = quranOnly || p.choice === "mixed";
  const pv = p.preview;

  /* Said before you start, not discovered halfway: the Qurʾān drills can
     only ask words that occur in the Qurʾān with the card's meaning. */
  let availability: { text: string; tone: "info" | "warn" } | null = null;
  if (pv && pv.total === 0) {
    availability = { text: "There’s nothing to practise here yet.", tone: "warn" };
  } else if (pv && usesQuran) {
    const other = p.voice ? "meaning, recall or listening" : "meaning or recall";
    if (pv.quran === 0) {
      availability = quranOnly
        ? { text: `None of these ${pv.total} cards appear in the Qurʾān with the same meaning. Try Meaning or Recall.`, tone: "warn" }
        : { text: `None of these cards appear in the Qurʾān with the same meaning, so they’ll be asked by ${other}.`, tone: "info" };
    } else if (pv.quran < pv.total) {
      availability = quranOnly
        ? { text: `Only ${pv.quran} of these ${pv.total} cards appear in the Qurʾān with the same meaning, so this session has ${pv.quran}.`, tone: "warn" }
        : { text: `${pv.quran} of ${pv.total} cards can be asked from the Qurʾān; the rest are asked by ${other}.`, tone: "info" };
    } else {
      availability = { text: `All ${pv.total} cards appear in the Qurʾān with the same meaning.`, tone: "info" };
    }
  }
  const startCount = pv ? (quranOnly ? pv.quran : pv.total) : null;

  return (
    <section className="ap-setup">
      <h1 className="ap-title">{p.title}</h1>
      <p className="ap-sub">{drills.find((d) => d.id === p.choice)?.hint}</p>

      <div className="ap-field">
        <p className="ap-label">How to be asked</p>
        <div className="ap-drills" role="radiogroup" aria-label="How to be asked">
          {drills.map((d) => (
            <button key={d.id} type="button" role="radio" aria-checked={p.choice === d.id}
                    className="ap-drill" data-active={p.choice === d.id ? "true" : "false"}
                    onClick={() => p.setChoice(d.id)}>
              {d.name}
            </button>
          ))}
        </div>
        {availability && (
          <p className="ap-avail" data-tone={availability.tone} role="status">{availability.text}</p>
        )}
      </div>

      {p.choice === "flash" && (
        <div className="ap-field">
          <p className="ap-label">The front of the card</p>
          <div className="ar-seg ap-count" role="radiogroup" aria-label="The front of the card">
            {([["en", "English → Arabic"], ["ar", "Arabic → English"], ["both", "Both"]] as const).map(([f, label]) => (
              <button key={f} type="button" role="radio" aria-checked={p.face === f}
                      data-active={p.face === f ? "true" : "false"} onClick={() => p.setFace(f)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ap-field">
        <p className="ap-label">How many</p>
        <div className="ar-seg ap-count" role="radiogroup" aria-label="How many">
          {[10, 20, 30, 0].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={p.count === n}
                    data-active={p.count === n ? "true" : "false"} onClick={() => p.setCount(n)}>
              {n === 0 ? "All" : n}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="ap-option" role="switch" aria-checked={p.sentences}
              onClick={() => p.setSentences(!p.sentences)}>
        <span className="ap-option-text">
          <span className="ap-option-title">Include sentences</span>
          <span className="ap-option-sub">Whole sentences as well as single words</span>
        </span>
        <span className="ar-toggle-knob" aria-hidden />
      </button>

      {p.error && <p className="ar-note">{p.error}</p>}

      <button type="button" className="nw-btn nw-btn--primary ap-start" onClick={p.onStart}
              disabled={startCount === 0}>
        {startCount ? `Start · ${startCount} card${startCount === 1 ? "" : "s"}` : "Start"} <ArrowRight size={15} aria-hidden />
      </button>
    </section>
  );
}

// ── Question ──────────────────────────────────────────────────────────────

const GRADES: { rating: Rating; name: string }[] = [
  { rating: "again", name: "Again" },
  { rating: "hard",  name: "Hard" },
  { rating: "good",  name: "Good" },
  { rating: "easy",  name: "Easy" },
];

function Question(p: {
  item: Item; index: number; total: number; picked: string | null;
  ayah: Ayah | null | undefined; translit: boolean; voice: boolean;
  typed: { text: string; verdict: Typed } | null; revealed: boolean;
  onChoose: (o: Option) => void; onType: (text: string) => void;
  onReveal: () => void; onGrade: (r: Rating) => void;
  onNext: () => void; onEnd: () => void;
}) {
  const { item, picked } = p;
  if (item.drill === "flash") return <Flashcard {...p} />;
  const chosen = picked ? item.options.find((o) => o.id === picked) : null;
  const wrong = item.drill === "type" ? !!p.typed && p.typed.verdict !== "right" : !!chosen && !chosen.correct;
  const arabicOptions = item.drill === "recall" || item.drill === "cloze";
  const prompt = {
    meaning: "What does it mean?",
    recall:  "Which is the Arabic?",
    type:    "Write it in Arabic",
    flash:   "",
    listen:  "What did you hear?",
    context: "What does the highlighted word mean?",
    cloze:   "Which word fills the gap?",
  }[item.drill];

  return (
    <section className="ap-q" aria-live="polite">
      <div className="ap-progress">
        <span className="ap-bar"><span style={{ width: `${Math.round((p.index / p.total) * 100)}%` }} /></span>
        <span className="ap-count-l">{p.index + 1} of {p.total}</span>
      </div>

      <div className="ap-card">
        {(item.drill === "meaning") && (
          <>
            <p className="ap-ar" dir="rtl" lang="ar">{item.card.arabic}</p>
            {p.translit && item.card.translit && <p className="ap-tr">{item.card.translit}</p>}
            {p.voice && <SpeakButton text={item.card.arabic} />}
          </>
        )}
        {(item.drill === "recall" || item.drill === "type") && (
          <p className="ap-en">{item.card.english}{item.card.gender && <span className="ar-g">{item.card.gender}</span>}</p>
        )}
        {item.drill === "listen" && (
          <>
            <button type="button" className="ap-listen" onClick={() => speak(item.card.arabic)} aria-label="Play again">
              <Volume2 size={30} aria-hidden />
            </button>
            {picked && <p className="ap-ar ap-ar--after" dir="rtl" lang="ar">{item.card.arabic}</p>}
          </>
        )}
        {(item.drill === "context" || item.drill === "cloze") && (
          <AyahView item={item} ayah={p.ayah} revealed={!!picked} />
        )}
      </div>

      <p className="ap-prompt">{prompt}</p>

      {item.drill === "type" && (
        <WriteIt card={item.card} typed={p.typed} translit={p.translit} onType={p.onType} />
      )}

      {item.options.length > 0 && <div className="ap-options" data-arabic={arabicOptions ? "true" : "false"}>
        {item.options.map((o, i) => {
          const state = !picked ? "idle" : o.correct ? "right" : o.id === picked ? "wrong" : "dim";
          return (
            <button key={o.id} type="button" className="ap-opt" data-state={state}
                    disabled={!!picked} onClick={() => p.onChoose(o)}>
              <span className="ap-opt-n" aria-hidden>{state === "right" ? <Check size={13} strokeWidth={3} /> : state === "wrong" ? <X size={13} strokeWidth={3} /> : i + 1}</span>
              <span className="ap-opt-t" dir={arabicOptions ? "rtl" : undefined} lang={arabicOptions ? "ar" : undefined}>{o.text}</span>
            </button>
          );
        })}
      </div>}

      <div className="ap-foot">
        {wrong ? (
          <button type="button" className="nw-btn nw-btn--primary" onClick={p.onNext} autoFocus>
            Continue <ArrowRight size={15} aria-hidden />
          </button>
        ) : (
          <button type="button" className="ap-end" onClick={p.onEnd}>End session</button>
        )}
      </div>
    </section>
  );
}

function SpeakButton({ text }: { text: string }) {
  return (
    <button type="button" className="ap-speak" onClick={() => speak(text)} aria-label="Hear it">
      <Volume2 size={16} aria-hidden />
    </button>
  );
}

function AyahView({ item, ayah, revealed }: { item: Item; ayah: Ayah | null | undefined; revealed: boolean }) {
  if (ayah === undefined) return <p className="ap-ayah-wait">Opening the āyah…</p>;
  if (ayah === null) return <p className="ap-ayah-wait">The āyah couldn’t be loaded.</p>;
  const target = item.place!.word;
  return (
    <div className="ap-ayah">
      <p className="ap-ayah-text" dir="rtl" lang="ar">
        {ayah.words.filter((w) => w.isWord).map((w) => {
          const hit = w.position === target;
          if (hit && item.drill === "cloze" && !revealed) {
            return <span key={w.position} className="ap-gap" aria-label="missing word">{" ".repeat(6)}</span>;
          }
          return <span key={w.position} className={hit ? "ap-hl" : undefined}>{w.text} </span>;
        })}
      </p>
      <p className="ap-ayah-ref">{ayah.verseKey}</p>
      {(item.drill === "cloze" || revealed) && ayah.translation && (
        <p className="ap-ayah-tr">“{ayah.translation}”</p>
      )}
    </div>
  );
}

// ── Writing the Arabic ────────────────────────────────────────────────────

/* The letters, for a device without an Arabic keyboard. Hamza seats and
   tā' marbūṭa are there for a careful hand, though the check doesn't need
   them, and there are no harakat: those aren't marked. */
const KEYS = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج"],
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
  ["ء", "ئ", "ؤ", "ر", "ى", "ة", "و", "ز", "ظ", "د", "ذ"],
  ["أ", "إ", "آ"],
];
const KEYS_KEY = "tl-arabic-keys";

function WriteIt({ card, typed, translit, onType }: {
  card: QueueCard; typed: { text: string; verdict: Typed } | null; translit: boolean; onType: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [keys, setKeys] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { if (localStorage.getItem(KEYS_KEY) === "off") setKeys(false); } catch { /* private mode */ }
  }, []);
  const toggleKeys = () => {
    setKeys((k) => { try { localStorage.setItem(KEYS_KEY, k ? "off" : "on"); } catch { /* private mode */ } return !k; });
  };

  /** Puts a letter where the caret is, or takes one away. */
  const press = (ch: string | null) => {
    const el = input.current;
    const a = el?.selectionStart ?? text.length, b = el?.selectionEnd ?? text.length;
    const [next, at] = ch === null
      ? (a === b ? [text.slice(0, Math.max(0, a - 1)) + text.slice(b), Math.max(0, a - 1)] : [text.slice(0, a) + text.slice(b), a])
      : [text.slice(0, a) + ch + text.slice(b), a + ch.length];
    setText(next);
    requestAnimationFrame(() => { el?.focus({ preventScroll: true }); el?.setSelectionRange(at, at); });
  };

  const done = !!typed;
  return (
    <div className="ap-write">
      <form className="ap-write-row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onType(text); }}>
        <input ref={input} className="ap-write-in" dir="rtl" lang="ar" value={done ? typed.text : text}
               onChange={(e) => setText(e.target.value)} disabled={done} autoFocus
               autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
               placeholder="اُكْتُبْ هُنَا" aria-label="Your answer in Arabic"
               data-verdict={typed?.verdict} />
        {!done && (
          <button type="submit" className="nw-btn nw-btn--primary ap-write-go" disabled={!text.trim()}>Check</button>
        )}
      </form>

      {!done && (
        <div className="ap-write-tools">
          <button type="button" className="ap-end" onClick={() => onType("")}>I don’t know</button>
          <button type="button" className="ap-end" onClick={toggleKeys} aria-pressed={keys}>
            <Keyboard size={14} aria-hidden /> {keys ? "Hide letters" : "Show letters"}
          </button>
        </div>
      )}
      {!done && keys && (
        <div className="ap-keys" dir="rtl">
          {KEYS.map((row, i) => (
            <div key={i} className="ap-keys-row">
              {row.map((k) => (
                <button key={k} type="button" className="ap-key" lang="ar" onClick={() => press(k)}>{k}</button>
              ))}
              {i === KEYS.length - 1 && (
                <>
                  <button type="button" className="ap-key ap-key--wide" onClick={() => press(" ")} aria-label="Space">space</button>
                  <button type="button" className="ap-key ap-key--wide" onClick={() => press(null)} aria-label="Delete a letter">
                    <Delete size={16} aria-hidden />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {done && (
        <div className="ap-verdict" data-verdict={typed.verdict} role="status">
          <span className="ap-verdict-h">
            {typed.verdict === "right" ? <><Check size={15} strokeWidth={3} aria-hidden /> Right</>
              : typed.verdict === "close" ? "Nearly: a letter off"
              : typed.text ? <><X size={15} strokeWidth={3} aria-hidden /> Not quite</> : "The answer"}
          </span>
          <span className="ap-verdict-ar" dir="rtl" lang="ar">{card.arabic}</span>
          {translit && card.translit && <span className="ap-tr">{card.translit}</span>}
        </div>
      )}
    </div>
  );
}

// ── Flashcards ────────────────────────────────────────────────────────────

function Flashcard(p: {
  item: Item; index: number; total: number; translit: boolean; voice: boolean; revealed: boolean;
  onReveal: () => void; onGrade: (r: Rating) => void; onEnd: () => void;
}) {
  const { item, revealed } = p;
  const { card } = item;
  // Not due yet, a right grade leaves its date alone (it would be learnt by
  // cramming), so the buttons only promise a wait when one will be kept.
  const counts = card.due || card.box === 0;
  const english = (
    <p className="ap-en">{card.english}{card.gender && <span className="ar-g">{card.gender}</span>}</p>
  );
  const arabic = <p className="ap-ar" dir="rtl" lang="ar">{card.arabic}</p>;

  return (
    <section className="ap-q" aria-live="polite">
      <div className="ap-progress">
        <span className="ap-bar"><span style={{ width: `${Math.round((p.index / p.total) * 100)}%` }} /></span>
        <span className="ap-count-l">{p.index + 1} of {p.total}</span>
      </div>

      <div className="ap-card ap-flash">
        {item.face === "en" ? english : arabic}
        {revealed && (
          <div className="ap-flash-back">
            {item.face === "en" ? arabic : english}
            {p.translit && card.translit && <p className="ap-tr">{card.translit}</p>}
            {p.voice && <SpeakButton text={card.arabic} />}
          </div>
        )}
      </div>

      {!revealed ? (
        <>
          <p className="ap-prompt">{item.face === "en" ? "Say the Arabic to yourself, then turn the card" : "Say what it means, then turn the card"}</p>
          <div className="ap-foot">
            <button type="button" className="nw-btn nw-btn--primary ap-flip" onClick={p.onReveal} autoFocus>
              Show answer
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="ap-prompt">How well did you know it?</p>
          <div className="ap-grades">
            {GRADES.map((g, i) => (
              <button key={g.rating} type="button" className="ap-grade" data-rating={g.rating} onClick={() => p.onGrade(g.rating)}>
                <span className="ap-grade-n">{g.name}</span>
                <span className="ap-grade-t">{counts || g.rating === "again" ? waitLabel(card.box, g.rating) : "Not due"}</span>
                <kbd aria-hidden>{i + 1}</kbd>
              </button>
            ))}
          </div>
          {!counts && <p className="ap-grade-note">Extra practice: this card isn’t due yet, so only Again changes when it comes back.</p>}
        </>
      )}

      <div className="ap-foot ap-foot--end">
        <button type="button" className="ap-end" onClick={p.onEnd}>End session</button>
      </div>
    </section>
  );
}

// ── Results ───────────────────────────────────────────────────────────────

function Results(p: {
  unlock: boolean; right: number; total: number; missed: Missed[]; message: string | null;
  onDone: () => void; onAgain?: () => void;
}) {
  const pct = p.total ? p.right / p.total : 0;
  const R = 46, C = 2 * Math.PI * R;

  if (p.total === 0) {
    return (
      <section className="ap-done">
        <h1 className="ap-title">{p.message ?? "Nothing answered."}</h1>
        <button type="button" className="nw-btn nw-btn--primary" onClick={p.onDone}>Done</button>
      </section>
    );
  }

  return (
    <section className="ap-done">
      <svg className="ap-ring" viewBox="0 0 110 110" aria-hidden>
        <circle cx="55" cy="55" r={R} className="ap-ring-bg" />
        <circle cx="55" cy="55" r={R} className="ap-ring-fg" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - pct) }} />
        <text x="55" y="61" textAnchor="middle" className="ap-ring-t">{p.right}/{p.total}</text>
      </svg>
      <h1 className="ap-title">
        {p.unlock ? `You knew ${p.right} of ${p.total} already.`
          : p.right === p.total ? "Every one right."
          : `${p.right} of ${p.total} right.`}
      </h1>
      <p className="ap-sub">
        {p.unlock
          ? "The ones you knew come back in a few days; the rest are now in your daily review."
          : p.missed.length ? "The ones you missed come back sooner." : "They’ll come back when they’re due."}
      </p>

      <div className="ap-done-actions">
        <button type="button" className="nw-btn nw-btn--primary" onClick={p.onDone}>Done</button>
        {p.onAgain && !p.unlock && (
          <button type="button" className="nw-btn nw-btn--quiet" onClick={p.onAgain}>
            <RotateCcw size={14} aria-hidden /> Practise the {p.missed.length} missed
          </button>
        )}
      </div>

      {p.missed.length > 0 && (
        <>
          <p className="ap-label ap-missed-h">Missed {p.missed.length}</p>
          <ul className="ap-missed">
            {p.missed.map((m) => (
              <li key={m.card.id}>
                <span className="ap-m-ar" dir="rtl" lang="ar">{m.card.arabic}</span>
                <span className="ap-m-en">{m.card.english}</span>
                <span className="ap-m-chose">
                  {m.drill === "flash" ? "You marked it Again" : m.drill === "type" ? (m.chose ? `You wrote ${m.chose}` : "You didn’t know it") : `You chose ${m.chose}`}
                </span>
                {m.hit && (
                  <span className="ap-m-q"><BookOpen size={12} aria-hidden /> In the Qurʾān {m.hit.count} time{m.hit.count === 1 ? "" : "s"} in this form, e.g. {m.hit.places[0].verseKey}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
