"use client";

/**
 * The whole Qurʾān as a map of Connections.
 *
 * Surahs are laid out as segments inside the four traditional groups — Ṭiwāl,
 * Miʾūn, Mathānī, Mufaṣṣal — arranged as arcs around a ring, and each
 * Connection is drawn as a curve between the two segments it joins.
 *
 * The grouping is what makes the map legible. A bare ring of 114 dots gives
 * the eye nothing to hold on to; the classical divisions are already how a
 * reader carries the muṣḥaf in their head, so an arc gives every link a
 * neighbourhood before it gives it a number. The layout is fixed, so the same
 * relationship always appears in the same place and the map becomes something
 * learned rather than re-read.
 *
 * Curves bow toward the centre in proportion to how far apart their endpoints
 * sit, so the shape of a link carries its reach: neighbours hug the rim,
 * distant pairs cut across the middle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface MapNode { surah: number; count: number }
export interface MapEdge { a: number; b: number; weight: number; ids: string[]; names: string[] }
export interface ChapterInfo {
  id: number; name: string; arabic?: string; verses?: number; place?: string;
}

interface Props {
  nodes: MapNode[];
  edges: MapEdge[];
  total: number;
  surahName: (n: number) => string;
  chapters: ChapterInfo[];
  focus: number | null;
  onFocus: (surah: number | null) => void;
}

/**
 * The classical four-part division of the muṣḥaf, after al-Fātiḥah. Boundaries
 * differ slightly between authorities; this follows the common division where
 * the Mufaṣṣal begins at Qāf. It is a reading aid here, not a claim.
 */
const GROUPS = [
  { id: "fatiha",   label: "Al-Fātiḥah", arabic: "الفاتحة", from: 1,  to: 1   },
  { id: "tiwal",    label: "Ṭiwāl",      arabic: "الطوال",  from: 2,  to: 9   },
  { id: "miun",     label: "Miʾūn",      arabic: "المئين",  from: 10, to: 35  },
  { id: "mathani",  label: "Mathānī",    arabic: "المثاني", from: 36, to: 49  },
  { id: "mufassal", label: "Mufaṣṣal",   arabic: "المفصل",  from: 50, to: 114 },
] as const;

const SIZE = 760;
const CX = SIZE / 2, CY = SIZE / 2;
const R_OUT = 322;          // outer edge of the group arcs
const R_IN  = 292;          // inner edge — the band the segments live in
const R_HUB = 268;          // where link curves attach, just inside the band
const GROUP_GAP = 0.028;    // radians of breathing room between groups

const TOTAL = 114;
const TAU = Math.PI * 2;

/** Angular span of each group, proportional to how many surahs it holds. */
const layout = (() => {
  const usable = TAU - GROUP_GAP * GROUPS.length;
  let cursor = -Math.PI / 2 + GROUP_GAP / 2;   // start at the top
  return GROUPS.map((g) => {
    const count = g.to - g.from + 1;
    const span = (count / TOTAL) * usable;
    const start = cursor;
    cursor += span + GROUP_GAP;
    return { ...g, count, start, end: start + span };
  });
})();

const groupOf = (surah: number) =>
  layout.find((g) => surah >= g.from && surah <= g.to) ?? layout[layout.length - 1];

/** Mid-angle of one surah's segment within its group. */
function angleOf(surah: number): number {
  const g = groupOf(surah);
  const i = surah - g.from;
  const step = (g.end - g.start) / g.count;
  return g.start + step * (i + 0.5);
}

const polar = (a: number, r: number) => ({ x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r });

/** An annular wedge — used for both group arcs and individual segments. */
function wedge(a0: number, a1: number, rIn: number, rOut: number): string {
  const p0 = polar(a0, rOut), p1 = polar(a1, rOut);
  const p2 = polar(a1, rIn),  p3 = polar(a0, rIn);
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)}`,
    `A${rOut} ${rOut} 0 ${big} 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`,
    `L${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
    `A${rIn} ${rIn} 0 ${big} 0 ${p3.x.toFixed(1)} ${p3.y.toFixed(1)}`,
    "Z",
  ].join(" ");
}

/**
 * Link curve between two surahs, bowing toward the centre with distance.
 *
 * A munāsabah can join two passages of the SAME surah, and those arrive here
 * as a === b. The general form then degenerates — a quadratic from a point to
 * itself — so the connection existed in the data and drew nothing. An in-surah
 * link gets its own small loop hanging inside the band at that surah's angle,
 * which reads as "this one turns back on itself".
 */
function selfLoop(a: number): string {
  const ang = angleOf(a);
  const base = polar(ang, R_HUB);
  // Two feet a little either side of the segment, and a control point pulled
  // inward, so the loop sits under the arc rather than crossing it.
  const spread = 0.016;
  const p = polar(ang - spread, R_HUB);
  const q = polar(ang + spread, R_HUB);
  const depth = 34;
  const cx = CX + (base.x - CX) * (1 - depth / R_HUB);
  const cy = CY + (base.y - CY) * (1 - depth / R_HUB);
  return [
    `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
    `C${cx.toFixed(1)} ${cy.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`,
  ].join(" ");
}

function link(a: number, b: number): string {
  if (a === b) return selfLoop(a);
  const aa = angleOf(a), ab = angleOf(b);
  const p = polar(aa, R_HUB), q = polar(ab, R_HUB);
  let d = Math.abs(aa - ab);
  if (d > Math.PI) d = TAU - d;
  const sep = d / Math.PI;                 // 0 = same place, 1 = opposite
  const pull = 0.1 + sep * 0.82;
  const mx = CX + ((p.x + q.x) / 2 - CX) * (1 - pull);
  const my = CY + ((p.y + q.y) / 2 - CY) * (1 - pull);
  return `M${p.x.toFixed(1)} ${p.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
}

export default function ConnectionsMap({
  nodes, edges, total, surahName, chapters, focus, onFocus,
}: Props) {
  const [hoverEdge, setHoverEdge] = useState<MapEdge | null>(null);
  const [hoverSurah, setHoverSurah] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const info = useMemo(() => {
    const m = new Map<number, ChapterInfo>();
    for (const c of chapters) m.set(c.id, c);
    return m;
  }, [chapters]);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const n of nodes) m.set(n.surah, n.count);
    return m;
  }, [nodes]);

  const maxCount = useMemo(
    () => nodes.reduce((m, n) => Math.max(m, n.count), 1), [nodes],
  );

  /** Surahs directly linked to the hovered or focused one. */
  const related = useMemo(() => {
    const anchor = hoverSurah ?? focus;
    if (anchor == null) return null;
    const s = new Set<number>([anchor]);
    for (const e of edges) {
      if (e.a === anchor) s.add(e.b);
      if (e.b === anchor) s.add(e.a);
    }
    return s;
  }, [hoverSurah, focus, edges]);

  const edgeLive = useCallback((e: MapEdge) => {
    const anchor = hoverSurah ?? focus;
    return anchor == null || e.a === anchor || e.b === anchor;
  }, [hoverSurah, focus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focus != null) { e.stopPropagation(); onFocus(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, onFocus]);

  const moveTip = useCallback((ev: React.PointerEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setTip({ x: ev.clientX - r.left, y: ev.clientY - r.top });
  }, []);

  if (total === 0) {
    return (
      <div className="cxmap-empty">
        No Connections to map yet. Use <code>/link</code> in a note to relate two passages.
      </div>
    );
  }

  const hovered = hoverSurah != null ? info.get(hoverSurah) : null;

  return (
    <div className="cxmap" ref={wrapRef}>
      <div className="cxmap-bar">
        <span className="cxmap-stat">{total} Connection{total === 1 ? "" : "s"}</span>
        <span className="cxmap-stat">{nodes.length} Surah{nodes.length === 1 ? "" : "s"}</span>
        {focus != null && (() => {
          /* Split what the focused Surah is joined to: links that leave it,
             and links that stay INSIDE it. In-surah munāsabāt were invisible
             before — they drew nothing and were never counted separately —
             so a Surah whose only Connections were internal looked empty. */
          const within  = edges.find((e) => e.a === focus && e.b === focus);
          const outward = edges.filter((e) => (e.a === focus || e.b === focus) && e.a !== e.b);
          const outCount = outward.reduce((n, e) => n + e.weight, 0);
          return (
            <>
              <span className="cxmap-focus">
                {surahName(focus)}
                <span className="cxmap-focus-detail">
                  {outCount > 0 && `${outCount} to other Surahs`}
                  {outCount > 0 && within && " · "}
                  {within && `${within.weight} within`}
                  {outCount === 0 && !within && "no Connections"}
                </span>
              </span>
              <button className="cxmap-clear" onClick={() => onFocus(null)}>
                Show all
              </button>
            </>
          );
        })()}
      </div>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="cxmap-svg" role="img"
        aria-label={`Connection map: ${total} Connections across ${nodes.length} Surahs`}>

        {/* ── Group arcs ── */}
        <g>
          {layout.map((g) => {
            const mid = (g.start + g.end) / 2;
            const lp = polar(mid, R_OUT + 22);
            let deg = (mid * 180) / Math.PI;
            const flip = deg > 90 || deg < -90;
            if (flip) deg += 180;
            return (
              <g key={g.id} className="cxmap-group" data-group={g.id}>
                <path d={wedge(g.start, g.end, R_IN, R_OUT)} className="cxmap-group-arc" />
                <text
                  x={lp.x} y={lp.y}
                  className="cxmap-group-label"
                  textAnchor="middle"
                  transform={`rotate(${deg} ${lp.x} ${lp.y})`}
                >
                  {g.arabic}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Per-surah segments. Every surah is drawn, so the muṣḥaf is whole;
               the ones carrying Connections are simply brighter. ── */}
        <g>
          {Array.from({ length: TOTAL }, (_, i) => i + 1).map((n) => {
            const g = groupOf(n);
            const step = (g.end - g.start) / g.count;
            const a0 = g.start + step * (n - g.from) + step * 0.12;
            const a1 = a0 + step * 0.76;
            const c = counts.get(n) ?? 0;
            const dim = related != null && !related.has(n);
            return (
              <path
                key={n}
                d={wedge(a0, a1, R_IN + 2, R_OUT - 2)}
                className="cxmap-seg"
                data-linked={c > 0 ? "true" : "false"}
                data-focused={focus === n ? "true" : "false"}
                data-dim={dim ? "true" : "false"}
                style={c > 0 ? { opacity: 0.45 + (c / maxCount) * 0.55 } : undefined}
                onPointerEnter={(e) => { setHoverSurah(n); moveTip(e); }}
                onPointerMove={moveTip}
                onPointerLeave={() => { setHoverSurah(null); setTip(null); }}
                onClick={() => c > 0 && onFocus(focus === n ? null : n)}
              />
            );
          })}
        </g>

        {/* ── Links, inside the ring so they never cross the segments ── */}
        <g>
          {edges.map((e) => (
            <path
              key={`${e.a}-${e.b}`}
              d={link(e.a, e.b)}
              className="cxmap-edge"
              data-self={e.a === e.b ? "true" : "false"}
              data-dim={edgeLive(e) ? "false" : "true"}
              data-hot={hoverEdge === e ? "true" : "false"}
              style={{ strokeWidth: Math.min(1 + e.weight * 0.8, 4.5) }}
              onPointerEnter={(ev) => { setHoverEdge(e); moveTip(ev); }}
              onPointerMove={moveTip}
              onPointerLeave={() => { setHoverEdge(null); setTip(null); }}
            />
          ))}
        </g>
      </svg>

      {/* ── Hover detail ── */}
      {tip && (hovered || hoverEdge) && (
        <div className="cxmap-tip" style={{ left: tip.x, top: tip.y }}>
          {hovered && (
            <>
              {hovered.arabic && <div className="cxmap-tip-ar" dir="rtl">{hovered.arabic}</div>}
              <div className="cxmap-tip-name">{hovered.name}</div>
              <div className="cxmap-tip-meta">
                {hovered.place === "makkah" ? "Makkī" : hovered.place === "madinah" ? "Madanī" : ""}
                {hovered.verses ? ` · ${hovered.verses} verses` : ""}
                {counts.get(hovered.id)
                  ? ` · ${counts.get(hovered.id)} Connection${counts.get(hovered.id) === 1 ? "" : "s"}`
                  : " · no Connections"}
              </div>
            </>
          )}
          {hoverEdge && !hovered && (
            <>
              <div className="cxmap-tip-meta">
                {surahName(hoverEdge.a)} ↔ {surahName(hoverEdge.b)}
              </div>
              {hoverEdge.names.map((n, i) => (
                <div key={i} className="cxmap-tip-name">{n}</div>
              ))}
              {hoverEdge.weight > hoverEdge.names.length && (
                <div className="cxmap-tip-meta">
                  +{hoverEdge.weight - hoverEdge.names.length} more
                </div>
              )}
            </>
          )}
        </div>
      )}

      <p className="cxmap-hint">
        Hover a surah to reveal what it links to · click to focus · a loop means the Connection stays inside that Surah
      </p>
    </div>
  );
}
