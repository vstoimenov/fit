"use client";

import Link from "next/link";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { FreeWorkout } from "@/server/site/map";
import { LEAD_STORAGE_KEY, LeadForm } from "./lead-form";
import { CTA, CTA_SECONDARY, DISPLAY, WRAP } from "./styles";
import { VideoFacade } from "./video-facade";

const subscribeNoop = () => () => {};
function readRemembered(): boolean {
  try {
    return localStorage.getItem(LEAD_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** „Опитай сега": the free workout, unlocked with a name and an e-mail (remembered per browser). */
export function TryWorkout({ workout }: { workout: FreeWorkout }) {
  // Remembered per browser; the server always renders "locked" (storage may be unavailable).
  const remembered = useSyncExternalStore(subscribeNoop, readRemembered, () => false);
  const [unlockedNow, setUnlockedNow] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const formBox = useRef<HTMLDivElement>(null);
  const unlocked = remembered || unlockedNow;

  const onUnlocked = useCallback((n: string) => {
    setName(n);
    setUnlockedNow(true);
  }, []);

  const focusForm = () => {
    formBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    formBox.current?.querySelector("input")?.focus();
  };

  return (
    <section id="opitay" className="scroll-mt-20 bg-sand py-20 lg:py-28">
      <div className={WRAP}>
        <h2 className={`${DISPLAY} text-4xl sm:text-[56px]`}>Опитай една тренировка. Сега.</h2>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          {workout.title} · {workout.durationMin} минути. Вкъщи, без уреди.
        </p>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <VideoFacade
              video={workout.video}
              posterSrc={workout.posterSrc}
              title={workout.title}
              durationMin={workout.durationMin}
              locked={!unlocked}
              onLockedClick={focusForm}
            />
          </div>
          <div ref={formBox} className="rounded-3xl bg-white p-6 sm:p-8 lg:col-span-5">
            {unlocked ? (
              <div className="flex flex-col gap-4">
                <p className="text-2xl font-extrabold tracking-[-0.02em]">
                  {name ? `Готово, ${name}. Пусни я.` : "Отключена е. Пусни я."}
                </p>
                <p className="text-ink-soft">
                  Хареса ли ти? Във въпросника получаваш план с още такива.
                </p>
                <Link href="/start" className={`${CTA} ${CTA_SECONDARY} w-fit`}>
                  Вземи плана си
                </Link>
              </div>
            ) : (
              <>
                <p className="mb-5 text-xl font-bold">Отключи я с име и имейл</p>
                <LeadForm onUnlocked={onUnlocked} />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
