"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { setAttendedAction } from "@/app/admin/(panel)/zala/actions";
import { cn } from "@/lib/cn";

/** One big tap target: „Дошла ✓“ on, tap again off. Shows the new state at once. */
export function AttendanceToggle({
  bookingId,
  attended,
}: {
  bookingId: string;
  attended: boolean;
}) {
  const [pending, start] = useTransition();
  const [on, setOn] = useOptimistic(attended);
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOn(!on);
          const res = await setAttendedAction(bookingId, !on);
          if (!res.ok) alert(res.message);
        })
      }
      className={cn(
        "flex h-12 min-w-28 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        on ? "bg-moss text-white" : "bg-white text-ink ring-[1.5px] ring-inset ring-ink",
      )}
    >
      {on && <Check className="h-4 w-4" aria-hidden />}
      {on ? "Дошла" : "Дошла?"}
    </button>
  );
}
