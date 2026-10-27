"use client";

import { Heart } from "lucide-react";
import { useRef, useState } from "react";
import { toggleHeartAction } from "@/app/app/community/actions";
import { cn } from "@/lib/cn";

/** Optimistic heart with the count; the server state wins if the toggle fails. */
export function HeartButton({
  postId,
  hearts,
  hearted,
}: {
  postId: string;
  hearts: number;
  hearted: boolean;
}) {
  const [state, setState] = useState({ hearts, hearted });
  const busy = useRef(false);

  async function toggle() {
    if (busy.current) return;
    busy.current = true;
    const previous = state;
    const next = previous.hearted
      ? { hearts: Math.max(0, previous.hearts - 1), hearted: false }
      : { hearts: previous.hearts + 1, hearted: true };
    setState(next);
    try {
      const result = await toggleHeartAction(postId);
      // The server's count wins: another tab or member may have changed it meanwhile.
      setState(result.ok ? result.data : previous);
    } catch {
      setState(previous);
    } finally {
      busy.current = false;
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={state.hearted}
      aria-label={`Сърце · ${state.hearts}`}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        state.hearted ? "text-rose-deep" : "text-ink-soft",
      )}
    >
      <Heart
        size={20}
        strokeWidth={2.25}
        aria-hidden="true"
        className={state.hearted ? "fill-powder text-rose-deep" : undefined}
      />
      <span className="tabular-nums">{state.hearts}</span>
    </button>
  );
}
