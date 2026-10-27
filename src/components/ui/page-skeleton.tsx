import { cn } from "@/lib/cn";

/**
 * What a page shows while its data streams in: the frame of a title line and a few cards in the
 * page's own rhythm, so a tap on a tab feels instant instead of showing a blank screen. Pulses
 * unless the member prefers reduced motion.
 */
export function PageSkeleton({ cards = 3, className }: { cards?: number; className?: string }) {
  const pulse = "animate-pulse motion-reduce:animate-none";
  return (
    <main
      aria-busy="true"
      aria-label="Зарежда се"
      className={cn("min-h-dvh space-y-5 px-5 pb-6 pt-8 lg:px-8", className)}
    >
      <div className={cn("h-9 w-44 rounded-lg bg-line", pulse)} />
      <div className={cn("h-4 w-64 max-w-full rounded bg-line", pulse)} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} data-skeleton-card className={cn("h-36 rounded-2xl bg-sand", pulse)} />
        ))}
      </div>
    </main>
  );
}
