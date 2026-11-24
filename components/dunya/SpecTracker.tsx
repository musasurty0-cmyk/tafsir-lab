"use client";

/**
 * The Maths spec tracker, opened from the tutor's button on Maths. Every part
 * of the course, by chapter, with three marks each:
 *   Lesson      red not yet · amber in lessons now · green covered
 *   Questions   red not done · green done
 *   Confidence  red · amber · green (or not rated yet)
 * A tap saves at once (DunyaApp holds the marks and puts one back if it fails). Nothing is
 * lit until it is marked, so an untouched spec reads grey, not a wall of red.
 */

import { useEffect, useMemo, useState } from "react";
import {
  MATHS_SPEC, type Light, type SpecField, type SpecSection, type SpecTopic, type TopicMark,
} from "@/lib/dunya/maths-spec";

type Marks = Record<string, TopicMark>;
type Filter = "all" | "y1" | "y2" | "unsure";

const LESSON:     { value: Light; label: string }[] = [
  { value: "red", label: "Not yet" }, { value: "amber", label: "In lessons" }, { value: "green", label: "Covered" },
];
const QUESTIONS:  { value: "red" | "green"; label: string }[] = [
  { value: "red", label: "Not done" }, { value: "green", label: "Done" },
];
const CONFIDENCE: { value: Light; label: string }[] = [
  { value: "red", label: "Not yet" }, { value: "amber", label: "Getting there" }, { value: "green", label: "Confident" },
];

const lessonOf = (m?: TopicMark) => m?.lesson ?? null;
const questionsOf = (m?: TopicMark) => m?.questions ?? null;
const confidenceOf = (m?: TopicMark) => m?.confidence ?? null;

function tally(topics: SpecTopic[], marks: Marks) {
  const n = (f: (m?: TopicMark) => unknown, v: unknown) => topics.filter((x) => f(marks[x.id]) === v).length;
  return {
    total: topics.length,
    lesson: { green: n(lessonOf, "green"), amber: n(lessonOf, "amber"), red: n(lessonOf, "red") },
    questions: { green: n(questionsOf, "green"), red: n(questionsOf, "red") },
    confidence: { green: n(confidenceOf, "green"), amber: n(confidenceOf, "amber"), red: n(confidenceOf, "red") },
  };
}

export default function SpecTracker({ tutor, marks, onMark }: {
  tutor: string; marks: Marks; onMark: (topicId: string, f: SpecField, v: string | null) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    try {
      const f = localStorage.getItem("tl-dunya-spec-filter") as Filter | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (f && ["all", "y1", "y2", "unsure"].includes(f)) setFilter(f);
    } catch { /* private mode */ }
  }, []);
  const pickFilter = (f: Filter) => {
    setFilter(f);
    try { localStorage.setItem("tl-dunya-spec-filter", f); } catch { /* private mode */ }
  };

  const all = useMemo(() => MATHS_SPEC.flatMap((s) => s.topics), []);
  const sum = useMemo(() => tally(all, marks), [all, marks]);

  const shows = (s: SpecSection, x: SpecTopic) =>
    filter === "all" || (filter === "y1" ? s.year === 1 : filter === "y2" ? s.year === 2 : confidenceOf(marks[x.id]) !== "green");
  const inYear = (y: number) => MATHS_SPEC.reduce((n, s) => n + (s.year === y ? s.topics.length : 0), 0);
  const unsure = all.length - sum.confidence.green;
  const FILTERS: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: all.length },
    { value: "y1", label: "Year 1", count: inYear(1) },
    { value: "y2", label: "Year 2", count: inYear(2) },
    { value: "unsure", label: "Not confident yet", count: unsure },
  ];

  return (
    <div className="dn-spec">
      <p className="dn-spec-lede">
        The whole course, chapter by chapter. Mark what you’ve covered with {tutor}, whether you’ve done the questions, and how confident you feel.
      </p>

      <div className="dn-spec-stats">
        <Stat label="Covered in lessons" n={sum.lesson.green} of={sum.total}
          note={sum.lesson.amber ? `${sum.lesson.amber} in lessons now` : undefined}
          bar={[["green", sum.lesson.green], ["amber", sum.lesson.amber], ["red", sum.lesson.red], [null, sum.total - sum.lesson.green - sum.lesson.amber - sum.lesson.red]]} />
        <Stat label="Questions done" n={sum.questions.green} of={sum.total}
          bar={[["green", sum.questions.green], ["red", sum.questions.red], [null, sum.total - sum.questions.green - sum.questions.red]]} />
        <Stat label="Confident" n={sum.confidence.green} of={sum.total}
          note={sum.confidence.amber || sum.confidence.red ? `${sum.confidence.amber} getting there · ${sum.confidence.red} not yet` : undefined}
          bar={[["green", sum.confidence.green], ["amber", sum.confidence.amber], ["red", sum.confidence.red], [null, sum.total - sum.confidence.green - sum.confidence.amber - sum.confidence.red]]} />
      </div>

      <div className="dn-filter" role="radiogroup" aria-label="Show">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" role="radio" aria-checked={filter === f.value} onClick={() => pickFilter(f.value)}>
            {f.label}<span className="dn-filter-n">{f.count}</span>
          </button>
        ))}
      </div>

      {MATHS_SPEC.map((section) => ({ section, shown: section.topics.filter((x) => shows(section, x)) }))
        .filter((g) => g.shown.length)
        .map(({ section, shown }, i, list) => {
          // Each year's Pure, Mechanics and Statistics opens with its own heading.
          const before = list[i - 1]?.section;
          const opens = !before || before.area !== section.area || before.year !== section.year;
          return <Section key={section.id} section={section} shown={shown} marks={marks} opens={opens} onMark={(x, f, v) => onMark(x.id, f, v)} />;
        })}
    </div>
  );
}

function Stat({ label, n, of, note, bar }: {
  label: string; n: number; of: number; note?: string; bar: [string | null, number][];
}) {
  return (
    <div className="dn-spec-stat">
      <p className="dn-spec-stat-label">{label}</p>
      <p className="dn-spec-stat-n">{n}<small> of {of}</small></p>
      <span className="dn-bar" aria-hidden="true">
        {bar.map(([c, k], i) => <i key={i} data-c={c ?? undefined} style={{ flexGrow: k }} />)}
      </span>
      {note && <p className="dn-spec-stat-note">{note}</p>}
    </div>
  );
}

function Section({ section, shown, marks, opens, onMark }: {
  section: SpecSection; shown: SpecTopic[]; marks: Marks;
  /** The first of its year and area, under their heading and the column names. */
  opens: boolean;
  onMark: (t: SpecTopic, f: SpecField, v: string | null) => void;
}) {
  const s = tally(section.topics, marks);
  return (
    <div className="dn-group">
      {opens && (
        <div className="dn-bk-part">
          <h3 className="dn-spec-area">{section.area}.</h3>
          <p className="dn-bk-note">Year {section.year}</p>
        </div>
      )}
      <div className="dn-group-head">
        <h4 className="dn-group-name"><span className="dn-bk-tn">{section.n}</span>{section.name}</h4>
        <span className="dn-group-count">{s.confidence.green} of {s.total} confident</span>
      </div>
      {opens && (
        <div className="dn-spec-cols" aria-hidden="true">
          <span /><span>Lesson</span><span>Questions</span><span>Confidence</span>
        </div>
      )}
      <ul className="dn-papers">
        {shown.map((x) => {
          const m = marks[x.id];
          return (
            <li key={x.id} className="dn-spec-row" data-c={confidenceOf(m) ?? undefined}>
              <div className="dn-spec-name">
                <span>{x.name}</span>
              </div>
              <Lights name={`Lesson, ${x.name}`} label="Lesson" empty="Not started" options={LESSON} value={lessonOf(m)} onPick={(v) => onMark(x, "lesson", v)} />
              <Lights name={`Questions, ${x.name}`} label="Questions" empty="Not done" options={QUESTIONS} value={questionsOf(m)} onPick={(v) => onMark(x, "questions", v)} />
              <Lights name={`Confidence, ${x.name}`} label="Confidence" empty="Not rated" options={CONFIDENCE} value={confidenceOf(m)}
                onPick={(v) => onMark(x, "confidence", v === confidenceOf(m) ? null : v)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A traffic light: one dot per state, the chosen one lit, the word beside it. */
export function Lights<V extends string>({ name, label, empty, options, value, onPick }: {
  name: string; label: string; empty: string; options: { value: V; label: string }[]; value: V | null; onPick: (v: V) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className="dn-lights">
      <span className="dn-lights-label">{label}</span>
      <div className="dn-lights-dots" role="radiogroup" aria-label={name}>
        {options.map((o) => (
          <button
            key={o.value} type="button" role="radio" aria-checked={value === o.value} data-c={o.value}
            aria-label={o.label} title={o.label} onClick={() => onPick(o.value)}
          >
            <i />
          </button>
        ))}
      </div>
      <span className="dn-lights-word">{current?.label ?? empty}</span>
    </div>
  );
}
