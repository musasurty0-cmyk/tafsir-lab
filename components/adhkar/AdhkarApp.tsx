"use client";

/**
 * /adhkar: the morning and evening adhkār, to read and count.
 *
 * Opens on the right list for the reader's own clock (03:00 to 14:59 is
 * morning), or whichever the link names (#morning, #evening). Each card is
 * counted by tapping anywhere on it; at zero it ticks and the page moves on to
 * the next. Progress is kept for the day in this browser only, and starts
 * fresh the next day. Text sizes and whether the meaning shows are remembered.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { adhkarFor, type AdhkarTime } from "@/lib/adhkar";

type Done = Record<string, number>;
const SIZES = [{ ar: 24, label: "Smaller" }, { ar: 29, label: "Default" }, { ar: 35, label: "Larger" }];
const PREFS = "tl-adhkar:prefs";
const today = () => new Date().toLocaleDateString("en-CA");
const progressKey = (time: AdhkarTime) => `tl-adhkar:v1:${today()}:${time}`;

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: counting still works */ }
}

const TIME = {
  morning: { en: "Morning", ar: "أَذْكَارُ الصَّبَاحِ", when: "After Fajr, before the sun is high." },
  evening: { en: "Evening", ar: "أَذْكَارُ الْمَسَاءِ", when: "After ʿAṣr, into the night." },
} as const;

export default function AdhkarApp() {
  const [time, setTime] = useState<AdhkarTime>("morning");
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState<Done>({});
  const [size, setSize] = useState(1);
  const [meaning, setMeaning] = useState(true);
  const cards = useRef<Map<string, HTMLElement>>(new Map());

  // The reader's own clock and settings, only once in the browser.
  useEffect(() => {
    const hash = location.hash.slice(1);
    const h = new Date().getHours();
    const t: AdhkarTime = hash === "morning" || hash === "evening" ? hash : h >= 3 && h < 15 ? "morning" : "evening";
    const prefs = read(PREFS, { size: 1, meaning: true });
    /* eslint-disable react-hooks/set-state-in-effect */
    setTime(t);
    setDone(read(progressKey(t), {}));
    setSize(Math.min(2, Math.max(0, prefs.size ?? 1)));
    setMeaning(prefs.meaning !== false);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const list = useMemo(() => adhkarFor(time), [time]);
  const finished = list.filter((d) => (done[d.id] ?? 0) >= d.count).length;
  const all = finished === list.length;

  const pick = (t: AdhkarTime) => {
    if (t === time) return;
    setTime(t);
    setDone(read(progressKey(t), {}));
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const savePrefs = (next: { size?: number; meaning?: boolean }) => {
    const p = { size, meaning, ...next };
    write(PREFS, p);
    if (next.size !== undefined) setSize(next.size);
    if (next.meaning !== undefined) setMeaning(next.meaning);
  };

  const count = useCallback((id: string, total: number) => {
    // A tap that ends a text selection is reading, not counting.
    if (window.getSelection()?.toString()) return;
    const was = done[id] ?? 0;
    const n = Math.min(total, was + 1);
    if (n === was) return;
    const next = { ...done, [id]: n };
    setDone(next);
    write(progressKey(time), next);
    try { navigator.vibrate?.(n === total ? 18 : 6); } catch { /* not supported */ }
    if (n === total) {
      // On to the next one still to say.
      const at = list.findIndex((d) => d.id === id);
      const after = list.slice(at + 1).find((d) => (next[d.id] ?? 0) < d.count);
      if (after) setTimeout(() => cards.current.get(after.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 380);
    }
  }, [done, list, time]);

  const restart = () => {
    setDone({});
    write(progressKey(time), {});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="ak" data-time={time} data-ready={ready || undefined} style={{ "--ak-ar": `${SIZES[size].ar}px` } as React.CSSProperties}>
      <header className="ak-top">
        <Link className="ak-brand" href="/" aria-label="Tafsir Lab"><span className="ak-mark" aria-hidden>T</span>Tafsir Lab</Link>
        <div className="ak-tools">
          <button type="button" className="ak-tool" aria-pressed={meaning} onClick={() => savePrefs({ meaning: !meaning })}>
            Meaning
          </button>
          <div className="ak-size" role="group" aria-label="Arabic text size">
            {SIZES.map((s, i) => (
              <button key={s.label} type="button" aria-pressed={size === i} aria-label={s.label} onClick={() => savePrefs({ size: i })}>
                <span lang="ar" style={{ fontSize: 13 + i * 3 }}>ع</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="ak-hero">
        <p className="ak-hero-ar" lang="ar" dir="rtl">{TIME[time].ar}</p>
        <h1 className="ak-title">{TIME[time].en} adhkār.</h1>
        <p className="ak-sub">{TIME[time].when} Tap a card to count it.</p>
      </section>

      <div className="ak-bar">
        <div className="ak-bar-in">
          <div className="ak-seg" role="tablist" aria-label="Time of day">
            {(["morning", "evening"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={time === t} onClick={() => pick(t)}>
                {t === "morning" ? <Sun /> : <Moon />}{TIME[t].en}
              </button>
            ))}
          </div>
          <div className="ak-prog" aria-live="polite">
            <span className="ak-prog-n"><b>{finished}</b> of {list.length}</span>
            <span className="ak-prog-track" aria-hidden><i style={{ width: `${(finished / list.length) * 100}%` }} /></span>
          </div>
        </div>
      </div>

      <ol className="ak-list">
        {list.map((d, i) => {
          const n = done[d.id] ?? 0;
          const left = d.count - n;
          const complete = left <= 0;
          return (
            <li key={`${time}-${d.id}`}
              ref={(el) => { if (el) cards.current.set(d.id, el); else cards.current.delete(d.id); }}
              className="ak-card" data-done={complete || undefined}
              role="button" tabIndex={0}
              aria-label={`${d.title ?? `Dhikr ${i + 1}`}. ${complete ? "Done" : `${left} of ${d.count} to go`}. Tap to count.`}
              onClick={() => count(d.id, d.count)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); count(d.id, d.count); } }}
            >
              <div className="ak-card-head">
                <span className="ak-n">{i + 1}</span>
                {d.title && <span className="ak-name">{d.title}</span>}
                <span className="ak-times">{d.count === 1 ? "Once" : `${d.count} times`}</span>
              </div>

              <div className="ak-ar" lang="ar" dir="rtl">
                {d.show.map((p, k) => (
                  <div key={k} className={p.quran ? "ak-ar-part ak-quran" : "ak-ar-part"}>
                    {p.label && <span className="ak-sura" lang="en" dir="ltr">{p.label}</span>}
                    <p>{p.ar}</p>
                  </div>
                ))}
              </div>

              {meaning && <p className="ak-en">{d.meaning}</p>}
              {(d.note || d.virtue) && (
                <div className="ak-extra">
                  {d.note && <p className="ak-note">{d.note}</p>}
                  {d.virtue && <p className="ak-virtue">{d.virtue}</p>}
                </div>
              )}

              <div className="ak-foot">
                <span className="ak-src">{d.source}</span>
                <Counter left={left} total={d.count} />
              </div>
            </li>
          );
        })}
      </ol>

      <section className="ak-end" data-all={all || undefined}>
        {all ? (
          <>
            <p className="ak-end-ar" lang="ar" dir="rtl">تَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُمْ</p>
            <p className="ak-end-h">Every one said.</p>
            <p className="ak-end-sub">May Allah accept them from you.</p>
          </>
        ) : (
          <p className="ak-end-sub">{list.length - finished} still to say.</p>
        )}
        <div className="ak-end-acts">
          {finished > 0 && <button type="button" className="ak-btn-quiet" onClick={restart}>Start again</button>}
          <button type="button" className="ak-btn-quiet" onClick={() => pick(time === "morning" ? "evening" : "morning")}>
            {time === "morning" ? "Evening adhkār" : "Morning adhkār"}
          </button>
        </div>
        <p className="ak-cite">From <i>Ḥiṣn al-Muslim</i> by Saʿīd ibn ʿAlī al-Qaḥṭānī. Qur’an in the King Fahd Complex text. Progress is kept on this device for today.</p>
      </section>
    </div>
  );
}

/** The count still to go, in a ring that fills as you go. */
function Counter({ left, total }: { left: number; total: number }) {
  const r = 19, c = 2 * Math.PI * r;
  const frac = total ? (total - Math.max(0, left)) / total : 1;
  return (
    <span className="ak-count" aria-hidden>
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} className="ak-ring-bg" />
        <circle cx="24" cy="24" r={r} className="ak-ring" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 24 24)" />
      </svg>
      <span className="ak-count-n">
        {left <= 0
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          : left}
      </span>
    </span>
  );
}

const Sun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
const Moon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
);
