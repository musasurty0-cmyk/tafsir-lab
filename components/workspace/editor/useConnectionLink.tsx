"use client";

/**
 * The /link flow, once.
 *
 * Creating a Connection is a four-step conversation — choose the source,
 * choose the target, name the relationship, save — and it needs the editor's
 * own range so the "/link" text can be replaced by the resulting card. That
 * made it awkward to share, so it was written twice: in PageEditor, and again
 * in FreeTextBox when the canvas needed it.
 *
 * Two copies of a four-step flow is two copies of every rule inside it — that
 * a thing cannot be connected to itself, that a 409 should offer the existing
 * Connection rather than report failure, that a card which fails to insert
 * must not lose the Connection already saved. A fix to one copy is a silent
 * divergence from the other, which is exactly how the canvas ended up with a
 * /ayah that could not leave its surah and a /link that did nothing.
 *
 * The hook owns the state and the rules. A surface supplies its editor and
 * calls `openLink(range, rect)`; everything else, including both panels, comes
 * back rendered.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";

import QuranSearch from "./QuranSearch";
import ConnectionForm, { type Endpoint } from "./ConnectionForm";
import { ayahKey, surahKey, selectionKey } from "@/lib/quran-objects";
import type { SearchTarget } from "@/lib/quran-search";

type Range = { from: number; to: number };

type Stage =
  | { step: "pick"; which: "source" | "target"; range: Range; rect: DOMRect;
      source?: Endpoint; target?: Endpoint }
  | { step: "form"; range: Range; rect: DOMRect; source: Endpoint; target: Endpoint }
  | null;

export interface UseConnectionLink {
  /** Start the flow at the range the command was typed into. */
  openLink: (range: Range, rect: DOMRect) => void;
  /** Both panels, already positioned. Render once, anywhere. */
  linkUI: React.ReactNode;
  /** True while either panel is up — for surfaces that gate other gestures. */
  linkOpen: boolean;
}

export function useConnectionLink(
  { editor, workspaceId, currentSurah }:
  { editor: Editor | null; workspaceId: string; currentSurah: number },
): UseConnectionLink {
  const [stage, setStage] = useState<Stage>(null);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupe,  setDupe]  = useState<{ id: string; name: string } | null>(null);
  const [selections, setSelections] = useState<SearchTarget[]>([]);

  /* Selections load only once /link opens — /ayah never pays for the request. */
  useEffect(() => {
    if (!stage || !workspaceId) return;
    let cancelled = false;
    fetch(`/api/workspaces/${workspaceId}/segments`)
      .then((r) => (r.ok ? r.json() : { segments: [] }))
      .then((d) => {
        if (cancelled) return;
        setSelections((d.segments ?? []).map(
          (sg: { id: string; name: string; startAyah: number; endAyah: number }) => ({
            kind: "selection" as const,
            id: sg.id,
            label: sg.name || `Selection ${sg.startAyah}–${sg.endAyah}`,
            preview: `${sg.startAyah}–${sg.endAyah}`,
          })));
      })
      .catch(() => { if (!cancelled) setSelections([]); });
    return () => { cancelled = true; };
  }, [stage, workspaceId]);

  /* Both panels are portals, so nothing unmounts them implicitly. The hook
     closes itself for the cases the panel cannot see — the editor going away,
     or the surface switching to a different document underneath it. This used
     to live in PageEditor; it belongs with the state it resets. */
  useEffect(() => {
    if (!editor) setStage(null);
  }, [editor]);
  useEffect(() => () => setStage(null), []);

  const openLink = useCallback((range: Range, rect: DOMRect) => {
    /* Ask for the SOURCE first. Seeding it with the current surah and jumping
       straight to the target recorded an origin nobody chose, and a Connection
       whose source nobody asserted is not a munāsaba. */
    setStage({ step: "pick", which: "source", range, rect });
  }, []);

  /** Close, removing the "/link" text so no orphan command survives a cancel. */
  const close = useCallback((removeCommand = true) => {
    const st = stage;
    setStage(null); setBusy(false); setError(null); setDupe(null);
    if (removeCommand && editor && st) editor.chain().focus().deleteRange(st.range).run();
  }, [editor, stage]);

  const choose = useCallback((t: SearchTarget) => {
    if (!stage || stage.step !== "pick") return;
    const picked: Endpoint =
      t.kind === "ayah"
        ? { type: "ayah", key: ayahKey(t.surah ?? 1, t.ayah ?? 1), label: t.label, arabic: t.arabic }
        : t.kind === "selection"
        ? { type: "selection", key: selectionKey(t.id), label: t.label }
        // A surah label carries its ayah count for search; drop it here, where
        // it is an endpoint rather than a result.
        : { type: "surah", key: surahKey(t.surah ?? Number(t.id)), label: t.label.split(" · ")[0] };

    const source = stage.which === "source" ? picked : stage.source;
    const target = stage.which === "target" ? picked : stage.target;

    /* Refused here as well as on the server, so it is caught at the moment of
       choosing rather than after a round trip. The picker stays open. */
    if (source && target && source.key === target.key) {
      setError("An object cannot be connected to itself");
      return;
    }
    setError(null);
    if (source && target) setStage({ step: "form", range: stage.range, rect: stage.rect, source, target });
    else setStage({ ...stage, source, target, which: source ? "target" : "source" });
  }, [stage]);

  const repick = useCallback((which: "source" | "target") => {
    if (!stage || stage.step !== "form") return;
    setError(null);
    setStage({
      step: "pick", which, range: stage.range, rect: stage.rect,
      // Keep the OTHER end, so changing one side never discards the other.
      source: which === "source" ? undefined : stage.source,
      target: which === "target" ? undefined : stage.target,
    });
  }, [stage]);

  /** Drop a card referencing an already-saved Connection. */
  const insertCard = useCallback((connectionId: string, range: Range) => {
    if (!editor) return false;
    try {
      editor.chain().focus().deleteRange(range).insertContent([
        { type: "connectionBlock", attrs: { connectionId } },
        { type: "paragraph" },
      ]).focus().scrollIntoView().run();
      return true;
    } catch { return false; }
  }, [editor]);

  const submit = useCallback((v: {
    name: string; commentary?: string; category?: string; tags: string[];
  }) => {
    if (!stage || stage.step !== "form" || !editor) return;
    const { source, target, range } = stage;
    setBusy(true); setError(null);
    fetch(`/api/workspaces/${workspaceId}/connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: source.type, sourceKey: source.key,
        targetType: target.type, targetKey: target.key, ...v,
      }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        /* Already connected: offer the existing Connection rather than
           reporting a failure, keeping what was typed in the meantime. */
        if (r.status === 409 && d.existing) { setDupe({ id: d.existing.id, name: d.existing.name }); return null; }
        if (!r.ok) throw new Error(d.error ?? String(r.status));
        return d.connection;
      })
      .then((conn) => {
        if (!conn) return;
        /* The Connection is saved before the card is drawn, so a failure here
           loses a card, never the work. */
        if (!insertCard(conn.id, range)) {
          setError("Connection saved, but the card could not be inserted.");
          return;
        }
        setStage(null); setDupe(null);
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setBusy(false));
  }, [stage, editor, workspaceId, insertCard]);

  let linkUI: React.ReactNode = null;

  if (stage?.step === "pick" && typeof document !== "undefined") {
    const W = 380, MAX_H = 400;
    const left = Math.max(8, Math.min(stage.rect.left, window.innerWidth - W - 12));
    const below = window.innerHeight - stage.rect.bottom;
    const openUp = below < MAX_H + 12 && stage.rect.top > below;
    const pos: React.CSSProperties = openUp
      ? { position: "fixed", bottom: window.innerHeight - stage.rect.top + 6, left, zIndex: 9999 }
      : { position: "fixed", top: stage.rect.bottom + 6, left, zIndex: 9999 };
    linkUI = createPortal(
      <div style={pos}>
        <QuranSearch
          /* Remount when the end being chosen changes. QuranSearch holds its
             own query AND a surah→ayah drill-down; without a new key, picking
             the source left the panel exactly as it was and only the
             placeholder changed — hidden behind the text already typed. It
             read as the click doing nothing. */
          key={stage.which}
          kinds={["ayah", "selection", "surah"]}
          currentSurah={currentSurah}
          selections={selections}
          placeholder={stage.which === "source"
            ? "Linking FROM — choose an āyah, Selection or Surah…"
            : "Linking TO — choose an āyah, Selection or Surah…"}
          onSelect={choose}
          onCancel={() => close()}
        />
      </div>,
      document.body,
    );
  } else if (stage?.step === "form") {
    linkUI = (
      <ConnectionForm
        source={stage.source}
        target={stage.target}
        busy={busy}
        error={error}
        duplicateOf={dupe}
        onCancel={() => close()}
        onChangeEndpoint={repick}
        onOpenExisting={(id) => { insertCard(id, stage.range); close(false); }}
        onSubmit={submit}
      />
    );
  }

  return { openLink, linkUI, linkOpen: stage !== null };
}
