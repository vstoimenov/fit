import { cn } from "@/lib/cn";
import type { Level, WorkoutKind } from "@/lib/program/types";

const TONE: Record<Level | "intro", string> = {
  intro: "bg-ember",
  beginner: "bg-moss",
  advanced: "bg-mustard",
  pro: "bg-brick",
};

/**
 * A typographic cover built from the title. Provider thumbnails are not used:
 * their URLs carry the video ID (see thumbnail_url CHECK in the content migration).
 */
export function WorkoutCover({
  level,
  kind,
  title,
  className,
}: {
  level: Level | null;
  kind: WorkoutKind;
  title: string;
  className?: string;
}) {
  const tone = TONE[kind === "regular" && level ? level : "intro"];
  const word = title.split(/\s+/)[0] ?? title;
  return (
    <div className={cn("relative overflow-hidden", tone, className)} aria-hidden>
      <span className="absolute -bottom-6 -left-2 select-none font-display text-[7rem] font-black uppercase leading-none text-white/15">
        {word}
      </span>
      <span className="absolute right-4 top-4 h-10 w-10 rounded-full border-4 border-white/30" />
    </div>
  );
}
