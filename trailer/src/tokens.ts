// Faithful translations of the project's OKLCH tokens to hex for Remotion inline styles

export const T = {
  // Backgrounds — paper-warm light
  bg:       "#FAFAF8",   // oklch(0.987 0.003 80)
  bgElev:   "#FEFEFE",   // oklch(0.995 0.002 80)
  panel:    "#F5F4F1",   // oklch(0.97 0.004 80)
  panel2:   "#ECEAE6",   // oklch(0.945 0.005 80)

  // Ink — warm charcoal
  ink:      "#272118",   // oklch(0.22 0.012 80)
  ink2:     "#4A4035",   // oklch(0.38 0.012 80)
  ink3:     "#7C746B",   // oklch(0.56 0.01 80)
  ink4:     "#B4AEA8",   // oklch(0.72 0.008 80)

  // Lines
  line:        "rgba(39, 33, 24, 0.09)",
  lineStrong:  "rgba(39, 33, 24, 0.16)",

  // Emerald accent — oklch(0.55 0.08 160)
  accent:     "#2D9E74",
  accentSoft: "rgba(45, 158, 116, 0.10)",
  accentInk:  "#1E7554",

  // Shadows (approximate)
  shadowSm: "0 1px 2px rgba(39,33,24,0.04), 0 1px 1px rgba(39,33,24,0.02)",
  shadowMd: "0 4px 12px rgba(39,33,24,0.06), 0 2px 4px rgba(39,33,24,0.04)",
  shadowLg: "0 24px 48px rgba(39,33,24,0.10), 0 8px 16px rgba(39,33,24,0.06)",

  // Layout
  rail:    56,
  sidebar: 272,
  drawer:  440,
  radius:  6,
  radiusLg: 10,

  // Fonts
  fontSans:   '"IBM Plex Sans", system-ui, sans-serif',
  fontSerif:  '"IBM Plex Serif", Georgia, serif',
  fontMono:   '"IBM Plex Mono", monospace',
  fontArabic: '"Amiri Quran", "Amiri", serif',
} as const;
