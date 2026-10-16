/** Minimal SVG line for a handful of points (oldest → newest). */
export function Sparkline({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2)
    return <p className="text-sm text-ink-soft">Добави още едно измерване, за да видиш графика.</p>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * 100},${36 - ((p - min) / span) * 32}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 40"
      className="h-20 w-full"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
