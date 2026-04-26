"use client";

/**
 * ProgressRing — SVG circular progress indicator.
 *
 * Used on surah cards to show group study completion.
 * studiedCount / totalCount drives the arc fill.
 */

interface Props {
  studiedCount: number;
  totalCount: number;
  size?: number;   // px; default 32
  stroke?: number; // stroke width; default 2.5
}

export default function ProgressRing({
  studiedCount,
  totalCount,
  size = 32,
  stroke = 2.5,
}: Props) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = totalCount > 0 ? Math.max(0, Math.min(1, studiedCount / totalCount)) : 0;
  const dash = pct * circ;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="progress-ring"
      aria-hidden="true"
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth={stroke}
      />
      {/* Fill */}
      {pct > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          // Start at 12 o'clock
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {/* Center count */}
      <text
        x={size / 2}
        y={size / 2 + 3.5}
        textAnchor="middle"
        fontSize={size * 0.28}
        fontFamily="var(--font-mono)"
        fill={pct > 0 ? "var(--accent-ink)" : "var(--ink-4)"}
      >
        {studiedCount}
      </text>
    </svg>
  );
}
