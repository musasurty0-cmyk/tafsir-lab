/**
 * Tour state — stored in localStorage, updated via CustomEvent so all
 * TourBubble instances on the page react without needing a shared React context.
 */

const KEY      = "tl-tour";
const DONE_KEY = "tl-tutorial-done";

export interface TourState {
  active:       boolean;
  step:         number;       // 0=home  1=workspace  2=surah/page  3=finale
  workspaceId?: string;       // first workspace to navigate to on step 0 → 1
}

function dispatch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tl-tour-update"));
  }
}

export function getTour(): TourState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TourState) : null;
  } catch {
    return null;
  }
}

export function setTour(s: TourState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  dispatch();
}

export function clearTour(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  localStorage.setItem(DONE_KEY, "1");
  dispatch();
}

export function startTour(workspaceId?: string): void {
  setTour({ active: true, step: 0, workspaceId });
}

export function isTourDone(): boolean {
  if (typeof window === "undefined") return true;
  return !!localStorage.getItem(DONE_KEY);
}
