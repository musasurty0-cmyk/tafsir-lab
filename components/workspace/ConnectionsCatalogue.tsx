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
import { parseObjectKey, type ObjectType } from "@/lib/quran-objects";

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
  chapters: { id: number; name: string }[];
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
  const reqRef = useRef(0);

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.category) set.add(r.category);
    return [...set].sort();
  }, [rows]);

  const hasMore = rows.length < total;

  return (
    <div className="cxcat">
      <header className="cxcat-head">
        <Link href={`/workspaces/${workspaceId}`} className="cxcat-back">
          <ChevronLeft size={16} /> {workspaceName}
        </Link>
        <h1 className="cxcat-title">Connections</h1>
        <span className="cxcat-total">{total}</span>
      </header>

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

      {state !== "error" && rows.length === 0 && state === "ready" && (
        <div className="cxcat-empty">
          {q || category || type
            ? "No Connection matches these filters."
            : "No Connections yet. Use /link in a note to relate two passages."}
        </div>
      )}

      <ul className="cxcat-list">
        {rows.map((r) => (
          <li key={r.id} className="cxcat-item">
            <div className="cxcat-item-top">
              <span className="cxcat-name">{r.name}</span>
              {r.category && <span className="cxc-cat">{r.category}</span>}
            </div>
            <div className="cxcat-pair">
              <span className="cxcat-end">{describe(r.sourceKey)}</span>
              <span className="cxcat-arrow" aria-hidden>↔</span>
              <span className="cxcat-end">{describe(r.targetKey)}</span>
            </div>
            {r.commentary && <p className="cxcat-comm">{r.commentary}</p>}
            <div className="cxcat-meta">
              {r.createdBy?.name && <>{r.createdBy.name} · </>}
              {new Date(r.updatedAt).toLocaleDateString()}
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
