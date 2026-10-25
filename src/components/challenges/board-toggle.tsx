"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setBoardVisibilityAction } from "@/app/app/challenges/actions";
import { boardNote } from "@/lib/challenges/format";
import { cn } from "@/lib/cn";

/** „Покажи ме в класацията“: a switch, on by default; off shows her as „Участничка“ to the others. */
export function BoardToggle({ challengeId, show }: { challengeId: string; show: boolean }) {
  const [shown, setShown] = useOptimistic(show, (_current, next: boolean) => next);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function toggle() {
    if (pending) return;
    const next = !shown;
    setError("");
    startTransition(async () => {
      setShown(next);
      try {
        const result = await setBoardVisibilityAction({ id: challengeId, show: next });
        if (!result.ok) setError(result.message);
      } catch {
        setError("Нещо се обърка. Опитай отново.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        aria-describedby={`board-note-${challengeId}`}
        disabled={pending}
        onClick={toggle}
        className="flex min-h-11 w-full items-center justify-between gap-4 rounded-2xl py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
      >
        <span className="font-semibold">Покажи ме в класацията</span>
        <span
          aria-hidden="true"
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            shown ? "bg-ink" : "bg-line",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-6 rounded-full bg-white transition-[left]",
              shown ? "left-[1.375rem]" : "left-0.5",
            )}
          />
        </span>
      </button>
      <p id={`board-note-${challengeId}`} className="text-sm text-ink-soft">
        {boardNote(shown)}
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-brick">
          {error}
        </p>
      )}
    </div>
  );
}
