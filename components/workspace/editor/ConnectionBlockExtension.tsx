"use client";

/**
 * The Connection block left in the document by /link.
 *
 * A scholarly annotation, not an embedded card. It reads as part of the study
 * document — a thin rule in the margin, the passage it points to, the name of
 * the relationship, and the commentary — rather than as a widget dropped into
 * the page.
 *
 * Stores ONLY the Connection id. Name and commentary live in the record, so
 * editing a Connection updates every block referencing it, and deleting a
 * block removes the reference while the Connection itself survives for both
 * objects it joins.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { parseObjectKey } from "@/lib/quran-objects";

interface ConnectionData {
  id: string;
  name: string;
  commentary?: string | null;
  category?: string | null;
  sourceType: string; sourceKey: string;
  targetType: string; targetKey: string;
}

/* One in-flight request per resource, shared by every block that needs it, so
   several Connections on a page do not each re-fetch the same chapter list. */
const connCache = new Map<string, Promise<ConnectionData | null>>();
let chaptersPromise: Promise<Map<number, string>> | null = null;
const selNameCache = new Map<string, Promise<string | null>>();
const ayahCache = new Map<string, Promise<string | null>>();

function loadConnection(workspaceId: string, id: string) {
  const k = `${workspaceId}/${id}`;
  if (!connCache.has(k)) {
    connCache.set(k, fetch(`/api/workspaces/${workspaceId}/connections/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.connection ?? null)
      .catch(() => null));
  }
  return connCache.get(k)!;
}

/** Surah names come from the app's own metadata, never a table in here. */
function loadChapters(): Promise<Map<number, string>> {
  if (!chaptersPromise) {
    chaptersPromise = fetch("/api/chapters")
      .then((r) => (r.ok ? r.json() : { chapters: [] }))
      .then((d) => {
        const m = new Map<number, string>();
        for (const c of d.chapters ?? []) m.set(c.id, c.name_simple);
        return m;
      })
      .catch(() => new Map<number, string>());
  }
  return chaptersPromise;
}

function loadSelectionName(workspaceId: string, id: string) {
  const k = `${workspaceId}/${id}`;
  if (!selNameCache.has(k)) {
    selNameCache.set(k, fetch(`/api/workspaces/${workspaceId}/segments`)
      .then((r) => (r.ok ? r.json() : { segments: [] }))
      .then((d) => {
        const sg = (d.segments ?? []).find((x: { id: string }) => x.id === id);
        if (!sg) return null;
        const range = sg.startAyah === sg.endAyah
          ? `${sg.startAyah}` : `${sg.startAyah}–${sg.endAyah}`;
        return JSON.stringify({ name: sg.name || "Untitled Selection", surah: sg.surahNumber, range });
      })
      .catch(() => null));
  }
  return selNameCache.get(k)!;
}

/** A short excerpt, not the whole verse — a long āyah would make the block
 *  taller than the note it sits in. */
function loadAyah(verseKey: string) {
  if (!ayahCache.has(verseKey)) {
    ayahCache.set(verseKey, fetch(`/api/ayah/${verseKey.replace(":", "_")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.verse?.text_uthmani ?? "").trim() || null)
      .catch(() => null));
  }
  return ayahCache.get(verseKey)!;
}

const MAX_EXCERPT = 92;
function trimExcerpt(text: string): string {
  if (text.length <= MAX_EXCERPT) return text;
  // Cut on a word boundary so the excerpt never ends mid-word.
  const cut = text.slice(0, MAX_EXCERPT);
  const at = cut.lastIndexOf(" ");
  return (at > 40 ? cut.slice(0, at) : cut) + "…";
}

const LinkGlyph = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

function ConnectionCard({ node, extension }: NodeViewProps) {
  const id = node.attrs.connectionId as string;
  const workspaceId = (extension.options as { workspaceId?: string }).workspaceId ?? "";
  const [data, setData]   = useState<ConnectionData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [dest, setDest]   = useState<{ primary: string; secondary?: string } | null>(null);
  const [arabic, setArabic] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (!id || !workspaceId) { setState("missing"); return; }
    loadConnection(workspaceId, id).then((d) => {
      if (!live) return;
      if (!d) { setState("missing"); return; }
      setData(d); setState("ready");
    });
    return () => { live = false; };
  }, [id, workspaceId]);

  /* Resolve the far end into words. Which end that is depends on nothing here:
     the block always describes the TARGET, because that is what the author
     linked to from this document. */
  useEffect(() => {
    if (!data) return;
    let live = true;
    const ref = parseObjectKey(data.targetKey);
    if (!ref) { setDest({ primary: "Linked passage" }); return; }

    if (ref.type === "ayah") {
      loadChapters().then((names) => {
        if (!live) return;
        const n = names.get(ref.surah!) ?? `Surah ${ref.surah}`;
        setDest({ primary: `${n} ${ref.surah}:${ref.ayah}` });
      });
      loadAyah(`${ref.surah}:${ref.ayah}`).then((t) => {
        if (live && t) setArabic(trimExcerpt(t));
      });
    } else if (ref.type === "surah") {
      loadChapters().then((names) => {
        if (!live) return;
        const n = names.get(ref.surah!) ?? `Surah ${ref.surah}`;
        setDest({ primary: n, secondary: `Surah ${ref.surah}` });
      });
    } else {
      Promise.all([loadSelectionName(workspaceId, ref.id!), loadChapters()])
        .then(([raw, names]) => {
          if (!live) return;
          if (!raw) { setDest({ primary: "Selection" }); return; }
          const sg = JSON.parse(raw) as { name: string; surah: number; range: string };
          const n = names.get(sg.surah) ?? `Surah ${sg.surah}`;
          setDest({ primary: `“${sg.name}”`, secondary: `${n} ${sg.range}` });
        });
    }
    return () => { live = false; };
  }, [data, workspaceId]);

  if (state === "loading") {
    return (
      <NodeViewWrapper className="cxb cxb--quiet" contentEditable={false}>
        <span className="cxb-target"><LinkGlyph /> Loading Connection…</span>
      </NodeViewWrapper>
    );
  }

  if (state === "missing" || !data) {
    return (
      <NodeViewWrapper className="cxb cxb--quiet" contentEditable={false}>
        <span className="cxb-target"><LinkGlyph /> This Connection no longer exists</span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="article"
      className="cxb"
      contentEditable={false}
      data-connection-id={data.id}
    >
      {/* Destination: identifiable but quiet — it says where, not what. */}
      <span className="cxb-target" tabIndex={0} role="link">
        <LinkGlyph />
        <span>
          Connected to {dest?.primary ?? "…"}
          {dest?.secondary && <span className="cxb-target-sub"> · {dest.secondary}</span>}
        </span>
      </span>

      {/* The relationship itself — the strongest text in the block. */}
      <h3 className="cxb-name">{data.name}</h3>

      {arabic && (
        <blockquote className="cxb-arabic" dir="rtl" lang="ar">{arabic}</blockquote>
      )}

      {data.commentary && <p className="cxb-comm">{data.commentary}</p>}

      {/* Quiet text, never a coloured badge. */}
      {data.category && <span className="cxb-cat">{data.category}</span>}
    </NodeViewWrapper>
  );
}

export const ConnectionBlockExtension = Node.create({
  name: "connectionBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { workspaceId: "" };
  },

  addAttributes() {
    return {
      /* The id is the entire payload. Storing name or commentary here would
         freeze a copy into the document that diverges the moment the
         Connection is edited. */
      connectionId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "article[data-connection-id]" }, { tag: "div[data-connection-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["article", mergeAttributes(HTMLAttributes, {
      "data-connection-id": HTMLAttributes.connectionId,
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ConnectionCard);
  },
});

export default ConnectionBlockExtension;
