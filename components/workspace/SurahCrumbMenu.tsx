"use client";

/**
 * Changing sūrah from the breadcrumb.
 *
 * The crumb already names where you are; this makes it the place you change it
 * from, which is where people reach for it. Going back to the workspace grid to
 * move from al-Fātiḥah to al-Baqarah is three navigations for one decision.
 *
 * The 114 chapters are fetched on first open rather than handed down as props:
 * every page in the workspace renders this bar, and none of them need the list
 * until someone asks for it.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { pushWithSplash } from "@/lib/nav-splash";
import { useDismissable } from "@/lib/use-dismissable";
import type { Chapter } from "@/lib/types";

interface Props {
  workspaceId: string;
  /** The sūrah currently open, so it can be marked and skipped. */
  current: number;
}

export default function SurahCrumbMenu({ workspaceId, current }: Props) {
  const [open, setOpen] = useState(false);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [q, setQ] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || chapters) return;
    let alive = true;
    fetch("/api/chapters")
      .then((r) => r.json())
      .then((d: { chapters?: Chapter[] } | Chapter[]) => {
        if (!alive) return;
        setChapters(Array.isArray(d) ? d : d.chapters ?? []);
      })
      .catch(() => { if (alive) setChapters([]); });
    return () => { alive = false; };
  }, [open, chapters]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const visible = (chapters ?? []).filter((c) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return String(c.id) === s
      || c.name_simple.toLowerCase().includes(s)
      || (c.translated_name?.name ?? "").toLowerCase().includes(s);
  });

  function go(id: number) {
    setOpen(false);
    if (id === current) return;
    pushWithSplash(router, `/workspaces/${workspaceId}/surahs/${id}`);
  }

  return (
    <span className="crumb-menu">
      <button
        type="button"
        className="crumb-menu-btn"
        aria-label="Change sūrah"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown size={13} aria-hidden />
      </button>

      {open && (
        <Panel
          onClose={() => setOpen(false)}
          q={q} setQ={setQ}
          inputRef={inputRef}
          loading={chapters === null}
          visible={visible}
          current={current}
          onPick={go}
        />
      )}
    </span>
  );
}

/* Split out so the dismiss hook mounts and unmounts with the panel rather than
   living for the lifetime of the bar. */
function Panel({
  onClose, q, setQ, inputRef, loading, visible, current, onPick,
}: {
  onClose: () => void;
  q: string; setQ: (s: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  loading: boolean;
  visible: Chapter[];
  current: number;
  onPick: (id: number) => void;
}) {
  useDismissable(onClose);
  return (
    <div className="crumb-pop" role="dialog" aria-label="Choose a sūrah">
      <input
        ref={inputRef}
        className="crumb-pop-input"
        placeholder="Sūrah name or number…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && visible[0]) onPick(visible[0].id);
        }}
      />
      <div className="crumb-pop-list">
        {loading && <p className="crumb-pop-empty">Loading…</p>}
        {!loading && visible.length === 0 && (
          <p className="crumb-pop-empty">Nothing matches that.</p>
        )}
        {visible.map((c) => (
          <button
            key={c.id}
            type="button"
            className="crumb-pop-row"
            data-current={c.id === current ? "true" : "false"}
            onClick={() => onPick(c.id)}
          >
            <span className="crumb-pop-num">{c.id}</span>
            <span className="crumb-pop-name">{c.name_simple}</span>
            <span className="crumb-pop-ar">{c.name_arabic}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
