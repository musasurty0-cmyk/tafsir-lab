/**
 * sanitize-html — conservative sanitizer for third-party tafsir HTML.
 *
 * Tafsir content arrives from external sources (spa5k GitHub CDN, quran.com,
 * tafsir.app scrapes) and is rendered with dangerouslySetInnerHTML. If any of
 * those sources ever shipped a script payload it would execute in every
 * reader's session (stored XSS). This strips active content while keeping the
 * benign formatting those sources actually use (<p>, <em>, <b>, <h3>, <sup>…).
 *
 * Pure string function — usable on the server (tafsir.service) and as
 * defense-in-depth at render time (TafsirBlockView / TafsirDrawer, which also
 * display HTML persisted inside old editor blocks that predates server-side
 * sanitisation).
 */

export function sanitizeTafsirHtml(html: string): string {
  if (!html) return html;
  return (
    html
      // Remove active/embedding elements entirely (with their content)
      .replace(/<\s*(script|style|iframe|object|embed|form|noscript)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      // Self-closing or unclosed variants of the same tags
      .replace(/<\s*(script|style|iframe|object|embed|form|link|meta|base|noscript)\b[^>]*\/?>/gi, "")
      // Strip inline event handlers:  onclick="…" / onerror='…' / onload=x
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
      // Neutralise javascript:/data: URLs in href/src
      .replace(/\s(href|src)\s*=\s*(["']?)\s*(javascript|data|vbscript):[^"'\s>]*\2/gi, "")
  );
}
