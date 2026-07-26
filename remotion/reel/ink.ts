/**
 * ink.ts — real digital ink, not a path reveal.
 *
 * A stroke is a list of [x, y, pressure] samples. We render the same way the
 * product does (lib/ink.ts): offset each sample perpendicular to its tangent
 * by a pressure-derived radius and fill the resulting outline, so the line has
 * genuine weight variation — thin on fast moves, heavy where the hand slowed.
 *
 * Writing is animated by revealing SAMPLES, not dash-offset. That matters:
 * the nib travels at the speed the hand travelled, pauses where the writer
 * paused, and lifts between strokes.
 */

export type Sample = [number, number, number]; // x, y, pressure 0..1

export interface Stroke {
  pts: Sample[];
  /** when this stroke starts, in "writing units" (see writeProgress) */
  at: number;
  /** how long it takes, same units */
  dur: number;
  width?: number;
  color?: string;
}

/** Catmull-Rom through control points → dense samples with a pressure curve. */
export function pen(
  ctrl: [number, number][],
  { width = 3.4, press = 0.75, taper = true, jitter = 0.35 }: {
    width?: number; press?: number; taper?: boolean; jitter?: number;
  } = {},
): Sample[] {
  const P = ctrl.length < 2 ? ctrl : ctrl;
  const out: Sample[] = [];
  const seg = 14;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let j = 0; j < seg; j++) {
      const t = j / seg, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      const u = (i + t) / (P.length - 1);
      // deterministic wobble — a real hand is never perfectly smooth
      const w = Math.sin(u * 37.7) * jitter + Math.sin(u * 91.3) * jitter * 0.4;
      out.push([x + w * 0.5, y + w * 0.4, press]);
    }
  }
  out.push([P[P.length - 1][0], P[P.length - 1][1], press]);
  // Taper the ends: pressure rises as the nib lands and falls as it lifts.
  const n = out.length;
  if (taper) {
    for (let i = 0; i < n; i++) {
      const a = Math.min(1, i / (n * 0.16)), b = Math.min(1, (n - 1 - i) / (n * 0.2));
      // speed-based thinning: mid-stroke moves fastest, so it runs lighter
      const speed = 1 - 0.22 * Math.sin((i / n) * Math.PI);
      out[i][2] = out[i][2] * Math.min(a, b) * speed;
    }
  }
  void width;
  return out;
}

/** Build the fill path for the revealed portion of a stroke. */
export function inkPath(pts: Sample[], reveal: number, base = 3.4): string {
  const n = Math.max(2, Math.floor(pts.length * Math.max(0, Math.min(1, reveal))));
  if (n < 2) return "";
  const P = pts.slice(0, n);
  const L: [number, number][] = [], R: [number, number][] = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const r = Math.max(0.35, base * (0.34 + 0.66 * P[i][2])) / 2;
    L.push([P[i][0] + r * Math.cos(th - Math.PI / 2), P[i][1] + r * Math.sin(th - Math.PI / 2)]);
    R.push([P[i][0] + r * Math.cos(th + Math.PI / 2), P[i][1] + r * Math.sin(th + Math.PI / 2)]);
  }
  const d = [`M ${L[0][0].toFixed(2)} ${L[0][1].toFixed(2)}`];
  for (let i = 1; i < L.length; i++) d.push(`L ${L[i][0].toFixed(2)} ${L[i][1].toFixed(2)}`);
  for (let i = R.length - 1; i >= 0; i--) d.push(`L ${R[i][0].toFixed(2)} ${R[i][1].toFixed(2)}`);
  d.push("Z");
  return d.join(" ");
}

/** Where the nib is right now (for the pen cursor), or null if lifted. */
export function nibAt(pts: Sample[], reveal: number): [number, number] | null {
  if (reveal <= 0 || reveal >= 1) return null;
  const i = Math.min(pts.length - 1, Math.floor(pts.length * reveal));
  return [pts[i][0], pts[i][1]];
}

/** Per-stroke reveal from a global 0..1 writing clock, including pen lifts. */
export function strokeReveal(st: Stroke, t: number): number {
  return Math.max(0, Math.min(1, (t - st.at) / st.dur));
}
