"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { completeWorkout, rateWorkout } from "@/app/app/workout/[id]/actions";
import { Button } from "@/components/ui/button";
import { FEELING_LABEL } from "@/lib/labels";
import type { WorkoutSummary } from "@/server/content/today";

type Phase = "watching" | "rating" | "done";

/**
 * „Завърших" unlocks after `unlockAfterSec` of visible playback time (70% of the
 * workout length). Time only counts while the tab is visible.
 */
export function Player({
  workout,
  embedUrl,
  first,
  unlockAfterSec,
}: {
  workout: WorkoutSummary;
  embedUrl: string;
  first: boolean;
  unlockAfterSec: number;
}) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>("watching");
  const [completionId, setCompletionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const unlocked = elapsed >= unlockAfterSec;
  const remainingMin = Math.max(1, Math.ceil((unlockAfterSec - elapsed) / 60));

  async function finish() {
    setError("");
    const result = await completeWorkout(workout.id);
    if (!result.ok) return setError(result.message);
    setCompletionId(result.data.completionId);
    setPhase("rating");
    confetti({
      particleCount: 140,
      spread: 80,
      origin: { y: 0.7 },
      colors: ["#e4572e", "#161412", "#d29a1e", "#f4efe8"],
    });
  }

  async function rate(feeling: keyof typeof FEELING_LABEL) {
    if (completionId) await rateWorkout(completionId, feeling);
    if (first) return router.push("/app/plan?after=first");
    setPhase("done");
  }

  // -mb-28 cancels the app layout's bottom-nav padding so no light strip shows under the dark player.
  return (
    <main className="-mb-28 flex min-h-dvh flex-col bg-ink text-paper">
      <div className="flex items-center justify-between px-5 py-4">
        <Link href="/app" className="text-sm font-semibold text-paper/70">
          ← Назад
        </Link>
        <p className="text-sm text-paper/60">{workout.durationMin} мин</p>
      </div>
      <div className="aspect-video w-full bg-black">
        <iframe
          src={embedUrl}
          title={workout.title}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <section className="flex flex-1 flex-col justify-between gap-6 px-5 py-6">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold leading-tight">{workout.title}</h1>
          {workout.description && <p className="text-paper/70">{workout.description}</p>}
        </div>
        <AnimatePresence mode="wait">
          {phase === "watching" && (
            <motion.div key="w" exit={{ opacity: 0, y: 10 }} className="space-y-2">
              <Button onClick={finish} disabled={!unlocked} className="w-full">
                {unlocked ? "Завърших!" : `Завърших (след ~${remainingMin} мин)`}
              </Button>
              {error && (
                <p role="alert" className="text-center text-sm text-ember">
                  {error}
                </p>
              )}
            </motion.div>
          )}
          {phase === "rating" && (
            <motion.div
              key="r"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <p className="text-center font-display text-xl font-bold">Браво! Как беше?</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FEELING_LABEL) as Array<keyof typeof FEELING_LABEL>).map((f) => (
                  <Button
                    key={f}
                    variant="quiet"
                    size="md"
                    className="bg-paper/10 text-paper"
                    onClick={() => rate(f)}
                  >
                    {FEELING_LABEL[f]}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}
          {phase === "done" && (
            <motion.div
              key="d"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3 text-center"
            >
              <p className="font-display text-xl font-bold">
                Отбелязано. Ще се видим на следващата!
              </p>
              <Link href="/app" className="underline underline-offset-4">
                Към „Днес“
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
