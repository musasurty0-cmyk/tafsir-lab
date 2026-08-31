/**
 * POST /api/assistant/mindmap — turn an answer into a mindmap tree.
 *
 * Separate from the answer route on purpose. Asking one call to stream prose
 * to a reader AND emit a machine-readable tree damages one of the two, and
 * this runs only when someone has actually asked for a map — so an ordinary
 * question never pays for it.
 *
 * Returns the PRUNED, validated tree. The caps live on this side rather than
 * in the client because they are a guarantee about what can reach a board,
 * and a guarantee enforced in the browser is a request.
 *
 * The response is deliberately small: labels and structure, no geometry. Where
 * the boxes go is the board's business, and the same tree laid out on a phone
 * and on a desk should not have to come back from the server twice.
 */

import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import * as LLM from "@/lib/tafsir/llm";
import { pruneTree, type MindNode } from "@/lib/mindmap";

const MAX_TEXT = 6000;

/** The model's reply is untrusted shape — walk it into our own type. */
function coerce(raw: unknown, depth = 0): MindNode | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { label?: unknown; children?: unknown };
  const label = typeof o.label === "string" ? o.label.trim() : "";
  if (!label) return null;
  const node: MindNode = { label };
  if (Array.isArray(o.children) && depth < 6) {
    const kids = o.children
      .map((c) => coerce(c, depth + 1))
      .filter((c): c is MindNode => c !== null);
    if (kids.length) node.children = kids;
  }
  return node;
}

export async function POST(req: NextRequest) {
  try {
    await getSession();
  } catch {
    return new Response(JSON.stringify({ error: "Not signed in" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({})) as {
    text?: unknown; subject?: unknown;
  };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : undefined;

  if (text.length < 40) {
    return new Response(JSON.stringify({ error: "There is not enough here to map." }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const raw = await LLM.mindmapFrom(text.slice(0, MAX_TEXT), subject);
  const shaped = raw ? coerce(raw) : null;
  if (!shaped) {
    /* 503, not 500: nothing is broken, the model just did not return a tree
       this time. The client offers the reader a retry rather than an error. */
    return new Response(JSON.stringify({ error: "Could not shape that into a mindmap." }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ tree: pruneTree(shaped) }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}
