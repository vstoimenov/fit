"use client";

import { CalendarPlus, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { attendLiveAction } from "@/app/app/live-actions";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { liveState, type LiveState } from "@/lib/live/window";
import type { LiveSession } from "@/server/live/sessions";

function startsText(startsAt: string): string {
  return new Date(startsAt).toLocaleString("bg-BG", {
    timeZone: "Europe/Sofia",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Начало: the next session with Аксения. „Влизам" is a real link to the room (new tab) and also
 * records attendance for the points; the door opens 15 minutes early.
 */
export function LiveCard({ session, attended }: { session: LiveSession; attended: boolean }) {
  // Server and client agree on "upcoming" first; the real state arrives after hydration.
  const [state, setState] = useState<LiveState>("upcoming");
  const [joined, setJoined] = useState(attended);
  const [error, setError] = useState("");
  const busy = useRef(false);

  useEffect(() => {
    const tick = () => setState(liveState(session, new Date()));
    const timer = setInterval(tick, 30_000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [session]);

  function onJoin() {
    if (busy.current || joined) return;
    busy.current = true;
    setError("");
    attendLiveAction(session.id)
      .then((result) => {
        if (result.ok) setJoined(true);
        else setError(result.message);
      })
      .catch(() => setError("Не успяхме да отбележим влизането."))
      .finally(() => {
        busy.current = false;
      });
  }

  if (state === "ended") return null;

  return (
    <section aria-label="На живо с Аксения" className="space-y-3 rounded-2xl bg-sand p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <Radio size={18} strokeWidth={2.25} aria-hidden="true" />
        {state === "open" ? "На живо сега" : "Следващо на живо"}
      </p>
      <p className="font-extrabold break-words">{session.title}</p>
      <p className="text-sm text-ink-soft capitalize-first">{startsText(session.startsAt)}</p>
      {session.description && <p className="text-sm text-ink-soft">{session.description}</p>}
      <div className="flex flex-wrap gap-2">
        {state === "open" ? (
          <a
            href={session.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onJoin}
            className={cn(buttonClass("primary", "md"), "flex-1")}
          >
            {joined ? "Влез пак" : "Влизам"}
          </a>
        ) : (
          <a
            href={`/api/live/${session.id}/calendar.ics`}
            download
            className={cn(buttonClass("secondary", "md"), "flex-1 gap-2")}
          >
            <CalendarPlus size={18} strokeWidth={2.25} aria-hidden="true" />
            Добави в календара
          </a>
        )}
      </div>
      {joined && state === "open" && (
        <p className="text-sm font-semibold text-moss" role="status">
          Отбелязахме те · +5 точки
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-brick">
          {error}
        </p>
      )}
    </section>
  );
}
