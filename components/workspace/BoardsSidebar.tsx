"use client";

/**
 * BoardsSidebar — the boards in this workspace, and the two surfaces of the
 * one you are on.
 *
 * A board is a single Page carrying both a canvas and a document, so this
 * nests rather than flattening: boards at the top level, and under the current
 * one the two surfaces it holds. Listing "Canvas" and "Document" as siblings
 * of other boards would suggest they are separate places, which is the thing
 * the board view exists to deny.
 *
 * Collapsible, and the choice sticks, because on a narrow screen the canvas
 * needs every pixel and on a wide one the list is worth keeping.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, PenLine, FileText } from "lucide-react";
import { pushWithSplash } from "@/lib/nav-splash";

export interface BoardRow { id: string; title: string }

interface Props {
  workspaceId: string;
  currentId:   string;
  /** Which surface of the current board is showing. */
  view:        "canvas" | "notes";
  onView:      (v: "canvas" | "notes") => void;
}

const OPEN_KEY = "tl-boards-sidebar";

export default function BoardsSidebar({ workspaceId, currentId, view, onView }: Props) {
  const router = useRouter();
  const [open, setOpen]     = useState(true);
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    try { setOpen(localStorage.getItem(OPEN_KEY) !== "closed"); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      try { localStorage.setItem(OPEN_KEY, next ? "open" : "closed"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/workspaces/${workspaceId}/boards`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { boards?: BoardRow[] } | null) => { if (live && d?.boards) setBoards(d.boards); })
      .catch(() => {});
    return () => { live = false; };
  }, [workspaceId]);

  const create = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    const title = new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date());

    const res = await fetch(`/api/workspaces/${workspaceId}/boards`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(() => null);
    setCreating(false);

    const d = await res?.json().catch(() => null) as { board?: BoardRow } | null;
    if (d?.board) pushWithSplash(router, `/workspaces/${workspaceId}/whiteboard/${d.board.id}`);
  }, [workspaceId, creating, router]);

  if (!open) {
    return (
      <button className="bs-reopen" onClick={toggle} title="Show boards" aria-label="Show boards">
        <ChevronLeft size={16} style={{ transform: "rotate(180deg)" }} aria-hidden />
      </button>
    );
  }

  return (
    <aside className="bs" aria-label="Boards">
      <header className="bs-head">
        <span className="bs-title">Boards</span>
        <button className="bs-collapse" onClick={toggle} title="Hide boards" aria-label="Hide boards">
          <ChevronLeft size={16} />
        </button>
      </header>

      <ul className="bs-list">
        {boards.map((b) => {
          const here = b.id === currentId;
          return (
            <li key={b.id}>
              <button
                className="bs-item" data-active={here ? "true" : "false"}
                onClick={() => { if (!here) pushWithSplash(router, `/workspaces/${workspaceId}/whiteboard/${b.id}`); }}
              >
                <span className="bs-item-name">{b.title}</span>
              </button>

              {here && (
                <ul className="bs-sub">
                  <li>
                    <button
                      className="bs-subitem" data-active={view === "canvas" ? "true" : "false"}
                      onClick={() => onView("canvas")}
                    >
                      <PenLine size={14} aria-hidden /> Canvas
                    </button>
                  </li>
                  <li>
                    <button
                      className="bs-subitem" data-active={view === "notes" ? "true" : "false"}
                      onClick={() => onView("notes")}
                    >
                      <FileText size={14} aria-hidden /> Document
                    </button>
                  </li>
                </ul>
              )}
            </li>
          );
        })}
        {boards.length === 0 && <li className="bs-empty">Loading…</li>}
      </ul>

      <button className="bs-new" onClick={create} disabled={creating}>
        <Plus size={15} aria-hidden /> {creating ? "Creating…" : "New board"}
      </button>
    </aside>
  );
}
