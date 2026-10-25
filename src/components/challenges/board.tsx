import { Fragment } from "react";
import { Chip } from "@/components/ui/chip";
import { dayCount } from "@/lib/challenges/format";
import { cn } from "@/lib/cn";
import type { BoardRow } from "@/server/challenges/challenges";

/**
 * The leaderboard: the top ten and, when she is further down, her own row after a gap. Names arrive
 * already shortened by the database („Мария П.“); nothing more about anyone is shown.
 */
export function Board({ rows }: { rows: BoardRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-2xl bg-sand p-4 text-ink-soft">Класацията е още празна.</p>;
  }
  return (
    <ol className="space-y-1">
      {rows.map((row, i) => (
        <Fragment key={`${row.rank}-${i}`}>
          {i > 0 && row.rank - rows[i - 1].rank > 1 && (
            <li aria-hidden="true" className="px-3 text-ink-soft">
              …
            </li>
          )}
          <li
            aria-current={row.isMe ? "true" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2",
              row.isMe ? "bg-powder-chip" : "bg-sand",
            )}
          >
            <span className="w-7 shrink-0 text-center font-extrabold">{row.rank}</span>
            <span className="min-w-0 flex-1 break-words font-semibold">{row.name}</span>
            {row.isMe && <Chip tone="ink">Ти</Chip>}
            <span className="shrink-0 text-sm font-semibold text-ink-soft">
              {dayCount(row.ticked)}
            </span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
