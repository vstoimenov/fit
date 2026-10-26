import Image from "next/image";
import Link from "next/link";
import { PHOTOS } from "@/lib/photos";
import { Reveal } from "./reveal";
import { CTA, CTA_PRIMARY, CTA_SECONDARY, WRAP } from "./styles";

/** First screen: the three-line promise, the hero photo and the two calls to action. */
export function Hero({ hasFreeWorkout }: { hasFreeWorkout: boolean }) {
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
        <Reveal as="span" className="block">
          Силно тяло.
        </Reveal>
        <Reveal as="span" className="block" delay={0.08}>
          20 минути на ден.
        </Reveal>
        <Reveal as="span" className="inline-block" delay={0.16}>
          <span className="mt-1 inline-block rounded-[14px] bg-powder px-3.5 py-0.5">
            Без зала.
          </span>
        </Reveal>
      </h1>

      <div className="mt-12 grid gap-8 lg:mt-14 lg:grid-cols-12 lg:gap-12">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-sand lg:col-span-7">
          {/* One slow settle from 1.04 to 1 on load; off under reduced motion. */}
          <div className="absolute inset-0 animate-site-zoom motion-reduce:animate-none">
            <Image
              src={PHOTOS.hero.src}
              alt={PHOTOS.hero.alt}
              fill
              preload
              fetchPriority="high"
              sizes="(min-width:1024px) 680px, 100vw"
              className="object-cover"
            />
          </div>
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
