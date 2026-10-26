import { brand } from "@/lib/brand";
import { getSiteFlags, getSiteLinks } from "@/server/site/content";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { DISPLAY, WRAP } from "./styles";

/**
 * Stand-in for the legal pages until the owner supplies the texts (go-live checklist).
 * Better than a 404 behind the footer links and the consent checkbox.
 */
export async function LegalPlaceholder({ title }: { title: string }) {
  const [links, flags] = await Promise.all([getSiteLinks(), getSiteFlags()]);
  return (
    <>
      <SiteHeader showFounders={flags.showFounders} />
      <main className={`${WRAP} py-16 lg:py-24`}>
        <h1 className={`${DISPLAY} text-4xl sm:text-[56px]`}>{title}</h1>
        {/* TODO owner legal text: replace this paragraph with the final document. */}
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Документът се подготвя и ще бъде публикуван преди старта на клуба. Ако имаш въпрос
          дотогава, пиши ни на{" "}
          <a
            href={`mailto:${brand.supportEmail}`}
            className="font-semibold text-ink underline underline-offset-4"
          >
            {brand.supportEmail}
          </a>
          .
        </p>
      </main>
      <SiteFooter instagramUrl={links.instagramUrl} year={flags.year} />
    </>
  );
}
