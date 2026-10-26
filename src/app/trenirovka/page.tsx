import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { CTA, CTA_PRIMARY, DISPLAY, WRAP } from "@/components/site/styles";
import { VideoFacade } from "@/components/site/video-facade";
import { getFreeWorkout, getSiteFlags, getSiteLinks } from "@/server/site/content";

export const metadata = {
  title: "Безплатна тренировка",
  robots: { index: false, follow: false },
};

/** The free workout, reached from the e-mail a lead receives. No form here. */
export default async function FreeWorkoutPage() {
  const [workout, links, flags] = await Promise.all([
    getFreeWorkout(),
    getSiteLinks(),
    getSiteFlags(),
  ]);
  if (!workout) notFound();
  return (
    <>
      <SiteHeader showFounders={flags.showFounders} />
      <main className={`${WRAP} py-12 lg:py-20`}>
        <p className="text-[13px] font-semibold tracking-[0.14em] text-rose-deep uppercase">
          Безплатна тренировка
        </p>
        <h1 className={`${DISPLAY} mt-3 text-4xl sm:text-[56px]`}>{workout.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">
          {workout.durationMin} минути · вкъщи, без уреди
        </p>
        <div className="mt-8 max-w-4xl">
          <VideoFacade
            video={workout.video}
            posterSrc={workout.posterSrc}
            title={workout.title}
            durationMin={workout.durationMin}
          />
        </div>
        <div className="mt-10 flex flex-col items-start gap-3">
          <p className="text-xl font-semibold">
            Хареса ли ти? Във въпросника получаваш план с още такива.
          </p>
          <Link href="/start" className={`${CTA} ${CTA_PRIMARY}`}>
            Вземи плана си <span aria-hidden>→</span>
          </Link>
        </div>
      </main>
      <SiteFooter instagramUrl={links.instagramUrl} year={flags.year} />
    </>
  );
}
