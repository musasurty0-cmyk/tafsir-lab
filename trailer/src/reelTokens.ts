/**
 * Reel palette — the app's LIGHT tokens, converted exactly.
 *
 * Every value here is the sRGB result of the corresponding oklch() in
 * app/globals.css, not a hand-picked approximation, so the reel shows the
 * product's actual colours. The older tokens.ts predates this session's
 * changes (it still carries the pre-contrast-fix ink tiers and the IBM Plex
 * stack) and is left alone for the existing trailer.
 */

export const R = {
  // Surfaces — warm paper white
  bg:      "#fcfbf8",   // oklch(0.987 0.003 80)
  bgElev:  "#fefdfc",   // oklch(0.995 0.002 80)
  panel:   "#f6f5f2",   // oklch(0.97  0.004 80)
  panel2:  "#eeece9",   // oklch(0.945 0.005 80)

  // Ink — warm charcoal, at the tiers the app now ships
  ink:     "#1e1a14",   // oklch(0.22  0.012 80)
  ink2:    "#46423b",   // oklch(0.38  0.012 80)
  ink3:    "#73706a",   // oklch(0.545 0.01  80)
  ink4:    "#908d88",   // oklch(0.643 0.008 80)

  // Hairlines — ink at low alpha, as in the stylesheet
  line:       "rgba(30, 26, 20, 0.09)",
  lineStrong: "rgba(30, 26, 20, 0.16)",
  hover:      "rgba(30, 26, 20, 0.045)",

  // Accent — emerald
  accent:     "#448061",              // oklch(0.55 0.08 160)
  accentSoft: "rgba(68, 128, 97, 0.10)",
  accentInk:  "#255940",              // oklch(0.42 0.07 160)

  // Purpose colours used on icons
  iconLink: "#695ba9",
  highlight: "#f4d660",

  shadowSm: "0 1px 3px rgba(30,26,20,0.06), 0 1px 2px rgba(30,26,20,0.04)",
  shadowMd: "0 4px 16px rgba(30,26,20,0.08), 0 2px 6px rgba(30,26,20,0.05)",
  shadowLg: "0 20px 48px rgba(30,26,20,0.12), 0 8px 20px rgba(30,26,20,0.07)",

  // Layout
  rail: 56,
  radius: 6,
  radiusSm: 4,
  radiusMd: 10,
  radiusLg: 14,

  /* Calibri is what the app now sets for the interface AND for Arabic typed
     into a note. Carlito is the metric-compatible fallback so the render is
     identical on a machine without Calibri. */
  fontSans:  'Calibri, Carlito, "Segoe UI", system-ui, sans-serif',
  fontMono:  '"JetBrains Mono", ui-monospace, monospace',
  fontSerif: '"Source Serif 4", Georgia, serif',
  // Embedded āyāt use the Uthmani stack.
  fontArabic: '"Amiri Quran", "Amiri", serif',
} as const;

/**
 * The app's DARK tokens, converted the same way — the sRGB result of each
 * oklch() in the `[data-theme="dark"]` block, not a hand-mixed dark palette.
 * Chroma is 0 throughout, which is why nothing here has a blue cast.
 *
 * Used for the reel's mode drop. Note the app's own stage→card separation in
 * dark is 1.10:1 (vs 1.24:1 in light) — the dark surfaces sit closer together,
 * so shadow does more of the lifting than tone.
 */
export const D = {
  bg:      "#171717",   // oklch(0.205 0 0)
  bgElev:  "#202020",   // oklch(0.245 0 0)
  /* The app's darkest surface. Used as the reel's dark STAGE rather than --bg:
     bg over bg-elev separates by only 1.10:1, which holds up on a desktop with
     borders and shadows but disappears at phone scale, so the map's container
     read as a hole. paper over bg-elev is 1.20:1 — the same relationship the
     light stage has. */
  paper:   "#0c0c0c",   // oklch(0.155 0 0)
  panel:   "#282828",   // oklch(0.275 0 0)
  panel2:  "#313131",   // oklch(0.315 0 0)

  ink:     "#eeeeee",   // oklch(0.95  0 0)
  ink2:    "#bebebe",   // oklch(0.80  0 0)
  ink3:    "#949494",   // oklch(0.665 0 0)
  ink4:    "#767676",   // oklch(0.565 0 0)

  line:       "rgba(238, 238, 238, 0.07)",
  lineStrong: "rgba(238, 238, 238, 0.13)",

  accent:     "#5cab83",              // oklch(0.68 0.1 160)
  accentSoft: "rgba(92, 171, 131, 0.15)",
  accentInk:  "#7bcba1",              // oklch(0.78 0.1 160)

  iconLink: "#a79bdd",

  shadowMd: "0 4px 12px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.25)",
  shadowLg: "0 24px 48px rgba(0,0,0,0.5), 0 8px 16px rgba(0,0,0,0.3)",
} as const;
