"use client";

import { CalendarPlus, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { liveState, type LiveState } from "@/lib/live/window";
import type { LiveSession } from "@/server/live/sessions";

/**
 * Начало: the next session with Аксения. „Влизам" is a link through /api/live/[id]/join, which
 * records attendance (points once, inside the window) and sends her on to the room; the door
 * opens 15 minutes early. The start text is formatted on the server in her own timezone.
 */
export function LiveCard({
  session,
  startsText,
  attended,
}: {
  session: LiveSession;
  startsText: string;
  attended: boolean;
}) {
  // Server and client agree on "upcoming" first; the real state arrives after hydration.
  const [state, setState] = useState<LiveState>("upcoming");

  useEffect(() => {
    const tick = () => setState(liveState(session, new Date()));
    const timer = setInterval(tick, 30_000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [session]);

  if (state === "ended") return null;

  return (
    <section aria-label="На живо с Аксения" className="space-y-3 rounded-2xl bg-sand p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <Radio size={18} strokeWidth={2.25} aria-hidden="true" />
        {state === "open" ? "На живо сега" : "Следващо на живо"}
      </p>
      <p className="font-extrabold break-words">{session.title}</p>
      <p className="text-sm text-ink-soft">{startsText}</p>
      {session.description && <p className="text-sm text-ink-soft">{session.description}</p>}
      <div className="flex flex-wrap gap-2">
        {state === "open" ? (
          <a
            href={`/api/live/${session.id}/join`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonClass("primary", "md"), "flex-1")}
          >
            {attended ? "Влез пак" : "Влизам"}
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
      {attended && state === "open" && (
        <p className="text-sm font-semibold text-moss" role="status">
          Вече си отбелязана за тази сесия
        </p>
      )}
    </section>
  );
}
