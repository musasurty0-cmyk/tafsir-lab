"use client";

/**
 * The whole Qurʾān as a map of Connections.
 *
 * Every Surah sits at a fixed point on a ring in Qurʾānic order, and each
 * Connection is drawn as a chord between the two Surahs it joins.
 *
 * The fixed layout is the whole idea. A force-directed graph rearranges itself
 * every time it loads, so the same relationship never looks the same twice and
 * nothing can be found by memory. Here Al-Fātiḥah is always at the top and
 * An-Nās always beside it, so the map becomes a place you learn rather than a
 * picture you re-read. It is also inherently bounded: 114 nodes however many
 * Connections exist.
 *
 * Chords bow toward the centre, so a link between distant Surahs cuts across
 * the ring and a link between neighbours hugs the rim — the shape of the line
 * carries the distance.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface MapNode { surah: number; count: number }
export interface MapEdge { a: number; b: number; weight: number; ids: string[]; names: string[] }

interface Props {
  nodes: MapNode[];
  edges: MapEdge[];
  total: number;
  surahName: (n: number) => string;
  /** Focus one Surah — dims everything not touching it. */
  focus: number | null;
  onFocus: (surah: number | null) => void;
}

const SIZE   = 720;
const CX     = SIZE / 2;
const CY     = SIZE / 2;
const RADIUS = SIZE / 2 - 54;
const TOTAL_SURAHS = 114;

/** Surah n at its fixed angle. Starts at the top and runs clockwise, so the
 *  order matches how the muṣḥaf is read rather than how SVG measures angles. */
function pointFor(surah: number): { x: number; y: number; angle: number } {
  const t = (surah - 1) / TOTAL_SURAHS;
  const angle = t * Math.PI * 2 - Math.PI / 2;
  return { x: CX + Math.cos(angle) * RADIUS, y: CY + Math.sin(angle) * RADIUS, angle };
}

/** A quadratic chord pulled toward the centre in proportion to how far apart
 *  the two Surahs are around the ring. */
function chord(a: number, b: number): string {
  const p = pointFor(a), q = pointFor(b);
  const sep = Math.min(Math.abs(a - b), TOTAL_SURAHS - Math.abs(a - b)) / (TOTAL_SURAHS / 2);
  // Near neighbours barely bow; opposites pass close to the middle.
  const pull = 0.12 + sep * 0.78;
  const mx = CX + ((p.x + q.x) / 2 - CX) * (1 - pull);
  const my = CY + ((p.y + q.y) / 2 - CY) * (1 - pull);
  return `M${p.x.toFixed(1)} ${p.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
}

export default function ConnectionsMap({
  nodes, edges, total, surahName, focus, onFocus,
}: Props) {
  const [hover, setHover] = useState<MapEdge | null>(null);
  const [tip, setTip]     = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const byNode = useMemo(() => {
    const m = new Map<number, number>();
    for (const n of nodes) m.set(n.surah, n.count);
    return m;
  }, [nodes]);

  const maxCount = useMemo(
    () => nodes.reduce((m, n) => Math.max(m, n.count), 1), [nodes],
  );

  const touches = useCallback(
    (e: MapEdge) => focus == null || e.a === focus || e.b === focus,
    [focus],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focus != null) { e.stopPropagation(); onFocus(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, onFocus]);

  if (total === 0) {
    return (
      <div className="cxmap-empty">
        No Connections to map yet. Use <code>/link</code> in a note to relate two passages.
      </div>
    );
  }

  return (
    <div className="cxmap" ref={wrapRef}>
      <div className="cxmap-bar">
        <span className="cxmap-stat">{total} Connection{total === 1 ? "" : "s"}</span>
        <span className="cxmap-stat">{nodes.length} Surah{nodes.length === 1 ? "" : "s"}</span>
        {focus != null && (
          <button className="cxmap-clear" onClick={() => onFocus(null)}>
            Showing {surahName(focus)} — show all
          </button>
        )}
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="cxmap-svg"
        role="img"
        aria-label={`Connection map: ${total} Connections across ${nodes.length} Surahs`}
      >
        {/* The ring itself — a quiet reference line, not a feature. */}
        <circle cx={CX} cy={CY} r={RADIUS} className="cxmap-ring" />

        {/* Chords under the nodes, so a node is never obscured by its own links. */}
        <g>
          {edges.map((e) => (
            <path
              key={`${e.a}-${e.b}`}
              d={chord(e.a, e.b)}
              className="cxmap-edge"
              data-dim={touches(e) ? "false" : "true"}
              data-hot={hover && hover.a === e.a && hover.b === e.b ? "true" : "false"}
              style={{ strokeWidth: Math.min(1 + e.weight * 0.7, 4) }}
              onPointerEnter={(ev) => {
                setHover(e);
                const r = wrapRef.current?.getBoundingClientRect();
                if (r) setTip({ x: ev.clientX - r.left, y: ev.clientY - r.top });
              }}
              onPointerLeave={() => { setHover(null); setTip(null); }}
            />
          ))}
        </g>

        {/* One dot per Surah that actually has a Connection. Surahs with none
            are left out rather than drawn faint — 114 empty dots would be
            noise, and their absence is itself information. */}
        <g>
          {nodes.map((n) => {
            const p = pointFor(n.surah);
            const active = focus == null || focus === n.surah;
            const r = 3 + (n.count / maxCount) * 5;
            // Labels lean outward, flipping on the left half so none are upside down.
            const deg = (p.angle * 180) / Math.PI;
            const flip = deg > 90 || deg < -90;
            const lx = CX + Math.cos(p.angle) * (RADIUS + 14);
            const ly = CY + Math.sin(p.angle) * (RADIUS + 14);
            return (
              <g key={n.surah} data-dim={active ? "false" : "true"} className="cxmap-node">
                <circle
                  cx={p.x} cy={p.y} r={r}
                  className="cxmap-dot"
                  data-focused={focus === n.surah ? "true" : "false"}
                  onClick={() => onFocus(focus === n.surah ? null : n.surah)}
                >
                  <title>{surahName(n.surah)} — {n.count} Connection{n.count === 1 ? "" : "s"}</title>
                </circle>
                <text
                  x={lx} y={ly}
                  className="cxmap-label"
                  textAnchor={flip ? "end" : "start"}
                  transform={`rotate(${flip ? deg + 180 : deg} ${lx} ${ly})`}
                  onClick={() => onFocus(focus === n.surah ? null : n.surah)}
                >
                  {n.surah}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hover && tip && (
        <div className="cxmap-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="cxmap-tip-pair">
            {surahName(hover.a)} ↔ {surahName(hover.b)}
          </div>
          {hover.names.map((n, i) => <div key={i} className="cxmap-tip-name">{n}</div>)}
          {hover.weight > hover.names.length && (
            <div className="cxmap-tip-more">+{hover.weight - hover.names.length} more</div>
          )}
        </div>
      )}
    </div>
  );
}
