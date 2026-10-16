import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { clientEnv } from "@/env";
import { DeletedNotice } from "@/components/landing/deleted-notice";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Included } from "@/components/landing/included";
import { Pricing } from "@/components/landing/pricing";
import { SiteFooter } from "@/components/landing/site-footer";
import { brand } from "@/lib/brand";
import { fetchPublicPlans } from "@/server/content/public-plans";

export const metadata = {
  title: { absolute: `${brand.name} · ${brand.tagline}` },
  description: brand.description,
};

// Everything on this page is static except the prices. They are the same for every visitor, so
// they are read once as an anonymous client and shared through the cache for an hour.
async function getLandingPlans() {
  "use cache";
  cacheLife("hours");
  return fetchPublicPlans({
    url: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

async function PricingSection() {
  // A failed read must not take the landing down: render the section without amounts.
  const plans = await getLandingPlans().catch(() => null);
  return <Pricing plans={plans} />;
}

export default function Home() {
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center px-5 py-4 lg:px-8">
        <p className="font-display text-lg font-extrabold">{brand.name}</p>
      </header>
      <main>
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <Suspense>
            <DeletedNotice />
          </Suspense>
        </div>
        <Hero />
        <HowItWorks />
        <Included />
        <Suspense fallback={<div className="min-h-80" aria-hidden />}>
          <PricingSection />
        </Suspense>
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
