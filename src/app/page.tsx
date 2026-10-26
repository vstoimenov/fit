import { FactsStrip } from "@/components/site/facts-strip";
import { FinalCta } from "@/components/site/final-cta";
import { First14 } from "@/components/site/first-14";
import { Hero } from "@/components/site/hero";
import { HowItWorks } from "@/components/site/how-it-works";
import { InsideTabs } from "@/components/site/inside-tabs";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Situations } from "@/components/site/situations";
import { StickyCta } from "@/components/site/sticky-cta";
import { TimePlanCalculator } from "@/components/site/time-plan";
import { Trainer } from "@/components/site/trainer";
import { TryWorkout } from "@/components/site/try-workout";
import { getFreeWorkout, getSiteFlags, getSiteLinks } from "@/server/site/content";

export const metadata = {
  title: { absolute: "I AM STRONG — тренировки у дома за 20 минути на ден" },
  description:
    "Онлайн клуб за тренировки у дома за жени. 20 минути на ден, без зала, с Аксения Михайлова.",
};

/** The public home page. Signed-in members never reach it: the proxy sends them to /app. */
export default async function HomePage() {
  const [freeWorkout, links, flags] = await Promise.all([
    getFreeWorkout(),
    getSiteLinks(),
    getSiteFlags(),
  ]);
  return (
    <>
      <SiteHeader showFounders={flags.showFounders} />
      <main>
        <Hero hasFreeWorkout={freeWorkout !== null} />
        <FactsStrip />
        <Situations />
        <HowItWorks />
        {freeWorkout && <TryWorkout workout={freeWorkout} />}
        <InsideTabs />
        <TimePlanCalculator />
        <Trainer video={links.trainerVideo} />
        <First14 />
        <FinalCta />
      </main>
      <SiteFooter instagramUrl={links.instagramUrl} year={flags.year} />
      <StickyCta />
    </>
  );
}
