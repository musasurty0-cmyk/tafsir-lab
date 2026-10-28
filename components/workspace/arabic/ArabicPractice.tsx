"use client";

/**
 * A practice session: choose how, answer, see what you missed.
 *
 * Five ways to be asked:
 *   meaning   the Arabic, pick its meaning
 *   recall    the meaning, pick the Arabic
 *   listen    hear it, pick its meaning        (when the browser has an Arabic voice)
 *   context   the word highlighted in an āyah, pick its meaning
 *   cloze     an āyah with the word taken out, pick the word that fills it
 * The last two only for words that really occur in the Qurʾān, vowels and
 * all (lib/arabic/quran-match). "Mixed" draws from whichever fit each card.
 *
 * Each card's first answer in a session is what counts; a miss comes back a
 * few cards later so it is seen right once before the session ends.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Volume2, Check, X, ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import Rail from "../Rail";
import { makeOptions, type Drill, type DrillCard, type Option } from "@/lib/arabic/drill";
import { cardHeadword, lookup, type QuranHit } from "@/lib/arabic/quran-match";
import { loadQuranIndex, loadAyah, arabicVoice, speak, type Ayah } from "@/lib/arabic/quran-index-client";

type Scope = "due" | "lesson" | "unlock" | "cards";
type Choice = Drill | "mixed";

interface QueueCard extends DrillCard {
  translit: string | null; gender: string | null; box: number; due: boolean;
}
interface Item {
  key: string; card: QueueCard; drill: Drill; options: Option[];
  hit: QuranHit | null; place: { verseKey: string; word: number } | null; retry: boolean;
}
interface Missed { card: QueueCard; chose: string; hit: QuranHit | null }

interface Props {
  workspaceId: string;
  scope: Scope;
  lesson: { id: string; title: string; label: string } | null;
  /** For scope "cards": the cards to practise, and where to go back to. */
  cardIds?: string[];
  from?: { href: string; label: string; title: string } | null;
}

const DRILLS: { id: Choice; name: string; hint: string }[] = [
  { id: "mixed",   name: "Mixed",       hint: "A bit of everything" },
  { id: "meaning", name: "Meaning",     hint: "See the Arabic, pick the meaning" },
  { id: "recall",  name: "Recall",      hint: "See the meaning, pick the Arabic" },
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
          const ways: Drill[] = ["meaning", "recall", ...(voice ? ["listen" as const] : [])];
          if (hit) ways.push("context", "cloze");
          drill = ways[Math.floor(Math.random() * ways.length)];
        } else drill = choice;
        if ((drill === "context" || drill === "cloze") && !hit) continue;
        if (drill === "listen" && !voice) drill = "meaning";
        const place = hit ? hit.places[Math.floor(Math.random() * Math.min(3, hit.places.length))] : null;
        built.push({
          key: `${card.id}:0`, card, drill, hit, place, retry: false,
          options: makeOptions(card, pool.length > 3 ? pool : [...pool, ...cards], drill),
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
      setFirstTotal(0);
      setFirstRight(0);
      setMissed([]);
      setPhase("run");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t load the cards.");
      setPhase("setup");
    }
  }, [scope, choice, voice, items, preview, settingsKey, fetchQueue]);

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

  const choose = useCallback((o: Option) => {
    if (!item || picked) return;
    setPicked(o.id);
    const first = !answered.current.has(item.card.id);
    if (first) {
      answered.current.add(item.card.id);
      setFirstTotal((n) => n + 1);
      if (o.correct) setFirstRight((n) => n + 1);
      else setMissed((m) => [...m, { card: item.card, chose: o.text, hit: item.hit }]);
      void fetch(`/api/workspaces/${workspaceId}/arabic/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: [{ cardId: item.card.id, correct: o.correct, unlock: scope === "unlock" }] }),
      }).catch(() => { /* the next answer carries on; the schedule is forgiving */ });
    }
    // A miss comes back a few cards later, once — except in the unlock test,
    // which is only asking what you already know.
    if (!o.correct && !item.retry && scope !== "unlock") {
      setItems((xs) => {
        const copy = { ...item, key: `${item.card.id}:1`, retry: true, options: [...item.options].sort(() => Math.random() - 0.5) };
        const pos = Math.min(xs.length, at + 4);
        return [...xs.slice(0, pos), copy, ...xs.slice(pos)];
      });
    }
  }, [item, picked, workspaceId, scope, at]);

  const advance = useCallback(() => {
    if (!picked) return;
    if (at + 1 >= items.length) { setPhase("done"); return; }
    setAt((n) => n + 1);
    setPicked(null);
  }, [picked, at, items.length]);

  // A right answer moves on by itself after a moment; a wrong one waits.
  useEffect(() => {
    if (!picked || !item) return;
    const right = item.options.find((o) => o.id === picked)?.correct;
    if (!right) return;
    const t = window.setTimeout(advance, 850);
    return () => window.clearTimeout(t);
  }, [picked, item, advance]);

  useEffect(() => {
    if (phase !== "run") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= (item?.options.length ?? 0)) { e.preventDefault(); choose(item!.options[n - 1]); }
      else if ((e.key === "Enter" || e.key === " ") && picked) { e.preventDefault(); advance(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, item, picked, choose, advance]);

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
            onChoose={choose}
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

function Question(p: {
  item: Item; index: number; total: number; picked: string | null;
  ayah: Ayah | null | undefined; translit: boolean; voice: boolean;
  onChoose: (o: Option) => void; onNext: () => void; onEnd: () => void;
}) {
  const { item, picked } = p;
  const chosen = picked ? item.options.find((o) => o.id === picked) : null;
  const arabicOptions = item.drill === "recall" || item.drill === "cloze";
  const prompt = {
    meaning: "What does it mean?",
    recall:  "Which is the Arabic?",
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
        {item.drill === "recall" && (
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

      <div className="ap-options" data-arabic={arabicOptions ? "true" : "false"}>
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
      </div>

      <div className="ap-foot">
        {chosen && !chosen.correct ? (
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
                <span className="ap-m-chose">You chose {m.chose}</span>
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
