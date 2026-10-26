"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { PHOTOS } from "@/lib/photos";
import { Reveal } from "./reveal";
import { CTA, CTA_PRIMARY, CTA_SECONDARY, WRAP } from "./styles";

/** First screen: the three-line promise, the hero photo and the two calls to action. */
export function Hero({ hasFreeWorkout }: { hasFreeWorkout: boolean }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <section id="hero" className={`${WRAP} pt-6 pb-16 sm:pt-10 lg:pb-24`}>
      <Reveal>
        <p className="mb-6">
          <span className="inline-flex min-h-8 items-center rounded-full bg-powder-chip px-3.5 py-1 text-[15px] font-semibold text-rose-deep">
            Онлайн клуб за тренировки у дома
          </span>
        </p>
      </Reveal>
      <h1 className="text-[44px] leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-7xl lg:text-[104px]">
        <Reveal>
          <span className="block">Силно тяло.</span>
        </Reveal>
        <Reveal delay={0.08}>
          <span className="block">20 минути на ден.</span>
        </Reveal>
        <Reveal delay={0.16}>
          <span className="mt-1 inline-block rounded-[14px] bg-powder px-3.5 py-0.5">
            Без зала.
          </span>
        </Reveal>
      </h1>

      <div className="mt-12 grid gap-8 lg:mt-14 lg:grid-cols-12 lg:gap-12">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-sand lg:col-span-7">
          <motion.div
            className="absolute inset-0"
            initial={reduced ? false : { scale: 1.04 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            <Image
              src={PHOTOS.hero.src}
              alt={PHOTOS.hero.alt}
              fill
              priority
              sizes="(min-width:1024px) 680px, 100vw"
              className="object-cover"
            />
          </motion.div>
        </div>
        <div className="flex flex-col justify-end gap-6 lg:col-span-5">
          <p className="text-xl leading-relaxed">
            Кратки видео тренировки по програма, хранене без броене на всяка хапка и общ старт с
            други жени, които също нямат време. Водени от Аксения Михайлова.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/start" className={`${CTA} ${CTA_PRIMARY}`}>
              Започни безплатно <span aria-hidden>→</span>
            </Link>
            {hasFreeWorkout && (
              <a href="#opitay" className={`${CTA} ${CTA_SECONDARY}`}>
                Опитай тренировка
              </a>
            )}
          </div>
          <p className="text-[15px] text-ink-soft">Първата тренировка е безплатна. Без карта.</p>
        </div>
      </div>
    </section>
  );
}
