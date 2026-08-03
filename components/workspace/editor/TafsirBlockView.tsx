"use client";

import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { TAFSIR_LANGUAGE_NAMES } from "@/lib/tafsir/spa5k-catalog";
import { sanitizeTafsirHtml } from "@/lib/sanitize-html";

const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
  </svg>
);

// ── Source catalog (shared across every block on the page) ────────────────

interface SourceMeta {
  slug:     string;
  name:     string;
  language: string;
}

let sourcesCache: Promise<SourceMeta[]> | null = null;

function loadSources(): Promise<SourceMeta[]> {
  if (!sourcesCache) {
    sourcesCache = fetch("/api/tafsir/sources")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { sources?: SourceMeta[] }) => d.sources ?? [])
      .catch(() => {
        sourcesCache = null; // allow a retry on the next mount
        return [];
      });
  }
  return sourcesCache;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TafsirBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const { verseKey, contentHtml, sourceName, sourceSlug, partial } = node.attrs as {
    verseKey:    string;
    contentHtml: string;
    partial:     boolean;
    sourceName:  string;
    sourceSlug?: string;
  };
  const slug = sourceSlug || "ibn-kathir-en";

  const [fetching,   setFetching]   = useState(() => !contentHtml);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryKey,   setRetryKey]   = useState(0);
  const [html,       setHtml]       = useState(contentHtml || "");
  const [sources,    setSources]    = useState<SourceMeta[]>([]);

  useEffect(() => {
    let alive = true;
    loadSources().then((s) => { if (alive) setSources(s); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (contentHtml) return;
    setFetching(true);
    setFetchError(null);

    const urlKey = verseKey.replace(":", "_");
    fetch(`/api/tafsir/${urlKey}?sources=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        const entry = data.entries?.[0];
        if (!entry || entry.error || (!entry.contentHtml && !entry.content)) {
          throw new Error("No tafsir found for this verse");
        }
        const resolved = entry.contentHtml
          || String(entry.content)
              .replace(/\n{2,}/g, "</p><p>")
              .replace(/\n/g, "<br />");
        setHtml(resolved);
        updateAttributes({ contentHtml: resolved, sourceName: entry.source?.name ?? sourceName });
      })
      .catch((e) => setFetchError(String(e)))
      .finally(() => setFetching(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseKey, slug, retryKey]);

  function switchSource(nextSlug: string) {
    const next = sources.find((s) => s.slug === nextSlug);
    setHtml("");
    // Clearing contentHtml re-triggers the fetch effect with the new slug
    updateAttributes({
      sourceSlug:  nextSlug,
      sourceName:  next?.name ?? sourceName,
      contentHtml: "",
    });
  }

  // Group by language — English and Arabic pinned first, the rest by size.
  const byLang = new Map<string, SourceMeta[]>();
  for (const s of sources) {
    if (!byLang.has(s.language)) byLang.set(s.language, []);
    byLang.get(s.language)!.push(s);
  }
  const langGroups = [...byLang.entries()].sort((a, b) => {
    const pin = (l: string) => (l === "en" ? 0 : l === "ar" ? 1 : 2);
    return pin(a[0]) - pin(b[0]) || b[1].length - a[1].length || a[0].localeCompare(b[0]);
  });

  return (
    <NodeViewWrapper>
      <div
        className="tafsir-block-node"
        data-selected={selected ? "true" : "false"}
        contentEditable={false}
      >
        {/* Drag handle */}
        <div className="tafsir-block-drag" data-drag-handle title="Drag to reorder">
          ⠿
        </div>

        <div className="tafsir-block-inner">
          {/* Header */}
          <div className="tafsir-block-head">
            <div className="tafsir-block-meta">
              <span className="tafsir-block-ref">{verseKey}</span>
              {sources.length > 0 ? (
                <select
                  className="tafsir-block-source-select"
                  value={slug}
                  onChange={(e) => switchSource(e.target.value)}
                  title="Change tafsir source"
                >
                  {langGroups.map(([lang, group]) => (
                    <optgroup key={lang} label={TAFSIR_LANGUAGE_NAMES[lang] ?? lang.toUpperCase()}>
                      {group.map((s) => (
                        <option key={s.slug} value={s.slug}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <span className="tafsir-block-source">
                  {sourceName}
                  {/* An excerpt must say it is one. */}
                  {partial && <span className="tafsir-block-partial"> · excerpt</span>}
                </span>
              )}
            </div>
            <button
              className="tafsir-block-tool tafsir-block-tool--danger"
              onClick={deleteNode}
              title="Remove tafsir block"
            >
              <TrashIcon />
            </button>
          </div>

          {/* Content */}
          {fetching && (
            <div className="tafsir-block-skeleton">
              <div className="tafsir-skeleton-line tafsir-skeleton-line--long" />
              <div className="tafsir-skeleton-line tafsir-skeleton-line--med" />
              <div className="tafsir-skeleton-line tafsir-skeleton-line--long" />
              <div className="tafsir-skeleton-line tafsir-skeleton-line--short" />
            </div>
          )}

          {!fetching && fetchError && (
            <div className="tafsir-block-error">
              <span>⚠ Could not load tafsir for {verseKey}</span>
              <span className="tafsir-block-error-detail">{fetchError}</span>
              <button
                className="tafsir-block-retry"
                onClick={() => setRetryKey((k) => k + 1)}
              >
                Retry
              </button>
            </div>
          )}

          {!fetching && !fetchError && html && (
            <div
              className="tafsir-block-content"
              dir="auto"
              // Defense-in-depth: blocks persisted before server-side
              // sanitisation carry raw HTML in their attrs
              dangerouslySetInnerHTML={{ __html: sanitizeTafsirHtml(html) }}
            />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
