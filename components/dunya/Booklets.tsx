"use client";

/**
 * Maths question booklets (MadAsMaths), by Edexcel specification point.
 *
 * Pick a part of the course; its points are listed in the specification's own
 * order and numbers, and one opens to the booklets filed under it, followed by
 * any filed elsewhere that also cover it. A booklet opens in a new tab or
 * downloads. Searching looks through every part at once, by booklet, by point
 * ("2.3") or by topic, and opens what it finds. A point with no booklet still
 * shows, so the list reads as the whole specification.
 */

import { useEffect, useMemo, useState } from "react";
import type { Booklet } from "@/lib/dunya/catalog";
import { SPEC_AREAS, placeOf, pointName, type SpecPart, type SpecPoint } from "@/lib/dunya/spec-points";

const href = (key: string, view = false) => `/api/dunya/file?key=${encodeURIComponent(key)}${view ? "&view=1" : ""}`;
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** A point's booklets: the ones filed under it, and the others that also cover it. */
type Shelf = { here: Booklet[]; also: Booklet[] };
const EMPTY: Shelf = { here: [], also: [] };

export default function Booklets({ booklets }: { booklets: Booklet[] }) {
  const [areaId, setAreaId] = useState(SPEC_AREAS[0].id);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

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
    const n = new Map<string, number>();
    for (const b of booklets) {
      const a = placeOf(b.points[0])?.area.id;
      if (a) n.set(a, (n.get(a) ?? 0) + 1);
    }
    return n;
  }, [booklets]);

  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const has = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  /** What a point shows: its whole shelf, or only what a search finds on it. */
  const shown = (part: SpecPart, topic: string, point: SpecPoint): Shelf | null => {
    const shelf = shelves.get(point.id) ?? EMPTY;
    if (!q) return shelf;
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
    try { localStorage.setItem("tl-dunya-booklets-area", id); } catch { /* private mode */ }
  };

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
        {count(booklets.length, "MadAsMaths booklet")} by T. Madas, sorted into the Edexcel specification. The answers are taken out;
        check them against the originals at <a className="dn-bk-link" href="https://www.madasmaths.com" target="_blank" rel="noreferrer">madasmaths.com</a>.
      </p>

      <div className="dn-bk-bar">
        <div className="dn-filter" role="radiogroup" aria-label="Part of the course">
          {SPEC_AREAS.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={!q && a.id === areaId} onClick={() => pick(a.id)}>
              {a.name}<span className="dn-filter-n">{perArea.get(a.id) ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="dn-bk-search">
          <Search />
          <span className="dn-sr">Search booklets</span>
          <input type="search" placeholder="Search, or a point like 2.3" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {blocks.length === 0 && (
        <div className="dn-empty">
          <p className="dn-empty-title">Nothing for “{query.trim()}”.</p>
          <p>Try a topic, such as vectors, or a point, such as 7.4.</p>
        </div>
      )}

      {blocks.map(({ area, part, first, groups }) => (
        <section key={part.id}>
          {(first || q || area.parts.length > 1) && (
            <div className="dn-bk-part">
              <h3 className="dn-spec-area">{part.name}.</h3>
              {first && !q && <p className="dn-bk-note">{area.note}</p>}
            </div>
          )}
          {groups.map(({ topic, points }) => (
            <div className="dn-group" key={topic.n + topic.name}>
              <div className="dn-group-head">
                <h4 className="dn-group-name">{topic.n && <span className="dn-bk-tn">{topic.n}</span>}{topic.name}</h4>
              </div>
              <ul className="dn-papers">
                {points.map(({ point, shelf }) => (
                  <Point key={point.id} point={point} part={part} shelf={shelf} open={!!q || open.has(point.id)} onToggle={() => toggle(point.id)} locked={!!q} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function Point({ point, part, shelf, open, onToggle, locked }: {
  point: SpecPoint; part: SpecPart; shelf: Shelf; open: boolean; onToggle: () => void;
  /** Held open by a search. */
  locked: boolean;
}) {
  const n = shelf.here.length + shelf.also.length;
  const bodyId = `dn-bk-${point.id}`;
  const head = (
    <>
      <span className="dn-bk-n">{point.n}</span>
      <span className="dn-paper-title">{point.label}</span>
      <span className="dn-bk-count">{n ? count(n, "booklet") : "No booklet"}</span>
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
          <List booklets={shelf.here} part={part} point={point} />
          {shelf.also.length > 0 && (
            <>
              {shelf.here.length > 0 && <p className="dn-bk-also">Also cover this</p>}
              <List booklets={shelf.also} part={part} point={point} />
            </>
          )}
        </div>
      )}
    </li>
  );
}

function List({ booklets, part, point }: { booklets: Booklet[]; part: SpecPart; point: SpecPoint }) {
  if (!booklets.length) return null;
  return (
    <ul className="dn-bk-list">
      {booklets.map((b) => {
        const filed = b.points[0] === point.id;
        const others = b.points.slice(1).map((p) => pointName(p, part.id));
        const where = filed ? (others.length ? `also ${others.join(", ")}` : null) : `filed under ${pointName(b.points[0], part.id)}`;
        return (
          <li key={b.id} className="dn-bk-item">
            <a className="dn-bk-open" href={href(b.key, true)} target="_blank" rel="noreferrer">
              <span className="dn-bk-title">{b.title}</span>
              <span className="dn-paper-meta">
                {[b.kind === "Questions" ? null : b.kind, b.questions && count(b.questions, "question"), count(b.pages, "page"), where].filter(Boolean).join(" · ")}
              </span>
            </a>
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
const Download = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
);
const Chevron = () => (
  <svg className="dn-paper-chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
);
