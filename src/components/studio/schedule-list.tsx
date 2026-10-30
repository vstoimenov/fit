import { utcToZoned } from "@/lib/admin/time";
import { cn } from "@/lib/cn";
import { dateTile } from "@/lib/studio/calendar";
import { dayLabel } from "@/lib/studio/format";
import type { StudioSession } from "@/server/studio/schedule";
import { Button } from "@/components/ui/button";

const spotsText = (n: number) => (n === 1 ? "Остава 1 място" : `Остават ${n} места`);

/** The coming trainings grouped by day; the button is hers to wire (book or sign up first). */
export function ScheduleList({
  sessions,
  bookedIds,
  busyId,
  onBook,
}: {
  sessions: StudioSession[];
  bookedIds: string[];
  busyId: string | null;
  onBook: (session: StudioSession) => void;
}) {
  if (sessions.length === 0) {
    return <p className="text-ink-soft">Графикът още не е готов.</p>;
  }
  const days = new Map<string, StudioSession[]>();
  for (const s of sessions) {
    const { date } = utcToZoned(s.startsAt);
    days.set(date, [...(days.get(date) ?? []), s]);
  }
  const booked = new Set(bookedIds);
  return (
    <div className="space-y-8">
      {[...days].map(([date, list]) => (
        <section key={date}>
          <h3 className="mb-3 font-bold">{dayLabel(date)}</h3>
          <ul className="space-y-3">
            {list.map((s) => {
              const mine = booked.has(s.id);
              const full = s.spotsLeft === 0;
              return (
                <li
                  key={s.id}
                  className={cn(
                    "flex items-center justify-between gap-4 rounded-2xl bg-white p-4 ring-1 ring-line",
                    s.cancelled && "opacity-60",
                  )}
                >
                  <div
                    className="flex min-w-0 items-center gap-3"
                    aria-label={`${dayLabel(date)}, ${utcToZoned(s.startsAt).time} · ${s.title}`}
                  >
                    <DateTile date={date} />
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {utcToZoned(s.startsAt).time} · {s.title}
                      </p>
                      <p className={cn("text-sm", full ? "text-brick" : "text-ink-soft")}>
                        {s.cancelled ? "Отменена" : full ? "Няма места" : spotsText(s.spotsLeft)}
                      </p>
                    </div>
                  </div>
                  {mine ? (
                    <span className="shrink-0 text-sm font-semibold text-ink">Записана си ✓</span>
                  ) : s.cancelled ? null : (
                    <Button
                      size="md"
                      className="shrink-0"
                      disabled={full || busyId !== null}
                      onClick={() => onBook(s)}
                    >
                      {busyId === s.id ? "Записвам…" : "Запиши се"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** A small calendar leaf, so every training carries its date even when scrolled past the day heading. */
function DateTile({ date }: { date: string }) {
  const { day, month, weekday } = dateTile(date);
  return (
    <span
      aria-hidden
      className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-powder-light py-1 leading-tight text-rose-deep"
    >
      <span className="text-[10px] font-semibold uppercase">{month}</span>
      <span className="text-lg font-extrabold">{day}</span>
      <span className="text-[10px] font-semibold">{weekday}</span>
    </span>
  );
}
