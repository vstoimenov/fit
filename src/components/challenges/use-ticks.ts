"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { toggleTickAction } from "@/app/app/challenges/actions";
import { POINTS_TOAST } from "@/lib/challenges/format";

const TOAST_MS = 3000;

/**
 * Ticking days of one challenge with an optimistic check: the state flips at once and rolls back by
 * itself when the action fails (the message is kept). `toast` is „+5 точки“ for a few seconds, only when
 * the server says this tick earned points (a re-tick, or a day ticked elsewhere, earns nothing). One call
 * at a time: the buttons are disabled while `pending`.
 */
export function useTicks(challengeId: string, serverDone: Record<number, boolean>) {
  const [done, setDone] = useOptimistic(
    serverDone,
    (state, next: { day: number; done: boolean }) => ({ ...state, [next.day]: next.done }),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function toggle(day: number) {
    if (pending) return;
    const next = !done[day];
    setError("");
    setToast("");
    clearTimeout(timer.current);
    startTransition(async () => {
      setDone({ day, done: next });
      let points = false;
      try {
        const result = await toggleTickAction({ id: challengeId, day, done: next });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        points = result.data.points;
      } catch {
        setError("Нещо се обърка. Опитай отново.");
        return;
      }
      if (!points) return;
      setToast(POINTS_TOAST);
      timer.current = setTimeout(() => setToast(""), TOAST_MS);
    });
  }

  return { done, pending, error, toast, toggle };
}
