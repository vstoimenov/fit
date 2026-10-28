import type { LegalDoc } from "@/lib/legal/doc";
import { getSiteFlags, getSiteLinks } from "@/server/site/content";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { DISPLAY, WRAP } from "./styles";

/** A legal page (Общи условия, Политика за поверителност) inside the public site frame. */
export async function LegalDocument({ doc }: { doc: LegalDoc }) {
  const [links, flags] = await Promise.all([getSiteLinks(), getSiteFlags()]);
  return (
    <>
      <SiteHeader showFounders={flags.showFounders} />
      <main className={`${WRAP} py-16 lg:py-24`}>
        <article className="max-w-2xl space-y-10">
          <header className="space-y-3">
            <h1 className={`${DISPLAY} text-4xl sm:text-[56px]`}>{doc.title}</h1>
            <p className="text-sm text-ink-soft">Последна промяна: {doc.updated}</p>
          </header>
          {doc.sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-xl font-extrabold tracking-tight">{section.heading}</h2>
              {section.blocks.map((block, i) =>
                typeof block === "string" ? (
                  <p key={i} className="leading-relaxed text-ink">
                    {block}
                  </p>
                ) : (
                  <ul key={i} className="list-disc space-y-2 pl-5 leading-relaxed text-ink">
                    {block.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
        </article>
      </main>
      <SiteFooter instagramUrl={links.instagramUrl} year={flags.year} />
    </>
  );
}
