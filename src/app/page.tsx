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
import { Faq } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { Pricing } from "@/components/site/pricing";
import { serverEnv } from "@/env";
import { brand } from "@/lib/brand";
import { faqJsonLd } from "@/lib/site/faq";
import { getFreeWorkout, getPublicPlans, getSiteFlags, getSiteLinks } from "@/server/site/content";

export const metadata = {
  title: { absolute: "I AM STRONG — тренировки у дома за 20 минути на ден" },
  description: brand.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: "I AM STRONG — тренировки у дома за 20 минути на ден",
    description: brand.description,
    type: "website",
    locale: "bg_BG",
    siteName: brand.name,
  },
};

/** The public home page. Signed-in members never reach it: the proxy sends them to /app. */
export default async function HomePage() {
  const [freeWorkout, links, flags, plans] = await Promise.all([
    getFreeWorkout(),
    getSiteLinks(),
    getSiteFlags(),
    getPublicPlans(),
  ]);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: brand.name,
          url: serverEnv.APP_URL,
          logo: `${serverEnv.APP_URL}/pwa-icon/512`,
        }}
      />
      <JsonLd data={faqJsonLd()} />
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
        <Pricing plans={plans} />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter instagramUrl={links.instagramUrl} year={flags.year} />
      <StickyCta />
    </>
  );
}
