/**
 * Appearance preferences — theme and reading typography.
 *
 * Shared so the values are applied app-wide on load, not only where the
 * settings menu happens to be mounted. The menu lives on the dashboard, so
 * without this a workspace page would open at the default size and theme and
 * only correct itself if the user went back to the dashboard.
 *
 * Stored in the existing "tl-tweaks" blob rather than a new key, and always
 * merged into it, so the per-page tweaks already saved there survive.
 */

export const TWEAKS_KEY = "tl-tweaks";

export type Theme = "light" | "dark";
export type FontStep = "sm" | "md" | "lg" | "xl";

export const FONT_STEPS: { id: FontStep; label: string; scale: number }[] = [
  { id: "sm", label: "Small",   scale: 0.9  },
  { id: "md", label: "Default", scale: 1    },
  { id: "lg", label: "Large",   scale: 1.15 },
  { id: "xl", label: "Larger",  scale: 1.3  },
];

export const stepScale = (id: FontStep) =>
  FONT_STEPS.find((s) => s.id === id)?.scale ?? 1;

export interface Typo { reading: FontStep; arabic: FontStep }
export const DEFAULT_TYPO: Typo = { reading: "md", arabic: "md" };

interface TweaksBlob { theme?: Theme; typography?: Partial<Typo> }

function read(): TweaksBlob {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TWEAKS_KEY);
    return raw ? (JSON.parse(raw) as TweaksBlob) : {};
  } catch { return {}; }
}

/** Merge a patch in, preserving every other tweak already stored. */
export function writeAppearance(patch: TweaksBlob) {
  try {
    const prev = read();
    localStorage.setItem(TWEAKS_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch { /* storage unavailable — the DOM is still updated below */ }
}

export function readTheme(): Theme {
  return read().theme === "dark" ? "dark" : "light";
}

export function readTypo(): Typo {
  return { ...DEFAULT_TYPO, ...(read().typography ?? {}) };
}

/** Push both preferences onto the document root. */
export function applyAppearance(theme = readTheme(), typo = readTypo()) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.setAttribute("data-theme", theme);
  r.style.setProperty("--fs-reading", String(stepScale(typo.reading)));
  r.style.setProperty("--fs-arabic",  String(stepScale(typo.arabic)));
}
