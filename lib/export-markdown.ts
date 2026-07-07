/**
 * export-markdown — serializes a page (TipTap JSON + structured notes)
 * into a portable Markdown document.
 *
 * The trust safety valve from the council verdict: students commit real
 * study time only when they know their notes aren't locked in.
 */

// ── TipTap JSON shapes (loose) ─────────────────────────────────────────────

interface TNode {
  type?:    string;
  text?:    string;
  attrs?:   Record<string, unknown>;
  marks?:   { type: string; attrs?: Record<string, unknown> }[];
  content?: TNode[];
}

// ── Inline text with marks ─────────────────────────────────────────────────

function inline(node: TNode): string {
  if (node.text != null) {
    let t = node.text;
    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case "bold":      t = `**${t}**`; break;
        case "italic":    t = `*${t}*`;   break;
        case "strike":    t = `~~${t}~~`; break;
        case "underline": t = `<u>${t}</u>`; break;
        case "code":      t = `\`${t}\``; break;
        case "highlight": t = `==${t}==`; break;
      }
    }
    return t;
  }
  return (node.content ?? []).map(inline).join("");
}

// ── Block-level rendering ──────────────────────────────────────────────────

function block(node: TNode, depth = 0): string {
  const children = node.content ?? [];
  switch (node.type) {
    case "paragraph": {
      const t = inline(node);
      return t ? `${t}\n\n` : "\n";
    }
    case "heading": {
      const level = Math.min(6, Number(node.attrs?.level ?? 1) + 1); // page title is h1
      return `${"#".repeat(level)} ${inline(node)}\n\n`;
    }
    case "blockquote":
      return children.map((c) => block(c, depth)).join("")
        .split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n") + "\n\n";
    case "bulletList":
      return children.map((li) => listItem(li, depth, "-")).join("") + "\n";
    case "orderedList":
      return children.map((li, i) => listItem(li, depth, `${i + 1}.`)).join("") + "\n";
    case "horizontalRule":
      return "---\n\n";
    case "toggleList": {
      const [summary, ...body] = children;
      const head = summary ? inline(summary) : "";
      return `<details>\n<summary>${head}</summary>\n\n${body.map((c) => block(c, depth)).join("")}</details>\n\n`;
    }
    case "ayahBlock": {
      const a = node.attrs ?? {};
      const verseKey = String(a.verseKey ?? "");
      const arabic   = String(a.arabicText ?? "").trim();
      const trans    = String(a.translationText ?? "").trim();
      let out = `> **Ayah ${verseKey}**\n`;
      if (arabic) out += `> ${arabic}\n`;
      if (trans)  out += `> ${trans}\n`;
      return out + "\n";
    }
    case "tafsirBlock": {
      const a = node.attrs ?? {};
      return `> **Tafsir ${String(a.sourceName ?? "")} — ${String(a.verseKey ?? "")}**\n> (see app for full commentary)\n\n`;
    }
    default:
      // Unknown blocks: render their children so no text is lost.
      return children.map((c) => block(c, depth)).join("");
  }
}

function listItem(li: TNode, depth: number, marker: string): string {
  const indent = "  ".repeat(depth);
  const parts  = (li.content ?? []).map((c) =>
    c.type === "bulletList" || c.type === "orderedList"
      ? block(c, depth + 1)
      : inline(c),
  );
  return `${indent}${marker} ${parts.join("").trim()}\n`;
}

// ── Notes appendix ─────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  text: "Note", callout: "Callout", linguistic: "Linguistic",
  thematic: "Thematic", ruling: "Ruling", question: "Question", textbox: "Text box",
};

interface ExportNote {
  noteType:    string;
  surahNumber: number | null;
  ayahNumber:  number | null;
  content:     unknown;
  author:      { name: string };
}

function noteText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const n = node as TNode;
  if (n.text) return n.text;
  if (!n.content) return "";
  const parts = n.content.map(noteText);
  return n.type === "doc" ? parts.join("\n").trim() : parts.join("");
}

// ── Public API ─────────────────────────────────────────────────────────────

export function pageToMarkdown(opts: {
  title:      string;
  surahName?: string;
  doc:        unknown;               // TipTap JSON
  notes?:     ExportNote[];
}): string {
  const { title, surahName, doc, notes = [] } = opts;

  let md = `# ${title}\n\n`;
  if (surahName) md += `*${surahName}*\n\n`;

  const root = doc as TNode | null;
  if (root?.content?.length) {
    md += root.content.map((n) => block(n)).join("");
  }

  if (notes.length > 0) {
    md += `\n---\n\n## Notes\n\n`;
    for (const n of notes) {
      const anchor = n.ayahNumber != null && n.surahNumber != null
        ? ` (${n.surahNumber}:${n.ayahNumber})`
        : "";
      const text = noteText(n.content).split("\n").join("\n  ");
      md += `- **${TYPE_LABEL[n.noteType] ?? n.noteType}${anchor}** — ${n.author.name}\n  ${text}\n\n`;
    }
  }

  return md.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Trigger a client-side download of the markdown file. */
export function downloadMarkdown(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, "-");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
