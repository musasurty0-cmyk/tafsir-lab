import React from "react";
import { interpolate } from "remotion";
import { R, D } from "../reelTokens";
import { mix } from "./morph";

/**
 * The Connections map.
 *
 * Geometry is the product's own: same constants, same group layout, same
 * angleOf() and link() as components/workspace/ConnectionsMap.tsx, so the ring
 * here is the ring in the app. Group tints follow the reference frames — the
 * Mufaṣṣal band blue, Ṭiwāl rose, Miʾūn tan, Mathānī violet, al-Fātiḥah green.
 *
 * EVERY link draws itself from one endpoint to the other; none simply appears.
 */

const SIZE = 720;
const CX = SIZE / 2, CY = SIZE / 2;
const R_OUT = 322, R_IN = 292, R_HUB = 268;
const GROUP_GAP = 0.028;
const TOTAL = 114;
const TAU = Math.PI * 2;

const GROUPS = [
  { id: "fatiha",   arabic: "الفاتحة", from: 1,  to: 1,   tint: "#cfe3d6" },
  { id: "tiwal",    arabic: "الطوال",  from: 2,  to: 9,   tint: "#e6cfcc" },
  { id: "miun",     arabic: "المئين",  from: 10, to: 35,  tint: "#e6dccb" },
  { id: "mathani",  arabic: "المثاني", from: 36, to: 49,  tint: "#dcd5e8" },
  { id: "mufassal", arabic: "المفصل",  from: 50, to: 114, tint: "#cfdde6" },
];

const layout = (() => {
  const usable = TAU - GROUP_GAP * GROUPS.length;
  let cursor = -Math.PI / 2 + GROUP_GAP / 2;
  return GROUPS.map((g) => {
    const count = g.to - g.from + 1;
    const span = (count / TOTAL) * usable;
    const start = cursor;
    cursor += span + GROUP_GAP;
    return { ...g, count, start, end: start + span };
  });
})();

const groupOf = (s: number) =>
  layout.find((g) => s >= g.from && s <= g.to) ?? layout[layout.length - 1];

function angleOf(surah: number): number {
  const g = groupOf(surah);
  const step = (g.end - g.start) / g.count;
  return g.start + step * (surah - g.from + 0.5);
}

const polar = (a: number, r: number) => ({ x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r });

function wedge(a0: number, a1: number, rIn: number, rOut: number): string {
  const p0 = polar(a0, rOut), p1 = polar(a1, rOut);
  const p2 = polar(a1, rIn),  p3 = polar(a0, rIn);
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A${rOut} ${rOut} 0 ${big} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L${p2.x.toFixed(2)} ${p2.y.toFixed(2)} A${rIn} ${rIn} 0 ${big} 0 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} Z`;
}

/** Chord between two surahs; an in-surah link becomes a loop, never a point. */
function link(a: number, b: number): string {
  if (a === b) {
    const ang = angleOf(a);
    const base = polar(ang, R_HUB);
    const p = polar(ang - 0.018, R_HUB), q = polar(ang + 0.018, R_HUB);
    const cx = CX + (base.x - CX) * (1 - 40 / R_HUB);
    const cy = CY + (base.y - CY) * (1 - 40 / R_HUB);
    return `M${p.x.toFixed(2)} ${p.y.toFixed(2)} C${cx.toFixed(2)} ${cy.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
  }
  const aa = angleOf(a), ab = angleOf(b);
  const p = polar(aa, R_HUB), q = polar(ab, R_HUB);
  let d = Math.abs(aa - ab);
  if (d > Math.PI) d = TAU - d;
  const pull = 0.1 + (d / Math.PI) * 0.82;
  const mx = CX + ((p.x + q.x) / 2 - CX) * (1 - pull);
  const my = CY + ((p.y + q.y) / 2 - CY) * (1 - pull);
  return `M${p.x.toFixed(2)} ${p.y.toFixed(2)} Q${mx.toFixed(2)} ${my.toFixed(2)} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
}

export interface Edge { a: number; b: number }

interface Props {
  /** Frames since this map appeared. */
  t: number;
  edges: Edge[];
  /** Frame each edge begins drawing. */
  starts: number[];
  /** Frames a single link takes to draw. */
  drawFor?: number;
  /** Ring build-in; skip when the ring is already established. */
  build?: boolean;
  /** Fade the ring up at an absolute frame — used when the wheel lives in a
   *  continuous world and is approached rather than cut to. */
  ringIn?: { at: number; over: number };
  /** Chord weight. The default matches the app; a reel that fills the frame
   *  with the ring needs a heavier stroke to read at phone size. */
  linkW?: number;
  linkOpacity?: number;
  /** 0 = light, 1 = dark. Group tints are mixed toward the dark surface rather
   *  than replaced with invented colours, so the bands keep their identity. */
  dark?: number;
}

export const Wheel: React.FC<Props> = ({
  t, edges, starts, drawFor = 26, build = true, ringIn,
  linkW = 1.6, linkOpacity = 0.5, dark = 0,
}) => {
  const ink3 = mix(R.ink3, D.ink3, dark);
  const hair = mix(R.line, D.line, dark);
  const chord = mix(R.accent, D.accent, dark);
  const seg = mix("#ffffff", D.panel2, dark);
  const wheelIn = ringIn
    ? interpolate(t, [ringIn.at, ringIn.at + ringIn.over], [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : build
      ? interpolate(t, [0, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;

  /* A surah lights up only once a link that touches it has finished drawing —
     the ring reacts to the connection, rather than pre-empting it. */
  const lit = new Set<number>();
  edges.forEach((e, i) => {
    if (t >= starts[i] + drawFor * 0.75) { lit.add(e.a); lit.add(e.b); }
  });

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
      <g style={{
        transform: `rotate(${interpolate(wheelIn, [0, 1], [-10, 0])}deg) scale(${interpolate(wheelIn, [0, 1], [0.95, 1])})`,
        transformOrigin: `${CX}px ${CY}px`,
        opacity: wheelIn,
      }}>
        {/* Group bands */}
        {layout.map((g) => {
          const mid = (g.start + g.end) / 2;
          const lp = polar(mid, R_OUT + 30);
          let deg = (mid * 180) / Math.PI;
          if (deg > 90 || deg < -90) deg += 180;
          return (
            <g key={g.id}>
              <path d={wedge(g.start, g.end, R_IN, R_OUT)}
                fill={mix(g.tint, D.bgElev, dark * 0.55)} stroke={hair} strokeWidth={0.75} />
              <text x={lp.x} y={lp.y} fill={ink3} fontSize={17} fontFamily={R.fontArabic}
                textAnchor="middle" transform={`rotate(${deg} ${lp.x} ${lp.y})`}>
                {g.arabic}
              </text>
            </g>
          );
        })}

        {/* Surah segments — arrive around the ring in muṣḥaf order */}
        {Array.from({ length: TOTAL }, (_, i) => i + 1).map((n) => {
          const g = groupOf(n);
          const step = (g.end - g.start) / g.count;
          const a0 = g.start + step * (n - g.from) + step * 0.14;
          const a1 = a0 + step * 0.72;
          const on = ringIn
            ? interpolate(t, [ringIn.at + 12 + n * 0.4, ringIn.at + 12 + n * 0.4 + 14], [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            : build
              ? interpolate(t, [10 + n * 0.13, 10 + n * 0.13 + 12], [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
              : 1;
          const hot = lit.has(n);
          return (
            <path key={n} d={wedge(a0, a1, R_IN + 2.5, R_OUT - 2.5)}
              fill={hot ? chord : seg}
              opacity={on * (hot ? 0.92 : 0.55)}
              style={{ transition: "none" }} />
          );
        })}

        {/* Links — each drawn along its own path */}
        {edges.map((e, i) => {
          const p = interpolate(t, [starts[i], starts[i] + drawFor], [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (p <= 0) return null;
          const LEN = 900;
          return (
            <path key={`${e.a}-${e.b}-${i}`} d={link(e.a, e.b)}
              fill="none" stroke={chord} strokeWidth={linkW} strokeLinecap="round"
              strokeOpacity={linkOpacity}
              strokeDasharray={LEN} strokeDashoffset={LEN * (1 - p)} />
          );
        })}
      </g>
    </svg>
  );
};
