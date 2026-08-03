"use client";

/**
 * The /help sheet.
 *
 * Reads buildCommands() — the SAME registry the slash menu itself filters — so
 * the list cannot drift out of date. A command added or removed there appears
 * or disappears here with no change to this file.
 *
 * Opened by a window event rather than by props: the command executes inside
 * ProseMirror, which has no way to mount React.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildCommands, filterCommands } from "./SlashCommand";

export default function SlashHelp() {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel]     = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  /* Built once per open rather than at module load: the registry is a
     function, and building it on each keystroke would rebuild every tafsir
     shortcut for nothing. */
  const all = useMemo(() => (open ? buildCommands() : []), [open]);
  const shown = useMemo(() => filterCommands(all, query), [all, query]);

  useEffect(() => {
    const onOpen = () => { setOpen(true); setQuery(""); setSel(0); };
    window.addEventListener("tl:slash-help", onOpen);
    return () => window.removeEventListener("tl:slash-help", onOpen);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { setSel(0); }, [query]);

  const close = useCallback(() => setOpen(false), []);

  /* Selecting a command inserts its trigger rather than executing it: running
     it would need the editor's live range, and typing the trigger keeps the
     user in the normal flow where they can still add an argument. */
  const choose = useCallback((id: string) => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("tl:slash-insert", { detail: { id } }));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")      { e.preventDefault(); close(); return; }
      if (e.key === "ArrowDown")   { e.preventDefault(); setSel((i) => Math.min(shown.length - 1, i + 1)); }
      else if (e.key === "ArrowUp"){ e.preventDefault(); setSel((i) => Math.max(0, i - 1)); }
      else if (e.key === "Enter")  {
        e.preventDefault();
        const cmd = shown[sel];
        if (cmd) choose(cmd.id);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, shown, sel, close, choose]);

  // Keep the highlighted row visible when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-sel="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open) return null;

  return (
    <div className="slashhelp-scrim" onMouseDown={close} role="presentation">
      <div
        className="slashhelp"
        role="dialog"
        aria-modal="true"
        aria-label="Slash commands"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="slashhelp-head">
          <h2 className="slashhelp-title">Commands</h2>
          <span className="slashhelp-count">{shown.length}</span>
        </div>

        <input
          ref={inputRef}
          className="slashhelp-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter commands…"
          aria-label="Filter commands"
        />

        <div className="slashhelp-list" ref={listRef}>
          {shown.length === 0 && (
            <div className="slashhelp-empty">No command matches that.</div>
          )}
          {shown.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className="slashhelp-item"
              data-sel={i === sel ? "true" : "false"}
              onMouseEnter={() => setSel(i)}
              onClick={() => choose(c.id)}
            >
              <span className="slashhelp-icon" aria-hidden>{c.icon}</span>
              <span className="slashhelp-text">
                <span className="slashhelp-name">/{c.id}</span>
                <span className="slashhelp-desc">{c.description}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="slashhelp-foot">
          <span>↑↓ move</span><span>↵ insert</span><span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
