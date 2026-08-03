"use client";

/**
 * Every Connection in the workspace.
 *
 * A Connection belongs to two study objects rather than to a page, so it
 * cannot be found by browsing pages the way a note can. This is the surface
 * that makes them findable at all.
 *
 * Paginated from the server, never loaded whole: a workspace accumulates far
 * more Connections than any one screen should hold, and the point of a
 * catalogue is to find one, not to render all of them.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  parseObjectKey, ayahKey, surahKey, selectionKey, isSelfLink, type ObjectType,
} from "@/lib/quran-objects";
import QuranSearch from "./editor/QuranSearch";
import ConnectionForm, { type Endpoint } from "./editor/ConnectionForm";
import type { SearchTarget } from "@/lib/quran-search";
import ConnectionsMap, { type MapNode, type MapEdge } from "./ConnectionsMap";

interface Row {
  id: string;
  name: string;
  commentary?: string | null;
  category?: string | null;
  sourceType: string; sourceKey: string;
  targetType: string; targetKey: string;
  updatedAt: string;
  createdBy?: { id: string; name: string; avatarUrl: string | null };
}

interface Props {
  workspaceId: string;
  workspaceName: string;
  chapters: { id: number; name: string; arabic?: string; verses?: number; place?: string }[];
}

const SORTS = [
  { id: "updated", label: "Recently updated" },
  { id: "created", label: "Recently created" },
  { id: "quran",   label: "Qurʾānic order" },
  { id: "name",    label: "Name" },
] as const;

const TYPES: { id: "" | ObjectType; label: string }[] = [
  { id: "",          label: "All types" },
  { id: "ayah",      label: "Āyāt" },
  { id: "selection", label: "Selections" },
  { id: "surah",     label: "Surahs" },
];

const PAGE_SIZE = 25;
/** Long enough that typing a phrase issues one request rather than ten. */
const DEBOUNCE_MS = 220;

export default function ConnectionsCatalogue({
  workspaceId, workspaceName, chapters,
}: Props) {
  const [rows, setRows]       = useState<Row[]>([]);
  const [total, setTotal]     = useState(0);
  const [skip, setSkip]       = useState(0);
  const [q, setQ]             = useState("");
  const [category, setCat]    = useState("");
  const [type, setType]       = useState<"" | ObjectType>("");
  const [sort, setSort]       = useState<(typeof SORTS)[number]["id"]>("updated");
  const [state, setState]     = useState<"loading" | "ready" | "error">("loading");
  /* List and map are two ways of reading the same set. The map answers "what
     is connected to what across the Qur'an"; the list answers "what did I
     write about it". Neither replaces the other, so both stay. */
  const [view, setView]       = useState<"list" | "map">("list");
  const [map, setMap]         = useState<{ nodes: MapNode[]; edges: MapEdge[]; total: number } | null>(null);
  const [mapState, setMapState] = useState<"idle" | "loading" | "error">("idle");
  /** Surah focused on the map; also narrows the list beneath it. */
  const [focusSurah, setFocusSurah] = useState<number | null>(null);
  const reqRef = useRef(0);

  /* Creating a Connection from the map. Same two-endpoint flow and same form
     as /link — the map is another way IN to the existing system, not a second
     Connection system. */
  const [make, setMake] = useState<
    | null
    | { step: "pick"; which: "source" | "target"; source?: Endpoint; target?: Endpoint }
    | { step: "form"; source: Endpoint; target: Endpoint }
  >(null);
  const [makeBusy, setMakeBusy] = useState(false);
  const [makeErr,  setMakeErr]  = useState<string | null>(null);
  const [makeDupe, setMakeDupe] = useState<{ id: string; name: string } | null>(null);

  const toEndpoint = useCallback((t: SearchTarget): Endpoint =>
    t.kind === "ayah"
      ? { type: "ayah", key: ayahKey(t.surah ?? 1, t.ayah ?? 1), label: t.label, arabic: t.arabic }
      : t.kind === "selection"
      ? { type: "selection", key: selectionKey(t.id), label: t.label }
      : { type: "surah", key: surahKey(t.surah ?? Number(t.id)), label: t.label.split(" · ")[0] },
  []);

  const pickEndpoint = useCallback((t: SearchTarget) => {
    setMakeErr(null);
    setMake((cur) => {
      if (!cur || cur.step !== "pick") return cur;
      const picked = toEndpoint(t);
      const source = cur.which === "source" ? picked : cur.source;
      const target = cur.which === "target" ? picked : cur.target;
      /* Self-links are refused here as well as on the server, so the user
         finds out while choosing rather than after filling in the form. */
      if (source && target && isSelfLink(source.key, target.key)) {
        setMakeErr("A passage cannot be connected to itself.");
        return { step: "pick", which: "target", source };
      }
      if (source && target) return { step: "form", source, target };
      return { step: "pick", which: source ? "target" : "source", source, target };
    });
  }, [toEndpoint]);


  const names = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of chapters) m.set(c.id, c.name);
    return m;
  }, [chapters]);

  /** Turn a stored key into something a reader recognises. */
  const describe = useCallback((key: string): string => {
    const r = parseObjectKey(key);
    if (!r) return key;
    if (r.type === "ayah")  return `${names.get(r.surah!) ?? `Surah ${r.surah}`} ${r.surah}:${r.ayah}`;
    if (r.type === "surah") return names.get(r.surah!) ?? `Surah ${r.surah}`;
    return "Selection";
  }, [names]);

  const load = useCallback((nextSkip: number, append: boolean) => {
    /* Every request carries a sequence number and only the newest one is
       allowed to write. Without it a slow early query can land after a fast
       later one and repopulate the list with stale results. */
    const seq = ++reqRef.current;
    setState("loading");
    const p = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(nextSkip), sort });
    if (q.trim()) p.set("q", q.trim());
    if (category) p.set("category", category);
    if (type)     p.set("type", type);

    fetch(`/api/workspaces/${workspaceId}/connections?${p}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (seq !== reqRef.current) return;
        setRows((prev) => (append ? [...prev, ...(d.items ?? [])] : (d.items ?? [])));
        setTotal(d.total ?? 0);
        setSkip(nextSkip);
        setState("ready");
      })
      .catch(() => { if (seq === reqRef.current) setState("error"); });
  }, [workspaceId, q, category, type, sort]);

  // Filters reset to the first page — page 3 of the previous query is meaningless.
  useEffect(() => {
    const t = setTimeout(() => load(0, false), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [load]);

  /* Fetched only when the map is opened — the list view must not pay for a
     query it never renders. */
  useEffect(() => {
    if (view !== "map" || map) return;
    setMapState("loading");
    fetch(`/api/workspaces/${workspaceId}/connections?view=map`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { setMap(d); setMapState("idle"); })
      .catch(() => setMapState("error"));
  }, [view, map, workspaceId]);

  const surahLabel = useCallback(
    (n: number) => names.get(n) ?? `Surah ${n}`, [names],
  );

  /** Focusing a Surah on the map narrows the list to it, so the two views stay
   *  in agreement instead of showing different things at once. */
  const shown = useMemo(() => {
    if (focusSurah == null) return rows;
    const inSurah = (key: string) => {
      const r = parseObjectKey(key);
      return r?.type === "selection" ? true : r?.surah === focusSurah;
    };
    return rows.filter((r) => inSurah(r.sourceKey) || inSurah(r.targetKey));
  }, [rows, focusSurah]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.category) set.add(r.category);
    return [...set].sort();
  }, [rows]);

  const submitFromMap = useCallback((v: {
    name: string; commentary?: string; category?: string; tags: string[];
  }) => {
    if (!make || make.step !== "form") return;
    setMakeBusy(true); setMakeErr(null);
    fetch(`/api/workspaces/${workspaceId}/connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: make.source.type, sourceKey: make.source.key,
        targetType: make.target.type, targetKey: make.target.key,
        ...v,
      }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.status === 409 && d.existing) {
          setMakeDupe({ id: d.existing.id, name: d.existing.name });
          return null;
        }
        if (!r.ok) throw new Error(d.error ?? String(r.status));
        return d.connection;
      })
      .then((conn) => {
        if (!conn) return;
        setMake(null); setMakeDupe(null);
        /* Both views refresh from the server rather than being patched by
           hand: the map aggregates edges by Surah and weights them, so a
           local insert would have to duplicate that reduction. */
        setMap(null);
        load(0, false);
      })
      .catch((e) => setMakeErr(String(e instanceof Error ? e.message : e)))
      .finally(() => setMakeBusy(false));
  }, [make, workspaceId, load]);

  const hasMore = rows.length < total;

  return (
    <div className="cxcat">
      <header className="cxcat-head">
        <Link href={`/workspaces/${workspaceId}`} className="cxcat-back">
          <ChevronLeft size={16} /> {workspaceName}
        </Link>
        <h1 className="cxcat-title">Connections</h1>
        <span className="cxcat-total">{total}</span>
        {/* Entry point into the SAME flow /link uses: pick both ends, then
            the existing form. */}
        <button
          className="cxcat-new"
          onClick={() => { setMakeErr(null); setMakeDupe(null); setMake({ step: "pick", which: "source" }); }}
        >
          New Connection
        </button>
      </header>

      {/* Endpoint picker — reuses QuranSearch, so āyāt, Selections and Surahs
          are all reachable and the keyboard behaviour matches /link. */}
      {make?.step === "pick" && (
        <div className="cxcat-make">
          <div className="cxcat-make-head">
            <span className="cxcat-make-step">
              {make.which === "source" ? "Linking FROM" : "Linking TO"}
            </span>
            {make.source && (
              <span className="cxcat-make-chosen">{make.source.label}</span>
            )}
          </div>
          <QuranSearch
            kinds={["ayah", "selection", "surah"]}
            selections={[]}
            placeholder={make.which === "source"
              ? "Choose the first passage…"
              : "Choose the second passage…"}
            onSelect={pickEndpoint}
            onCancel={() => setMake(null)}
          />
          {makeErr && <p className="cxcat-make-err">{makeErr}</p>}
        </div>
      )}

      {make?.step === "form" && (
        <ConnectionForm
          source={make.source}
          target={make.target}
          busy={makeBusy}
          error={makeErr}
          duplicateOf={makeDupe}
          onCancel={() => { setMake(null); setMakeDupe(null); setMakeErr(null); }}
          onChangeEndpoint={(which) => setMake({
            step: "pick", which,
            source: which === "source" ? undefined : make.source,
            target: which === "target" ? undefined : make.target,
          })}
          onSubmit={submitFromMap}
        />
      )}

      <div className="cxcat-views" role="group" aria-label="View">
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            className="cxcat-view-btn"
            data-active={view === v ? "true" : "false"}
            onClick={() => setView(v)}
          >
            {v === "list" ? "List" : "Map"}
          </button>
        ))}
      </div>

      {view === "map" && (
        <>
          {mapState === "loading" && <div className="cxcat-empty">Building the map…</div>}
          {mapState === "error" && <div className="cxcat-empty">Could not load the map.</div>}
          {map && mapState === "idle" && (
            <ConnectionsMap
              nodes={map.nodes}
              edges={map.edges}
              total={map.total}
              surahName={surahLabel}
              chapters={chapters}
              focus={focusSurah}
              onFocus={setFocusSurah}
            />
          )}
        </>
      )}

      <div className="cxcat-filters">
        <input
          className="cxcat-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search names, commentary or references…"
          dir="auto"
          aria-label="Search Connections"
        />
        <select
          className="cxcat-select"
          value={type}
          onChange={(e) => setType(e.target.value as "" | ObjectType)}
          aria-label="Filter by object type"
        >
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select
          className="cxcat-select"
          value={category}
          onChange={(e) => setCat(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="cxcat-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as (typeof SORTS)[number]["id"])}
          aria-label="Sort"
        >
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {state === "error" && (
        <div className="cxcat-empty">
          Could not load Connections.{" "}
          <button className="cxp-link" onClick={() => load(0, false)}>Try again</button>
        </div>
      )}

      {state !== "error" && shown.length === 0 && state === "ready" && (
        <div className="cxcat-empty">
          {q || category || type
            ? "No Connection matches these filters."
            : "No Connections yet. Use /link in a note to relate two passages."}
        </div>
      )}

      <ul className="cxcat-list">
        {shown.map((r) => (
          /* A register entry, not a card. What a Connection IS is the pair of
             passages, so the pair leads; the name is the claim made about
             them; commentary and provenance trail behind it. Rows are divided
             by a hairline rather than each being boxed. */
          <li key={r.id} className="cxcat-item">
            <div className="cxcat-pair">
              <span className="cxcat-end">{describe(r.sourceKey)}</span>
              <span className="cxcat-arrow" aria-hidden>↔</span>
              <span className="cxcat-end">{describe(r.targetKey)}</span>
            </div>
            <div className="cxcat-name">{r.name}</div>
            {r.commentary && <p className="cxcat-comm">{r.commentary}</p>}
            <div className="cxcat-meta">
              {r.category && <span className="cxcat-cat">{r.category}</span>}
              {r.createdBy?.name && <span>{r.createdBy.name}</span>}
              <span>{new Date(r.updatedAt).toLocaleDateString()}</span>
            </div>
          </li>
        ))}
      </ul>

      {state === "loading" && <div className="cxcat-empty">Loading…</div>}

      {hasMore && state === "ready" && (
        <button className="cxcat-more" onClick={() => load(skip + PAGE_SIZE, true)}>
          Load {Math.min(PAGE_SIZE, total - rows.length)} more
        </button>
      )}
    </div>
  );
}
