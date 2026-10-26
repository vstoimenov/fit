import { Play } from "lucide-react";
import type { LiveSession } from "@/server/live/sessions";

function dateText(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString("bg-BG", {
    timeZone: "Europe/Sofia",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** A past live session with its recording (opens the recording where it is hosted). */
export function RecordingCard({ session }: { session: LiveSession }) {
  return (
    <a
      href={session.recordingUrl ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-14 items-center gap-3 rounded-2xl bg-sand p-4 active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
        <Play size={18} strokeWidth={2.5} aria-hidden="true" className="ml-0.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold break-words">{session.title}</span>
        <span className="block text-sm text-ink-soft">
          {dateText(session.startsAt)} · {session.durationMin} мин
        </span>
      </span>
    </a>
  );
}
