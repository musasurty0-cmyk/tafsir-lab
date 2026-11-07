"use client";

/**
 * Which sūrahs a workspace's grid shows (organisers only). "All 114", or a
 * chosen few: a cohort studying four sūrahs sees those four and nothing else.
 * Saved as it changes; hidden sūrahs keep every page and note made in them.
 */
import { useMemo, useState } from "react";
import type { Chapter } from "@/lib/types";

interface Props {
  workspaceId: string;
  chapters: Chapter[];
  shown: number[];
  onChanged: (list: number[]) => void;
}

export default function ShownSurahsSetting({ workspaceId, chapters, shown, onChanged }: Props) {
  const [chosen, setChosen] = useState<number[]>(shown);
  const [mode, setMode] = useState<"all" | "some">(shown.length ? "some" : "all");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(list: number[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shownSurahs: list }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save");
      onChanged(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function chooseMode(next: "all" | "some") {
    setMode(next);
    // "All" saves at once; "chosen" waits for a first sūrah, so the grid is never empty.
    if (next === "all") void save([]);
    else if (chosen.length) void save(chosen);
  }

  function toggle(n: number) {
    const next = chosen.includes(n) ? chosen.filter((x) => x !== n) : [...chosen, n].sort((a, b) => a - b);
    setChosen(next);
    if (next.length) void save(next);
  }

  const query = q.trim().toLowerCase();
  const list = useMemo(
    () => chapters.filter((c) => !query || String(c.id) === query || c.name_simple.toLowerCase().includes(query) || (c.translated_name?.name ?? "").toLowerCase().includes(query)),
    [chapters, query],
  );

  return (
    <div className="ws-settings-section">
      <div className="ws-settings-section-title">Sūrahs on the grid</div>
      <p className="shown-sub">Choose the sūrahs this workspace studies. Members see only these. Pages already made in others are kept.</p>

      <div className="shown-seg" role="tablist" aria-label="Which sūrahs to show">
        <button role="tab" aria-selected={mode === "all"} onClick={() => chooseMode("all")}>All 114</button>
        <button role="tab" aria-selected={mode === "some"} onClick={() => chooseMode("some")}>
          Chosen{chosen.length ? ` (${chosen.length})` : ""}
        </button>
      </div>

      {mode === "some" && (
        <>
          {chosen.length > 0 && (
            <div className="shown-chips">
              {chosen.map((n) => {
                const c = chapters.find((x) => x.id === n);
                return (
                  <button key={n} className="shown-chip" onClick={() => toggle(n)} aria-label={`Remove ${c?.name_simple ?? n}`}>
                    {n}. {c?.name_simple ?? ""} <span aria-hidden>×</span>
                  </button>
                );
              })}
            </div>
          )}
          <input className="shown-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a sūrah by name or number" aria-label="Find a sūrah" />
          <div className="shown-list">
            {list.map((c) => (
              <label key={c.id} className="shown-row">
                <input type="checkbox" checked={chosen.includes(c.id)} onChange={() => toggle(c.id)} />
                <span className="shown-n">{c.id}</span>
                <span className="shown-name">{c.name_simple}</span>
                <span className="shown-ar" dir="rtl" lang="ar">{c.name_arabic}</span>
              </label>
            ))}
          </div>
          {chosen.length === 0 && <p className="shown-sub">Tick at least one sūrah. Until then the grid shows all 114.</p>}
        </>
      )}
      {saving && <p className="shown-sub">Saving…</p>}
      {error && <p className="shown-err">{error}</p>}
    </div>
  );
}
