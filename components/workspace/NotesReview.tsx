"use client";

/**
 * NotesReview — the workspace-wide notes retrieval view.
 *
 * Council round-2 verdict: notes were write-only — ayah anchors and type
 * tags existed but were never queried. This view is the answer:
 *
 *   • every note across every page of the workspace, in one place
 *   • grouped by surah → ayah (retrieval is verse-shaped, not page-shaped)
 *   • free-text search + type filter chips + author grouping
 *   • one tap from any note back to the page it lives on
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, X, FileText } from "lucide-react";
import Rail from "./Rail";

// ── Types ──────────────────────────────────────────────────────────────────

interface ReviewNote {
  id:           string;
  noteType:     string;
  anchorType:   string;
  surahNumber:  number | null;
  ayahNumber:   number | null;
  wordPosition: number | null;
  content:      unknown;
  color:        string | null;
  createdAt:    string;
  author:       { id: string; name: string; avatarUrl: string | null };
  page:         { id: string; title: string; workspaceSurah: { surahNumber: number } };
}

interface ChapterMeta { id: number; name: string; nameArabic: string }

interface Props {
  workspaceId:   string;
  workspaceName: string;
  chapters:      ChapterMeta[];
  currentUserId: string;
}

// ── Note type meta (mirrors NoteCard) ──────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string }> = {
  text:       { label: "Note",       color: "var(--ink-3)" },
  callout:    { label: "Callout",    color: "oklch(0.52 0.12 275)" },
  linguistic: { label: "Linguistic", color: "var(--accent-ink)" },
  thematic:   { label: "Thematic",   color: "oklch(0.55 0.12 155)" },
  ruling:     { label: "Ruling",     color: "oklch(0.62 0.09 28)" },
  question:   { label: "Question",   color: "oklch(0.62 0.11 70)" },
  textbox:    { label: "Text box",   color: "var(--ink-4)" },
};

const FILTER_TYPES = ["all", "text", "callout", "linguistic", "thematic", "ruling", "question", "textbox"] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (!n.content) return "";
  const parts = n.content.map(extractText);
  if (n.type === "doc") return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return parts.join("");
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(d));
}

// ── Component ──────────────────────────────────────────────────────────────

export default function NotesReview({ workspaceId, workspaceName, chapters, currentUserId }: Props) {
  const router = useRouter();
  const [notes,   setNotes]   = useState<ReviewNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");
  const [type,    setType]    = useState<(typeof FILTER_TYPES)[number]>("all");

  const chapterName = useMemo(() => {
    const m = new Map<number, ChapterMeta>();
    for (const c of chapters) m.set(c.id, c);
    return m;
  }, [chapters]);

  // Fetch once — filtering is instant client-side from then on.
  useEffect(() => {
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/notes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { notes?: ReviewNote[] } | null) => { if (d?.notes) setNotes(d.notes); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId]);

  // ── Filter + group: surah → ayah → notes ────────────────────────────────
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = notes.filter((n) => {
      if (type !== "all" && n.noteType !== type) return false;
      if (q && !extractText(n.content).toLowerCase().includes(q)
            && !n.author.name.toLowerCase().includes(q)) return false;
      return true;
    });

    // surahNumber → ayahKey → notes  (ayahKey -1 = page-level / text boxes)
    const bySurah = new Map<number, Map<number, ReviewNote[]>>();
    for (const n of filtered) {
      const surah = n.surahNumber ?? n.page.workspaceSurah.surahNumber;
      const ayah  = n.ayahNumber ?? -1;
      if (!bySurah.has(surah)) bySurah.set(surah, new Map());
      const ayahs = bySurah.get(surah)!;
      if (!ayahs.has(ayah)) ayahs.set(ayah, []);
      ayahs.get(ayah)!.push(n);
    }

    return [...bySurah.entries()]
      .sort(([a], [b]) => a - b)
      .map(([surah, ayahs]) => ({
        surah,
        ayahs: [...ayahs.entries()]
          .sort(([a], [b]) => (a === -1 ? 1 : b === -1 ? -1 : a - b)), // page notes last
      }));
  }, [notes, query, type]);

  const totalShown = grouped.reduce(
    (sum, s) => sum + s.ayahs.reduce((x, [, arr]) => x + arr.length, 0), 0);

  return (
    <div className="notes-review-page">
      <Rail activeWorkspaceId={workspaceId} />

      <div className="notes-review-main scroll">
        {/* ── Header ── */}
        <div className="notes-review-head">
          <Link href={`/workspaces/${workspaceId}`} className="notes-review-back">
            <ArrowLeft size={14} /> {workspaceName}
          </Link>
          <h1 className="notes-review-title">Notes</h1>
          <p className="notes-review-sub">
            {loading ? "Loading…" : `${totalShown} note${totalShown === 1 ? "" : "s"} across the workspace`}
          </p>

          {/* Search */}
          <div className="notes-review-search">
            <Search size={13} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
            <input
              placeholder="Search notes, authors…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery("")} title="Clear" style={{ color: "var(--ink-4)" }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Type filter chips */}
          <div className="notes-review-filters">
            {FILTER_TYPES.map((t) => (
              <button
                key={t}
                className="notes-review-chip"
                data-active={type === t ? "true" : "false"}
                style={t !== "all" ? ({ "--type-color": TYPE_META[t].color } as React.CSSProperties) : undefined}
                onClick={() => setType(t)}
              >
                {t === "all" ? "All" : TYPE_META[t].label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        {!loading && totalShown === 0 && (
          <div className="notes-review-empty">
            <FileText size={20} style={{ color: "var(--ink-4)" }} />
            {notes.length === 0
              ? <p>No notes yet. Notes you create on pages and the Mushaf will appear here.</p>
              : <p>Nothing matches — try a different search or filter.</p>}
          </div>
        )}

        {grouped.map(({ surah, ayahs }) => {
          const ch = chapterName.get(surah);
          return (
            <section key={surah} className="notes-review-surah">
              <h2 className="notes-review-surah-head">
                <span className="notes-review-surah-num">{surah}</span>
                {ch?.name ?? `Surah ${surah}`}
                {ch && <span className="notes-review-surah-ar">{ch.nameArabic}</span>}
              </h2>

              {ayahs.map(([ayah, list]) => (
                <div key={ayah} className="notes-review-ayah-group">
                  <h3 className="notes-review-ayah-head">
                    {ayah === -1 ? "Page notes & text boxes" : `Ayah ${surah}:${ayah}`}
                    <span className="notes-review-ayah-count">{list.length}</span>
                  </h3>

                  {list.map((n) => {
                    const meta = TYPE_META[n.noteType] ?? TYPE_META.text;
                    const text = extractText(n.content);
                    return (
                      <button
                        key={n.id}
                        className="notes-review-note"
                        onClick={() =>
                          router.push(`/workspaces/${workspaceId}/surahs/${n.page.workspaceSurah.surahNumber}/pages/${n.page.id}`)
                        }
                        title={`Open "${n.page.title}"`}
                      >
                        <span className="notes-review-note-type" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="notes-review-note-text">
                          {text || <em style={{ color: "var(--ink-4)" }}>(empty)</em>}
                        </span>
                        <span className="notes-review-note-meta">
                          {n.author.id === currentUserId ? "You" : n.author.name.split(" ")[0]}
                          {" · "}{formatDate(n.createdAt)}
                          {" · "}{n.page.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
