import { cn } from "@/lib/cn";
import type { WorkoutStatus } from "@/lib/admin/calendar";

const LABEL: Record<WorkoutStatus, string> = {
  draft: "Чернова",
  scheduled: "Планирана",
  published: "Публикувана",
};
const TONE: Record<WorkoutStatus, string> = {
  draft: "bg-ink/10 text-ink",
  scheduled: "bg-mustard/20 text-ink",
  published: "bg-moss/20 text-moss",
};

export function StatusBadge({ status }: { status: WorkoutStatus }) {
  return (
    <span
      className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", TONE[status])}
    >
      {LABEL[status]}
    </span>
  );
}
