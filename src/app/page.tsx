import { AboutClub } from "@/components/site/about-club";
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
import { ScrollReveal } from "@/components/site/scroll-reveal";
import type { Metadata } from "next";
import { serverEnv } from "@/env";
import { brand } from "@/lib/brand";
import { faqJsonLd } from "@/lib/site/faq";
import { clubJsonLd, homeDescription, homeFaq, priceText } from "@/lib/site/seo";
import { getSiteFlags, getFreeWorkout, getPublicPlans, getSiteLinks } from "@/server/site/content";

const TITLE = "I AM STRONG — онлайн тренировки у дома за жени, 20 минути на ден";

export async function generateMetadata(): Promise<Metadata> {
  const description = homeDescription(await getPublicPlans());
  return {
    title: { absolute: TITLE },
    description,
    metadataBase: new URL(serverEnv.APP_URL),
    alternates: { canonical: "/" },
    openGraph: {
      title: TITLE,
      description,
      url: "/",
      type: "website",
      locale: "bg_BG",
      siteName: brand.name,
    },
  };
}

/** The public home page. Signed-in members never reach it: the proxy sends them to /app. */
export default async function HomePage() {
  const [freeWorkout, links, flags, plans] = await Promise.all([
    getFreeWorkout(),
    getSiteLinks(),
    getSiteFlags(),
    getPublicPlans(),
  ]);
  const faq = homeFaq(plans);
  return (
    <>
      <JsonLd
        data={clubJsonLd({ baseUrl: serverEnv.APP_URL, plans, instagramUrl: links.instagramUrl })}
      />
      <JsonLd data={faqJsonLd(faq)} />
      {/* The founders offer is not promoted on the home page; /landing stays reachable directly. */}
      <SiteHeader showFounders={false} />
      <main>
        <Hero hasFreeWorkout={freeWorkout !== null} />
        <FactsStrip />
        <ScrollReveal>
          <Situations />
        </ScrollReveal>
        <ScrollReveal>
          <HowItWorks />
        </ScrollReveal>
        {freeWorkout && (
          <ScrollReveal>
            <TryWorkout workout={freeWorkout} />
          </ScrollReveal>
        )}
        <ScrollReveal>
          <InsideTabs />
        </ScrollReveal>
        <ScrollReveal>
          <TimePlanCalculator />
        </ScrollReveal>
        <ScrollReveal>
          <Trainer video={links.trainerVideo} />
        </ScrollReveal>
        <ScrollReveal>
          <First14 />
        </ScrollReveal>
        <ScrollReveal>
          <Pricing plans={plans} />
        </ScrollReveal>
        <ScrollReveal>
          <Faq items={faq} />
        </ScrollReveal>
        <AboutClub price={priceText(plans)} />
        <ScrollReveal>
          <FinalCta />
        </ScrollReveal>
      </main>
      <SiteFooter instagramUrl={links.instagramUrl} year={flags.year} />
      <StickyCta />
    </>
  );
}
