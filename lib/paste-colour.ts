/**
 * What to do with a text colour that arrives in pasted HTML.
 *
 * OneNote, Word and Google Docs write a colour on nearly everything: their
 * default text colour (black, or a near-black grey), and their heading
 * colours (OneNote's Heading 3 is a dark blue). Kept as they are, the first
 * turns a pasted quote near-invisible on a dark page, and the second is too
 * dark to read there.
 *
 * So: a colourless (grey, black or white) colour is dropped, letting the text
 * take the page's own ink, which follows the theme. A real colour is kept,
 * with its lightness brought into a band that reads on both light and dark.
 */

const NEUTRAL_NAMES = new Set([
  "black", "white", "windowtext", "windowframe", "buttontext", "canvastext",
  "gray", "grey", "silver", "darkgray", "darkgrey", "dimgray", "dimgrey",
  "lightgray", "lightgrey", "gainsboro", "whitesmoke",
  "inherit", "initial", "unset", "currentcolor", "auto", "transparent",
]);

/** Below this saturation a colour is a grey, not a colour. */
const MIN_SATURATION = 0.18;
/** The lightness band that reads on the paper and on the dark theme. */
const LIGHTNESS = { min: 0.42, max: 0.66 };

function parse(css: string): [number, number, number] | null {
  const s = css.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16)) as [number, number, number];
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as [number, number, number];
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;   // fully transparent
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  return null;
}

function toHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function toRgb([h, s, l]: [number, number, number]): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255);
  };
  return `rgb(${ch(h + 1 / 3)}, ${ch(h)}, ${ch(h - 1 / 3)})`;
}

/**
 * The colour to keep for pasted text, or null to drop it. A colour this
 * cannot read (a name like "teal") is kept as written.
 */
export function pastedColour(css: string | null | undefined): string | null {
  if (!css) return null;
  const s = css.trim().toLowerCase();
  if (!s || NEUTRAL_NAMES.has(s)) return null;
  const rgb = parse(s);
  if (!rgb) return /^[a-z]+$/.test(s) ? s : null;
  const [h, sat, l] = toHsl(rgb);
  // Pure black and white have no hue to judge by; neither does a grey.
  if (sat < MIN_SATURATION || l < 0.06 || l > 0.97) return null;
  const clamped = Math.min(LIGHTNESS.max, Math.max(LIGHTNESS.min, l));
  return clamped === l ? `rgb(${rgb.join(", ")})` : toRgb([h, sat, clamped]);
}
