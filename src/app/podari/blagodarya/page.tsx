import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { DISPLAY, EYEBROW, WRAP } from "@/components/site/styles";
import { Suspense } from "react";
import { getSiteFlags, getSiteLinks } from "@/server/site/content";
import { GiftThanks } from "./gift-thanks";

export const metadata = { title: "Благодарим", robots: { index: false } };

/** After Stripe: the code appears as soon as the webhook has written it (usually seconds). */
export default async function GiftThanksPage() {
  const [links, flags] = await Promise.all([getSiteLinks(), getSiteFlags()]);
  return (
    <>
      <SiteHeader showFounders={flags.showFounders} />
      <main className={`${WRAP} py-12 lg:py-20`}>
        <p className={`${EYEBROW} text-rose-deep`}>Подаръчен ваучер</p>
        <h1 className={`${DISPLAY} mt-3 text-[44px] sm:text-7xl`}>Благодарим ти.</h1>
        <Suspense fallback={<p className="mt-8 text-xl" aria-busy="true" />}>
          <GiftThanks />
        </Suspense>
      </main>
      <SiteFooter instagramUrl={links.instagramUrl} year={flags.year} />
    </>
  );
}
