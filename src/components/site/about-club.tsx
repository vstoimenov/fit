import { brand } from "@/lib/brand";
import { CITY, TRAINER, WHO_WE_HELP } from "@/lib/site/seo";
import { DISPLAY, EYEBROW, WRAP } from "./styles";

/**
 * „Накратко за клуба“: who it helps, in Аксения's words, plus the plain facts (price, guarantee,
 * company, city). Written as ordinary text so search engines and AI assistants can quote it.
 */
export function AboutClub({ price }: { price: string | null }) {
  return (
    <section
      id="nakratko"
      aria-labelledby="nakratko-title"
      className={`${WRAP} scroll-mt-20 pb-20`}
    >
      <p className={`${EYEBROW} text-rose-deep`}>Накратко за клуба</p>
      <h2 id="nakratko-title" className={`${DISPLAY} mt-3 text-4xl sm:text-[56px]`}>
        За кого е I AM STRONG
      </h2>
      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-12">
        <ul className="flex flex-col gap-4 lg:col-span-7">
          {WHO_WE_HELP.map((line) => (
            <li
              key={line}
              className="rounded-3xl bg-powder-light p-6 text-lg leading-relaxed text-ink"
            >
              „{line}“
            </li>
          ))}
          <li className="text-[15px] font-semibold text-ink-soft">— {TRAINER}, треньорка</li>
        </ul>
        <dl className="grid content-start gap-4 text-[15px] lg:col-span-5">
          <Fact term="Какво">
            Онлайн клуб на български за тренировки у дома за жени: нова 20-минутна видео тренировка
            всеки делничен ден, три нива, хранене с менюта, общност и Аксения на живо веднъж
            седмично.
          </Fact>
          {price && <Fact term="Цена">{price}. Спираш когато искаш.</Fact>}
          <Fact term="Гаранция">
            14 дни: тренирай 10 от първите 14 дни и ако не се чувстваш по-силна, връщаме парите.
          </Fact>
          <Fact term="Къде">Онлайн, от всяко място в България и чужбина.</Fact>
          <Fact term="Фирма">
            {brand.operator.name}, гр. {CITY} · {brand.supportEmail}
          </Fact>
        </dl>
      </div>
    </section>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line pb-4">
      <dt className="font-bold text-ink">{term}</dt>
      <dd className="mt-1 leading-relaxed text-ink-soft">{children}</dd>
    </div>
  );
}
