"use client";

import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
  </svg>
);

export default function TafsirBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const { verseKey, contentHtml, sourceName } = node.attrs as {
    verseKey:    string;
    contentHtml: string;
    sourceName:  string;
  };

  const [fetching,   setFetching]   = useState(() => !contentHtml);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryKey,   setRetryKey]   = useState(0);
  const [html,       setHtml]       = useState(contentHtml || "");

  useEffect(() => {
    if (contentHtml) return;
    setFetching(true);
    setFetchError(null);

    const urlKey = verseKey.replace(":", "_");
    fetch(`/api/tafsir/${urlKey}?sources=ibn-kathir-en`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        const entry = data.entries?.[0];
        if (!entry) throw new Error("No tafsir found for this verse");
        const resolved = entry.contentHtml || entry.content || "";
        setHtml(resolved);
        updateAttributes({ contentHtml: resolved, sourceName: entry.source?.name ?? "Ibn Kathir" });
      })
      .catch((e) => setFetchError(String(e)))
      .finally(() => setFetching(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseKey, retryKey]);

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
              <span className="tafsir-block-source">{sourceName}</span>
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
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
