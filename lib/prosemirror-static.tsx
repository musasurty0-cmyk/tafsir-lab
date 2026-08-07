/**
 * Render stored TipTap/ProseMirror JSON as plain React, with no editor.
 *
 * Why this exists: TipTap is mounted with `immediatelyRender: false`, which is
 * the correct SSR guard but means every note renders EMPTY first and only fills
 * once the editor has constructed its schema from ~15 extensions. On a canvas
 * with several notes that is several ProseMirror instances building in series,
 * and the visible result is a box that sits blank and then pops — which reads
 * as "my note isn't there" rather than "my note is loading".
 *
 * Turning `immediatelyRender` on is not available to us: notes are seeded from
 * server-rendered page data (WorkspacePageView seeds useState from page.notes),
 * so the note IS server-rendered and TipTap's own DOM would not match on
 * hydration.
 *
 * So: render the document statically — deterministic, identical on server and
 * client — inside the SAME typography classes the editor uses, and swap the
 * real editor in underneath once it is ready. Done right the swap is invisible,
 * because both layers are the same text in the same place.
 *
 * The node coverage below is not guesswork. Counted across the notes actually
 * in the database: text, paragraph, listItem, bulletList, doc, hardBreak,
 * heading — and marks textStyle, bold, italic. Everything beyond that is
 * handled defensively rather than thoroughly, because a note containing an
 * āyah block must not render as a blank box; a placeholder that holds the right
 * space is worse than the editor and far better than nothing.
 */

import React from "react";

interface PMMark { type: string; attrs?: Record<string, unknown> }
interface PMNode {
  type?: string;
  text?: string;
  marks?: PMMark[];
  attrs?: Record<string, unknown>;
  content?: PMNode[];
}

/** Apply the marks a stored note actually uses. Unknown marks pass through. */
function withMarks(text: string, marks: PMMark[] | undefined, key: React.Key): React.ReactNode {
  let out: React.ReactNode = text;
  if (!marks?.length) return <React.Fragment key={key}>{out}</React.Fragment>;

  const style: React.CSSProperties = {};
  for (const m of marks) {
    switch (m.type) {
      case "bold":      out = <strong>{out}</strong>; break;
      case "italic":    out = <em>{out}</em>; break;
      case "underline": out = <u>{out}</u>; break;
      case "strike":    out = <s>{out}</s>; break;
      case "code":      out = <code>{out}</code>; break;
      case "highlight": {
        const c = (m.attrs?.color as string) ?? undefined;
        style.background = c ?? "rgba(255, 208, 80, 0.42)";
        break;
      }
      case "textStyle": {
        const a = m.attrs ?? {};
        if (a.color)      style.color = a.color as string;
        if (a.fontFamily) style.fontFamily = a.fontFamily as string;
        if (a.fontSize)   style.fontSize = a.fontSize as string;
        break;
      }
      /* link deliberately renders as a span: this layer is replaced by the
         editor within a frame and must never be clickable in the meantime. */
      default: break;
    }
  }
  if (Object.keys(style).length) out = <span style={style}>{out}</span>;
  return <React.Fragment key={key}>{out}</React.Fragment>;
}

function renderNode(node: PMNode, key: React.Key): React.ReactNode {
  if (node.type === "text") return withMarks(node.text ?? "", node.marks, key);
  if (node.type === "hardBreak") return <br key={key} />;

  const kids = (node.content ?? []).map((c, i) => renderNode(c, i));
  const dir = (node.attrs?.dir as string) ?? undefined;
  const align = (node.attrs?.textAlign as string) ?? undefined;
  const style: React.CSSProperties = {};
  if (dir) style.direction = dir as React.CSSProperties["direction"];
  if (align) style.textAlign = align as React.CSSProperties["textAlign"];

  switch (node.type) {
    case "doc":         return <React.Fragment key={key}>{kids}</React.Fragment>;
    /* An empty paragraph must still occupy a line, or the static layer is
       shorter than the editor and the box visibly grows on swap. */
    case "paragraph":   return <p key={key} style={style}>{kids.length ? kids : <br />}</p>;
    case "heading": {
      const lvl = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      const Tag = `h${lvl}` as keyof React.JSX.IntrinsicElements;
      return <Tag key={key} style={style}>{kids}</Tag>;
    }
    case "bulletList":  return <ul key={key} style={style}>{kids}</ul>;
    case "orderedList": return <ol key={key} style={style}>{kids}</ol>;
    case "listItem":    return <li key={key} style={style}>{kids}</li>;
    case "taskList":    return <ul key={key} data-type="taskList" style={style}>{kids}</ul>;
    case "taskItem":
      return (
        <li key={key} data-type="taskItem" data-checked={String(!!node.attrs?.checked)} style={style}>
          <label><input type="checkbox" checked={!!node.attrs?.checked} readOnly /></label>
          <div>{kids}</div>
        </li>
      );
    case "blockquote":  return <blockquote key={key} style={style}>{kids}</blockquote>;
    case "codeBlock":   return <pre key={key}><code>{kids}</code></pre>;
    case "horizontalRule": return <hr key={key} />;

    /* Block widgets are React node views in the editor. Reproducing them here
       would be a second implementation that drifts; holding their vertical
       space so the layout does not jump is the whole job. */
    case "ayahBlock":
    case "tafsirBlock":
    case "connectionBlock":
      return <div key={key} className="pm-static-block" aria-hidden />;

    default:
      return kids.length ? <div key={key} style={style}>{kids}</div> : null;
  }
}

/**
 * The document, statically. Returns null for an empty doc so a placeholder
 * still shows through.
 */
export const StaticDoc: React.FC<{ content: unknown }> = ({ content }) => {
  const doc = content as PMNode | null | undefined;
  if (!doc || typeof doc !== "object" || !doc.content?.length) return null;
  return <>{doc.content.map((n, i) => renderNode(n, i))}</>;
};

/** True when the doc has nothing worth painting — lets callers skip the layer. */
export function docIsEmpty(content: unknown): boolean {
  const doc = content as PMNode | null | undefined;
  if (!doc || typeof doc !== "object" || !doc.content?.length) return true;
  const hasText = (n: PMNode): boolean =>
    (n.type === "text" && !!n.text?.trim()) ||
    (n.type !== "text" && n.type !== "paragraph" && n.type !== "doc") ||
    (n.content ?? []).some(hasText);
  return !doc.content.some(hasText);
}
