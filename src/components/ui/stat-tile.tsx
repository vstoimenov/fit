import { cn } from "@/lib/cn";
import { Card } from "./card";

export function StatTile({
  label,
  value,
  progress,
  className,
}: {
  label: string;
  value: string;
  /** 0..1 — renders a thin powder bar when provided. */
  progress?: number;
  className?: string;
}) {
  const pct = progress === undefined ? null : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <Card className={cn("space-y-1", className)}>
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="text-2xl font-extrabold tracking-tight text-ink">{value}</p>
      {pct !== null ? (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"
        >
          <div className="h-full rounded-full bg-powder" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </Card>
  );
}
