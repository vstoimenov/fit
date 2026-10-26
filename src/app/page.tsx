import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { foundersLive } from "@/lib/site/founders";

export const metadata = {
  title: { absolute: "I AM STRONG — тренировки у дома за 20 минути на ден" },
  description:
    "Онлайн клуб за тренировки у дома за жени. 20 минути на ден, без зала, с Аксения Михайлова.",
};

/** The public home page. Signed-in members never reach it: the proxy sends them to /app. */
export default function HomePage() {
  // Evaluated when the page is prerendered; the founders link only needs day precision.
  const showFounders = foundersLive(new Date());
  return (
    <>
      <SiteHeader showFounders={showFounders} />
      <main className="mx-auto max-w-[1180px] px-6 py-16 lg:px-10">
        <h1 className="text-[44px] leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-7xl lg:text-[104px]">
          Силно тяло.
          <br />
          20 минути на ден.
          <br />
          <span className="mt-1 inline-block rounded-[14px] bg-powder px-3.5 py-0.5">
            Без зала.
          </span>
        </h1>
      </main>
      <SiteFooter instagramUrl={null} />
    </>
  );
}
