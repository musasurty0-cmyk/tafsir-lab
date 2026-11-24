"use client";

/**
 * Maths question booklets (MadAsMaths), by chapter.
 *
 * Pick a year; its chapters are listed as the tests under Papers are, and one
 * opens to the booklets filed under it, then any from the same year that also
 * cover it, then any from another year with some of it, each with the pages
 * that count. Further Maths goes by its specification's points instead. A
 * booklet opens in a new tab or downloads. Searching looks through everything
 * at once, by booklet, chapter or topic, and opens what it finds. A chapter
 * with no booklet still shows, so the list reads as the whole course.
 *
 * Each booklet takes two marks, done and a traffic-light confidence, the same
 * wherever it is listed. The counts are for the part that is open, and a
 * filter narrows it to what still needs work.
 */

import { useEffect, useMemo, useState } from "react";
import { CONFIDENCE, type Booklet, type Confidence } from "@/lib/dunya/catalog";
import type { BookletMark } from "@/lib/dunya/maths-spec";
import Bar from "./Bar";
import { Lights } from "./SpecTracker";
import { SPEC_AREAS, placeOf, pointName, type SpecPart, type SpecPoint } from "@/lib/dunya/spec-points";

const href = (key: string, view = false) => `/api/dunya/file?key=${encodeURIComponent(key)}${view ? "&view=1" : ""}`;
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** A point's booklets: the ones filed under it, and the others that also cover it. */
type Shelf = { here: Booklet[]; also: Booklet[] };
const EMPTY: Shelf = { here: [], also: [] };

type Marks = Record<string, BookletMark>;
type OnMark = (id: string, field: keyof BookletMark, value: boolean | string | null) => void;
type Filter = "all" | "todo" | "done" | Confidence;

function tally(list: Booklet[], marks: Marks) {
  const n = (c: Confidence) => list.filter((b) => marks[b.id]?.confidence === c).length;
  return { total: list.length, done: list.filter((b) => marks[b.id]?.done).length, green: n("green"), amber: n("amber"), red: n("red") };
}

export default function Booklets({ booklets, marks, onMark }: { booklets: Booklet[]; marks: Marks; onMark: OnMark }) {
  const [areaId, setAreaId] = useState(SPEC_AREAS[0].id);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    // The part of the course you last had open, kept in this browser.
    try {
      const a = localStorage.getItem("tl-dunya-booklets-area");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (a && SPEC_AREAS.some((x) => x.id === a)) setAreaId(a);
    } catch { /* private mode */ }
  }, []);

  const shelves = useMemo(() => {
    const m = new Map<string, Shelf>();
    const at = (id: string) => m.get(id) ?? m.set(id, { here: [], also: [] }).get(id)!;
    for (const b of booklets) b.points.forEach((id, i) => at(id)[i ? "also" : "here"].push(b));
    return m;
  }, [booklets]);
  const perArea = useMemo(() => {
    const m = new Map<string, Booklet[]>(SPEC_AREAS.map((a) => [a.id, []]));
    for (const b of booklets) m.get(placeOf(b.points[0])?.area.id ?? "")?.push(b);
    return m;
  }, [booklets]);
  const sum = useMemo(() => tally(perArea.get(areaId) ?? [], marks), [perArea, areaId, marks]);

  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const has = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  const passes = (b: Booklet) => {
    const m = marks[b.id];
    return filter === "todo" ? !m?.done : filter === "done" ? !!m?.done : m?.confidence === filter;
  };
  /** What a point shows: its whole shelf, or only what a search or the filter finds on it. */
  const shown = (part: SpecPart, topic: string, point: SpecPoint): Shelf | null => {
    const shelf = shelves.get(point.id) ?? EMPTY;
    if (!q && filter === "all") return shelf;
    if (!q) {
      // To do lists a booklet at every point it helps; the others pick out a few, once each.
      const here = shelf.here.filter(passes), also = filter === "todo" ? shelf.also.filter(passes) : [];
      return here.length + also.length ? { here, also } : null;
    }
    const numbered = /^\d+(\.\d+)?$/.test(q);
    // The point itself: everything on it. Its topic, or a booklet's own name: only
    // what is filed here, so the same booklet isn't found again and again.
    if (numbered ? point.n === q || point.n.startsWith(`${q}.`) : has(point.label)) {
      return shelf.here.length + shelf.also.length ? shelf : null;
    }
    const here = numbered ? [] : has(`${point.label} ${topic} ${part.name}`) ? shelf.here : shelf.here.filter((b) => has(`${b.title} ${b.kind}`));
    return here.length ? { here, also: [] } : null;
  };

  const areas = q ? SPEC_AREAS : SPEC_AREAS.filter((a) => a.id === areaId);
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const pick = (id: string) => {
    setAreaId(id);
    setQuery("");
    setFilter("all");
    try { localStorage.setItem("tl-dunya-booklets-area", id); } catch { /* private mode */ }
  };

  const FILTERS: { value: Filter; label: string; count: number; c?: Confidence }[] = [
    { value: "all", label: "All", count: sum.total },
    { value: "todo", label: "To do", count: sum.total - sum.done },
    { value: "done", label: "Done", count: sum.done },
    ...CONFIDENCE.map((c) => ({ value: c.value, label: c.label, count: sum[c.value], c: c.value })),
  ];
  // A search, or a filter that picks out a few, holds what it finds open.
  const held = !!q || (filter !== "all" && filter !== "todo");

  const blocks = areas.flatMap((area) => area.parts.flatMap((part, i) => {
    const groups = part.topics.map((t) => ({
      topic: t,
      points: t.points.map((point) => ({ point, shelf: shown(part, t.name, point) })).filter((x): x is { point: SpecPoint; shelf: Shelf } => !!x.shelf),
    })).filter((g) => g.points.length);
    return groups.length ? [{ area, part, first: i === 0, groups }] : [];
  }));

  return (
    <div className="dn-spec dn-bk">
      <p className="dn-spec-lede">
        {count(booklets.length, "MadAsMaths booklet")} by T. Madas, filed by chapter. The answers are taken out;
        check them against the originals at <a className="dn-bk-link" href="https://www.madasmaths.com" target="_blank" rel="noreferrer">madasmaths.com</a>.
      </p>

      <div className="dn-bk-bar">
        <div className="dn-filter" role="radiogroup" aria-label="Year">
          {SPEC_AREAS.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={!q && a.id === areaId} onClick={() => pick(a.id)}>
              {a.name}<span className="dn-filter-n">{perArea.get(a.id)?.length ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="dn-bk-search">
          <Search />
          <span className="dn-sr">Search booklets</span>
          <input type="search" placeholder="Search booklets" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {!q && (
        <>
          <dl className="dn-stats dn-bk-stats">
            <div><dt>Done</dt><dd>{sum.done}<small> of {sum.total}</small></dd></div>
            {CONFIDENCE.slice().reverse().map((c) => (
              <div key={c.value}><dt><i className="dn-dot" data-c={c.value} />{c.label}</dt><dd>{sum[c.value]}</dd></div>
            ))}
          </dl>
          <div className="dn-filter dn-bk-filter" role="radiogroup" aria-label="Show">
            {FILTERS.map((f) => (
              <button
                key={f.value} type="button" role="radio" aria-checked={filter === f.value}
                disabled={f.count === 0 && f.value !== "all" && f.value !== filter} onClick={() => setFilter(f.value)}
              >
                {f.c && <i className="dn-dot" data-c={f.c} />}{f.label}<span className="dn-filter-n">{f.count}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {blocks.length === 0 && (q ? (
        <div className="dn-empty">
          <p className="dn-empty-title">Nothing for “{query.trim()}”.</p>
          <p>Try a topic, such as vectors or circles.</p>
        </div>
      ) : (
        <div className="dn-empty">
          <p className="dn-empty-title">None left here.</p>
          <p>Choose All to see every booklet again.</p>
        </div>
      ))}

      {blocks.map(({ area, part, first, groups }) => (
        <section key={part.id}>
          <div className="dn-bk-part">
            <h3 className="dn-spec-area">{part.name}.</h3>
            {q ? <p className="dn-bk-note">{area.name}</p> : first && area.note && <p className="dn-bk-note">{area.note}</p>}
            {area.id !== "further" && <Progress list={part.topics.flatMap((t) => t.points.flatMap((x) => shelves.get(x.id)?.here ?? []))} marks={marks} />}
          </div>
          {groups.map(({ topic, points }) => (
            <div className="dn-group" key={topic.n + topic.name}>
              {topic.name && <div className="dn-group-head">
                <h4 className="dn-group-name">{topic.n && <span className="dn-bk-tn">{topic.n}</span>}{topic.name}</h4>
                <Progress list={topic.points.flatMap((p) => shelves.get(p.id)?.here ?? [])} marks={marks} />
              </div>}
              <ul className="dn-papers">
                {points.map(({ point, shelf }) => (
                  <Point key={point.id} point={point} part={part} shelf={shelf} open={held || open.has(point.id)} onToggle={() => toggle(point.id)} locked={held} marks={marks} onMark={onMark} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/** A topic's booklets, done and how confident: nothing until there is one. */
function Progress({ list, marks }: { list: Booklet[]; marks: Marks }) {
  if (!list.length) return null;
  const s = tally(list, marks);
  return <span className="dn-group-count"><Bar {...s} />{s.done} of {s.total}</span>;
}

function Point({ point, part, shelf, open, onToggle, locked, marks, onMark }: {
  point: SpecPoint; part: SpecPart; shelf: Shelf; open: boolean; onToggle: () => void;
  /** Held open by a search or a filter. */
  locked: boolean;
  marks: Marks; onMark: OnMark;
}) {
  const n = shelf.here.length + shelf.also.length;
  const done = [...shelf.here, ...shelf.also].filter((b) => marks[b.id]?.done).length;
  const bodyId = `dn-bk-${point.id}`;
  const head = (
    <>
      <span className="dn-bk-n">{point.n}</span>
      <span className="dn-paper-title">{point.label}</span>
      <span className="dn-bk-count">{!n ? "No booklet" : done && !locked ? `${done} of ${n} done` : count(n, "booklet")}</span>
    </>
  );
  if (!n) return <li className="dn-paper dn-bk-none"><div className="dn-bk-head">{head}</div></li>;
  return (
    <li className="dn-paper" data-open={open || undefined}>
      <button type="button" className="dn-bk-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle} disabled={locked}>
        {head}
        {!locked && <Chevron />}
      </button>
      {open && (
        <div className="dn-bk-body" id={bodyId}>
          <List booklets={shelf.here} part={part} point={point} marks={marks} onMark={onMark} />
          {SPEC_AREAS.map((a) => {
            const from = shelf.also.filter((b) => placeOf(b.points[0])?.area.id === a.id);
            if (!from.length) return null;
            const own = a.parts.some((x) => x.id === part.id);
            return (
              <div key={a.id}>
                <p className="dn-bk-also">{own ? "Also cover this" : `${a.name} booklets with some of this`}</p>
                <List booklets={from} part={part} point={point} marks={marks} onMark={onMark} />
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}

function List({ booklets, part, point, marks, onMark }: { booklets: Booklet[]; part: SpecPart; point: SpecPoint; marks: Marks; onMark: OnMark }) {
  if (!booklets.length) return null;
  return (
    <ul className="dn-bk-list">
      {booklets.map((b) => {
        const mark = marks[b.id];
        const filed = b.points[0] === point.id;
        const others = b.points.slice(1).map((p) => pointName(p, part.id));
        const where = filed ? (others.length ? `also ${others.join(", ")}` : null) : `filed under ${pointName(b.points[0], part.id)}`;
        const here = b.parts?.[point.id];
        return (
          <li key={b.id} className="dn-bk-item" data-done={mark?.done || undefined}>
            <a className="dn-bk-open" href={href(b.key, true)} target="_blank" rel="noreferrer">
              <span className="dn-bk-title">{b.title}</span>
              <span className="dn-paper-meta">
                {[b.kind === "Questions" ? null : b.kind, b.questions && count(b.questions, "question"), count(b.pages, "page"), where].filter(Boolean).join(" · ")}
              </span>
              {here && <span className="dn-bk-here">For this, {here}.</span>}
            </a>
            <div className="dn-bk-marks">
              <button type="button" className="dn-bk-done" aria-pressed={!!mark?.done} aria-label={`Done, ${b.title}`} onClick={() => onMark(b.id, "done", !mark?.done)}>
                <span className="dn-bk-tick"><Tick /></span>Done
              </button>
              <Lights
                name={`Confidence, ${b.title}`} label="Confidence" empty="Not rated" options={CONFIDENCE} value={mark?.confidence ?? null}
                onPick={(v) => onMark(b.id, "confidence", v === mark?.confidence ? null : v)}
              />
            </div>
            <a className="dn-bk-dl" href={href(b.key)} aria-label={`Download ${b.title}`} title="Download"><Download /></a>
          </li>
        );
      })}
    </ul>
  );
}

const Search = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
);
const Tick = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const Download = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
);
const Chevron = () => (
  <svg className="dn-paper-chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
);
