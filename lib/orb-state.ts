/**
 * What the thinking orb should be doing, given what the assistant is doing.
 *
 * The pipeline already tells us: every stage of `/api/assistant` streams a
 * `step` event with a machine name, and both AI surfaces keep the list. So the
 * orb is driven by the server's own account of where it is, not by a guess
 * made from whether text has started arriving. When the answer takes eight
 * seconds because the corpus search is slow, the orb says so.
 *
 * The states come from `thinking-orbs`; the mapping is ours.
 */

import type { OrbState } from "thinking-orbs";

/**
 * Step name → orb. Each is chosen for what the animation actually depicts,
 * which is the only reason to prefer one over another:
 *
 *  • `understand` — working out what was asked  → solving  (bands scramble and click back)
 *  • `notes`      — reading the reader's own notes → searching (a meridian sweeps the globe)
 *  • `embed`      — placing the question in the corpus's meaning-space
 *                                              → connecting (a constellation wires itself)
 *  • `search`     — sweeping the tafsīr corpus  → searching
 *  • `answer`     — writing                     → composing (an undulating sash)
 *  • `translate`  — carrying Arabic across      → weaving   (three strands plait)
 */
const STEP_ORB: Record<string, OrbState> = {
  understand: "solving",
  notes:      "searching",
  embed:      "connecting",
  search:     "searching",
  answer:     "composing",
  translate:  "weaving",
};

/**
 * Short labels for the waiting bubble. The server sends a fuller `detail` for
 * each step, but that already appears in the trace underneath — repeating it
 * in the bubble says the same sentence twice, so these are the shorter form.
 */
const STEP_LABEL: Record<string, string> = {
  understand: "Reading your question…",
  notes:      "Searching your notes…",
  embed:      "Placing it in meaning-space…",
  search:     "Searching the tafsīr…",
  answer:     "Writing…",
  translate:  "Translating…",
};

/** The orb for a step name. `working` is the honest answer for "busy, and we
 *  have not been told more" — which is the state before the first event lands. */
export function orbForStep(step?: string): OrbState {
  return (step && STEP_ORB[step]) || "working";
}

/** The waiting label for a step name. */
export function labelForStep(step?: string): string {
  return (step && STEP_LABEL[step]) || "Thinking…";
}
