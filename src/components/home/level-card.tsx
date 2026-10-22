import { Chip } from "@/components/ui/chip";
import { Card } from "@/components/ui/card";
import { levelChipText, nextStepText } from "@/lib/points/copy";
import type { LevelProgress } from "@/lib/points/levels";

/** Level chip, a powder bar to the next level and what is left (with the next reward). */
export function LevelCard({ progress }: { progress: LevelProgress }) {
  return (
    <Card className="space-y-3 p-4">
      <Chip tone="powder">{levelChipText(progress)}</Chip>
      <div
        role="progressbar"
        aria-label={`Напредък към ниво ${progress.nextLevel ?? progress.level}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-2 overflow-hidden rounded-full bg-white"
      >
        <div className="h-full rounded-full bg-powder" style={{ width: `${progress.percent}%` }} />
      </div>
      <p className="text-sm font-semibold text-ink-soft">{nextStepText(progress)}</p>
    </Card>
  );
}
