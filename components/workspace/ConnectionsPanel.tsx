"use client";

/**
 * Every Connection touching one study object.
 *
 * This is where bidirectionality becomes visible. The record is stored once,
 * so the panel always describes the OTHER end relative to whatever is being
 * viewed: the same Connection reads "Connected to Al-Baqarah 2:28" from
 * Al-Mulk, and "Connected to Al-Mulk 67:1" from Al-Baqarah.
 *
 * Connections only. Notes, Tafsir and Selections each have their own surface,
 * and folding them together would make this useful for none of them.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { otherEnd, parseObjectKey, type ObjectType } from "@/lib/quran-objects";

export interface ConnectionRow {
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
  /** The object whose Connections these are, e.g. "ayah:67:1". */
  objectKey: string;
  /** Resolve a surah number to its name, so endpoints read as names. */
  surahName?: (n: number) => string;
  /** Resolve a Selection id to its name. */
  selectionName?: (id: string) => string | undefined;
  onClose: () => void;
  /** Navigate to the other end. Omitted where navigation is not possible. */
  onOpenObject?: (key: string, type: ObjectType) => void;
}

const KIND: Record<string, string> = {
  ayah: "Āyah", selection: "Selection", surah: "Surah",
};

export default function ConnectionsPanel({
  workspaceId, objectKey, surahName, selectionName, onClose, onOpenObject,
}: Props) {
  const [rows, setRows]       = useState<ConnectionRow[]>([]);
  const [state, setState]     = useState<"loading" | "ready" | "error">("loading");
  const [openId, setOpenId]   = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft]     = useState<{ name: string; commentary: string }>({ name: "", commentary: "" });
  const [confirming, setConf] = useState<string | null>(null);

  /* Queried BY OBJECT, never the whole workspace graph — a verse with three
     Connections must not pay for a workspace with three thousand. */
  const load = useCallback(() => {
    setState("loading");
    fetch(`/api/workspaces/${workspaceId}/connections?object=${encodeURIComponent(objectKey)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { setRows(d.connections ?? []); setState("ready"); })
      .catch(() => setState("error"));
  }, [workspaceId, objectKey]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault(); e.stopPropagation();
      if (confirming) setConf(null);
      else if (editing) setEditing(null);
      else if (openId) setOpenId(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, openId, editing, confirming]);

  /** Describe an endpoint in words rather than as a key. */
  const describe = useCallback((type: string, key: string): string => {
    const ref = parseObjectKey(key);
    if (!ref) return key;
    if (ref.type === "ayah") {
      const n = surahName?.(ref.surah!) ?? `Surah ${ref.surah}`;
      return `${n} ${ref.surah}:${ref.ayah}`;
    }
    if (ref.type === "surah") return surahName?.(ref.surah!) ?? `Surah ${ref.surah}`;
    return selectionName?.(ref.id!) ?? "Selection";
  }, [surahName, selectionName]);

  const items = useMemo(() => rows.map((c) => {
    const end = otherEnd(c, objectKey);
    return { conn: c, end, label: describe(end.type, end.key) };
  }), [rows, objectKey, describe]);

  const save = useCallback((id: string) => {
    const body = { name: draft.name.trim(), commentary: draft.commentary };
    if (!body.name) return;
    // Optimistic, then reconciled from the response — a failed PATCH reloads
    // rather than leaving the panel showing something the server rejected.
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...body } : r)));
    setEditing(null);
    fetch(`/api/workspaces/${workspaceId}/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => { if (!r.ok) load(); }).catch(load);
  }, [draft, workspaceId, load]);

  const remove = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setConf(null); setOpenId(null);
    fetch(`/api/workspaces/${workspaceId}/connections/${id}`, { method: "DELETE" })
      .then((r) => { if (!r.ok) load(); }).catch(load);
  }, [workspaceId, load]);

  const detail = openId ? items.find((i) => i.conn.id === openId) : null;

  return (
    <div className="cxp-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="cxp" role="dialog" aria-label="Connections">
        <header className="cxp-head">
          <span className="cxp-title">
            Connections
            {state === "ready" && <span className="cxp-count">{rows.length}</span>}
          </span>
          <button className="cxp-close" onClick={onClose} title="Close">✕</button>
        </header>

        {state === "loading" && <div className="cxp-empty">Loading…</div>}
        {state === "error" && (
          <div className="cxp-empty">
            Could not load Connections.{" "}
            <button className="cxp-link" onClick={load}>Try again</button>
          </div>
        )}
        {state === "ready" && rows.length === 0 && (
          <div className="cxp-empty">
            Nothing connected yet. Use <code>/link</code> in a note to relate this to
            another passage.
          </div>
        )}

        {/* ── Detail ── */}
        {detail ? (
          <div className="cxp-detail">
            <button className="cxp-back" onClick={() => setOpenId(null)}>‹ All Connections</button>

            {editing === detail.conn.id ? (
              <>
                <label className="cxf-label" htmlFor="cxp-name">Name</label>
                <input
                  id="cxp-name"
                  className="seldlg-input"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  dir="auto"
                />
                <label className="cxf-label" htmlFor="cxp-comm">Commentary</label>
                <textarea
                  id="cxp-comm"
                  className="seldlg-input cxf-textarea"
                  value={draft.commentary}
                  onChange={(e) => setDraft((d) => ({ ...d, commentary: e.target.value }))}
                  rows={5}
                  dir="auto"
                />
                <div className="cxp-actions">
                  <button className="seldlg-btn" onClick={() => setEditing(null)}>Cancel</button>
                  <button
                    className="seldlg-btn seldlg-btn--primary"
                    onClick={() => save(detail.conn.id)}
                    disabled={!draft.name.trim()}
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="cxp-detail-name">{detail.conn.name}</h3>
                {detail.conn.category && <span className="cxc-cat">{detail.conn.category}</span>}

                <div className="cxp-ends">
                  <div className="cxp-end">
                    <span className="cxf-endpoint-role">From</span>
                    <span>{describe(detail.conn.sourceType, detail.conn.sourceKey)}</span>
                  </div>
                  <div className="cxp-end">
                    <span className="cxf-endpoint-role">To</span>
                    <span>{describe(detail.conn.targetType, detail.conn.targetKey)}</span>
                  </div>
                </div>

                {detail.conn.commentary && (
                  <p className="cxp-comm" dir="auto">{detail.conn.commentary}</p>
                )}

                <div className="cxp-meta">
                  {detail.conn.createdBy?.name && <>By {detail.conn.createdBy.name} · </>}
                  Updated {new Date(detail.conn.updatedAt).toLocaleDateString()}
                </div>

                <div className="cxp-actions">
                  {onOpenObject && (
                    <button
                      className="seldlg-btn"
                      onClick={() => onOpenObject(detail.end.key, detail.end.type)}
                    >
                      Open {KIND[detail.end.type]}
                    </button>
                  )}
                  <button
                    className="seldlg-btn"
                    onClick={() => {
                      setDraft({
                        name: detail.conn.name,
                        commentary: detail.conn.commentary ?? "",
                      });
                      setEditing(detail.conn.id);
                    }}
                  >
                    Edit
                  </button>
                </div>

                {confirming === detail.conn.id ? (
                  <div className="cxp-confirm">
                    <span>Delete this Connection? It will disappear from both passages.</span>
                    <div className="cxp-actions">
                      <button className="seldlg-btn" onClick={() => setConf(null)}>Keep</button>
                      <button
                        className="seldlg-btn seldlg-btn--danger"
                        onClick={() => remove(detail.conn.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="cxp-delete" onClick={() => setConf(detail.conn.id)}>
                    Delete Connection
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          /* ── List ── */
          <div className="cxp-rows">
            {items.map(({ conn, end, label }) => (
              <button key={conn.id} className="cxp-row" onClick={() => setOpenId(conn.id)}>
                <span className="cxp-row-top">
                  <span className="cxp-row-kind">{KIND[end.type] ?? end.type}</span>
                  <span className="cxp-row-to">{label}</span>
                  {conn.category && <span className="cxp-row-cat">{conn.category}</span>}
                </span>
                <span className="cxp-row-name">{conn.name}</span>
                {conn.commentary && <span className="cxp-row-comm">{conn.commentary}</span>}
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
