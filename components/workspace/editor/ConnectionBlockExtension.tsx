"use client";

/**
 * The editor card left behind by /link.
 *
 * Stores ONLY the Connection id. The card fetches live data on render, so
 * renaming a Connection or rewriting its commentary updates every card that
 * references it — and deleting a card removes the reference, never the
 * Connection, which still belongs to both objects it joins.
 *
 * Visually distinct from an /ayah quotation on purpose: an ayah block IS the
 * verse, whereas this asserts a relationship between two things that live
 * elsewhere.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";

interface ConnectionData {
  id: string;
  name: string;
  commentary?: string | null;
  category?: string | null;
  sourceType: string; sourceKey: string;
  targetType: string; targetKey: string;
}

/* One in-flight request per Connection, shared by every card pointing at it —
   several cards for the same Connection on one page must not each fetch. */
const cache = new Map<string, Promise<ConnectionData | null>>();

function loadConnection(workspaceId: string, id: string): Promise<ConnectionData | null> {
  const k = `${workspaceId}/${id}`;
  if (!cache.has(k)) {
    cache.set(k, fetch(`/api/workspaces/${workspaceId}/connections/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.connection ?? null)
      .catch(() => null));
  }
  return cache.get(k)!;
}

/** Turn a stable key back into something readable. */
function describe(type: string, key: string): string {
  const [, a, b] = key.split(":");
  if (type === "ayah")  return `${a}:${b}`;
  if (type === "surah") return `Surah ${a}`;
  return "Selection";
}

function ConnectionCard({ node, extension }: NodeViewProps) {
  const id = node.attrs.connectionId as string;
  const workspaceId = (extension.options as { workspaceId?: string }).workspaceId ?? "";
  const [data, setData] = useState<ConnectionData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let live = true;
    if (!id || !workspaceId) { setState("missing"); return; }
    loadConnection(workspaceId, id).then((d) => {
      if (!live) return;
      if (d) { setData(d); setState("ready"); } else setState("missing");
    });
    return () => { live = false; };
  }, [id, workspaceId]);

  if (state === "loading") {
    return (
      <NodeViewWrapper className="cxc cxc--loading" contentEditable={false}>
        <span className="cxc-icon">🔗</span>
        <span className="cxc-name">Loading Connection…</span>
      </NodeViewWrapper>
    );
  }

  if (state === "missing" || !data) {
    /* The Connection was deleted elsewhere. Say so plainly rather than
       rendering an empty card that looks like a loading failure. */
    return (
      <NodeViewWrapper className="cxc cxc--missing" contentEditable={false}>
        <span className="cxc-icon">🔗</span>
        <span className="cxc-name">This Connection no longer exists</span>
      </NodeViewWrapper>
    );
  }

  const other = describe(data.targetType, data.targetKey);

  return (
    <NodeViewWrapper className="cxc" contentEditable={false}>
      <div className="cxc-head">
        <span className="cxc-icon">🔗</span>
        <span className="cxc-to">Connected to {other}</span>
        {data.category && <span className="cxc-cat">{data.category}</span>}
      </div>
      <div className="cxc-name">{data.name}</div>
      {data.commentary && <div className="cxc-comm">{data.commentary}</div>}
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
      /* The id is the ENTIRE payload. Storing name or commentary here would
         freeze a copy into the document that silently diverges the first time
         the Connection is edited. */
      connectionId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-connection-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, {
      "data-connection-id": HTMLAttributes.connectionId,
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ConnectionCard);
  },
});

export default ConnectionBlockExtension;
