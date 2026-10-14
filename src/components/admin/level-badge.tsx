import { cn } from "@/lib/cn";
import { LEVEL_LABEL } from "@/lib/labels";
import type { Level } from "@/lib/program/types";

const TONE: Record<Level, string> = {
  beginner: "bg-moss",
  advanced: "bg-mustard",
  pro: "bg-brick",
};

export function LevelBadge({ level }: { level: Level | null }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-bold text-white",
        level ? TONE[level] : "bg-ember",
      )}
    >
      {level ? LEVEL_LABEL[level] : "Всички"}
    </span>
  );
}
