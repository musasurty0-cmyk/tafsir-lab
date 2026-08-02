"use client";

/**
 * Create Connection — the second stage of /link, after a target is chosen.
 *
 * Shows both endpoints before saving, because the whole point of a munasabah
 * is the pair: a form that only named one side would be asking the user to
 * describe half a relationship.
 *
 * Nothing here touches Selections. A Selection may be an ENDPOINT, but this
 * form never creates or edits one — /link and the Selection workflow are
 * separate systems that happen to share a search box.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface Endpoint {
  type:  "ayah" | "selection" | "surah";
  key:   string;
  label: string;
  arabic?: string;
}

/** Suggested, never required — an unclassified munasabah is still a munasabah. */
const CATEGORIES = [
  "Munāsabāt",
  "Opening and ending",
  "Sequence between Surahs",
  "Shared theme",
  "Similar wording",
  "Similar structure",
  "Same root",
  "Same story",
  "Same ruling",
  "Contrast",
  "Cause and effect",
  "Personal reflection",
  "Other",
];

const KIND_LABEL: Record<Endpoint["type"], string> = {
  ayah: "Āyah", selection: "Selection", surah: "Surah",
};

interface Props {
  source: Endpoint;
  target: Endpoint;
  busy?: boolean;
  /** Set when the pair is already connected — the form becomes an invitation
   *  to open that one rather than a dead end. */
  duplicateOf?: { id: string; name: string } | null;
  error?: string | null;
  onCancel: () => void;
  onOpenExisting?: (id: string) => void;
  onSubmit: (v: {
    name: string; commentary?: string; category?: string; tags: string[];
  }) => void;
}

function EndpointRow({ role, ep }: { role: string; ep: Endpoint }) {
  return (
    <div className="cxf-endpoint">
      <span className="cxf-endpoint-role">{role}</span>
      <span className="cxf-endpoint-body">
        <span className="cxf-endpoint-kind">{KIND_LABEL[ep.type]}</span>
        <span className="cxf-endpoint-label">{ep.label}</span>
        {ep.arabic && <span className="cxf-endpoint-arabic" dir="rtl">{ep.arabic}</span>}
      </span>
    </div>
  );
}

export default function ConnectionForm({
  source, target, busy = false, duplicateOf = null, error = null,
  onCancel, onOpenExisting, onSubmit,
}: Props) {
  const [name, setName]       = useState("");
  const [commentary, setComm] = useState("");
  const [category, setCat]    = useState("");
  const [tagText, setTagText] = useState("");
  const ref      = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onCancel]);

  const submit = useCallback(() => {
    const n = name.trim();
    if (!n || busy) return;
    onSubmit({
      name: n,
      commentary: commentary.trim() || undefined,
      category: category || undefined,
      // Comma or space separated, de-duplicated, lowercased so "Tawhid" and
      // "tawhid" do not become two different tags.
      tags: Array.from(new Set(
        tagText.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean),
      )),
    });
  }, [name, commentary, category, tagText, busy, onSubmit]);

  return (
    <div className="seldlg-scrim">
      <div className="seldlg cxf" ref={ref} role="dialog" aria-modal="true">
        <h2 className="seldlg-title">Create Connection</h2>

        <div className="cxf-pair">
          <EndpointRow role="From" ep={source} />
          <EndpointRow role="To"   ep={target} />
        </div>

        {duplicateOf ? (
          /* Already connected. The relationship the user wanted exists, so
             offer it rather than reporting a failure — and keep what they
             typed in case they cancel out and do something else. */
          <div className="cxf-dupe">
            <p className="seldlg-note">
              These two are already connected as <strong>{duplicateOf.name}</strong>.
            </p>
            <div className="seldlg-actions">
              <button className="seldlg-btn" onClick={onCancel}>Cancel</button>
              <button
                className="seldlg-btn seldlg-btn--primary"
                onClick={() => onOpenExisting?.(duplicateOf.id)}
              >
                Open it
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <label className="cxf-label" htmlFor="cxf-name">Connection name</label>
            <input
              ref={inputRef}
              id="cxf-name"
              className="seldlg-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Life, death and return"
              dir="auto"
              maxLength={140}
            />

            <label className="cxf-label" htmlFor="cxf-comm">Commentary</label>
            <textarea
              id="cxf-comm"
              className="seldlg-input cxf-textarea"
              value={commentary}
              onChange={(e) => setComm(e.target.value)}
              placeholder="What is the relationship between these passages?"
              dir="auto"
              rows={3}
              maxLength={4000}
            />

            <div className="cxf-row">
              <div className="cxf-col">
                <label className="cxf-label" htmlFor="cxf-cat">Category</label>
                <select
                  id="cxf-cat"
                  className="seldlg-input cxf-select"
                  value={category}
                  onChange={(e) => setCat(e.target.value)}
                >
                  <option value="">None</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="cxf-col">
                <label className="cxf-label" htmlFor="cxf-tags">Tags</label>
                <input
                  id="cxf-tags"
                  className="seldlg-input"
                  value={tagText}
                  onChange={(e) => setTagText(e.target.value)}
                  placeholder="creation, tawhid"
                  dir="auto"
                />
              </div>
            </div>

            {error && <p className="cxf-error">{error}</p>}

            <div className="seldlg-actions">
              <button type="button" className="seldlg-btn" onClick={onCancel} disabled={busy}>
                Cancel
              </button>
              <button
                type="submit"
                className="seldlg-btn seldlg-btn--primary"
                disabled={busy || !name.trim()}
              >
                {busy ? "Creating…" : "Create Connection"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
