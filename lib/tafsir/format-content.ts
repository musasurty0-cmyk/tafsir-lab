/**
 * Presentation formatting for tafsīr text.
 *
 * Several sources (Ibn Kathīr among them) return PLAIN TEXT, not HTML. The
 * drawer used to wrap every blank-line-separated block in an identical <p>,
 * so a section title like "The Meaning of Al-Fatihah and its Various Names"
 * rendered exactly like the prose beneath it, and Arabic ḥadīth quotations sat
 * in the Latin serif running left-to-right.
 *
 * This adds structure at the PRESENTATION layer only. Nothing is fetched,
 * cached or stored differently: the same string arrives, and sources that do
 * supply their own HTML keep it untouched — their markup is authoritative and
 * is only styled, never rewritten.
 */

/** Arabic, Arabic Supplement, Extended-A and the presentation forms. */
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN  = /[A-Za-z]/;

/** A block is Arabic evidence when Arabic letters dominate its letters. */
function isArabicBlock(text: string): boolean {
  let ar = 0, la = 0;
  for (const ch of text) {
    if (ARABIC.test(ch)) ar++;
    else if (LATIN.test(ch)) la++;
  }
  return ar > 0 && ar >= la;
}

/**
 * A heading is short, unpunctuated and title-like.
 *
 * Deliberately conservative: a block that ends in sentence punctuation, or
 * that runs long, stays a paragraph. Mislabelling prose as a heading is worse
 * than missing one, because the heading style carries real emphasis.
 */
function isHeading(text: string): boolean {
  if (text.length > 90) return false;
  if (text.split(/\s+/).length > 14) return false;
  /* Ibn Kathīr glosses a quotation on the line after it, wrapped in brackets:
     "(Al-Hamdu lillahi ... is the Mother of the Qur'an.)". That is short and
     unpunctuated at its very last character, so it read as a heading until the
     closing bracket was discounted. A block that opens with a bracket or quote
     is a gloss, never a title. */
  if (/^[("'«“‘[]/.test(text)) return false;
  const tail = text.replace(/[)"'»”’\]]+$/, "");
  if (/[.!?,;:]$/.test(tail)) return false;
  // A full stop mid-block is prose that merely lacks a closing one, not a title.
  return !/\.\s/.test(text);
}

const BULLET = /^\s*[•·‣▪-]\s+/;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Line breaks inside one block are soft breaks, not new blocks. */
function inline(s: string): string {
  return esc(s).replace(/\n/g, "<br />");
}

/**
 * Turn a plain-text tafsīr into structured HTML.
 *
 * Emits only classed, semantic elements — no inline styles — so the whole
 * appearance stays in the stylesheet.
 */
export function formatPlainTafsir(text: string): string {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const out: string[] = [];
  let list: string[] = [];

  const flush = () => {
    if (list.length) {
      out.push(`<ul class="tf-list">${list.join("")}</ul>`);
      list = [];
    }
  };

  for (const block of blocks) {
    if (BULLET.test(block)) {
      const item = block.replace(BULLET, "");
      list.push(
        `<li${isArabicBlock(item) ? ' dir="rtl" lang="ar" class="tf-ar-inline"' : ""}>${inline(item)}</li>`,
      );
      continue;
    }
    flush();

    if (isArabicBlock(block)) {
      /* Arabic evidence: its own direction and face, separated by space rather
         than by a card. */
      out.push(`<blockquote class="tf-ar" dir="rtl" lang="ar">${inline(block)}</blockquote>`);
    } else if (isHeading(block)) {
      out.push(`<h3 class="tf-h">${inline(block)}</h3>`);
    } else {
      out.push(`<p>${inline(block)}</p>`);
    }
  }
  flush();
  return out.join("");
}
