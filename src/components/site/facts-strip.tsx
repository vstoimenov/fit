import { WRAP } from "./styles";

const FACTS = ["20 минути", "3 нива", "вкъщи, с килимче", "с Аксения на живо всяка седмица"];

/** Four plain facts under the hero. Horizontal snap scroll on phones, one row on desktop. */
export function FactsStrip() {
  return (
    <section aria-label="Накратко" className="border-y border-line">
      <ul
        className={`${WRAP} flex snap-x snap-mandatory gap-x-8 overflow-x-auto py-5 text-[15px] font-semibold whitespace-nowrap [scrollbar-width:none] lg:justify-between lg:gap-x-6 [&::-webkit-scrollbar]:hidden`}
      >
        {FACTS.map((fact) => (
          <li key={fact} className="flex snap-start items-center gap-3">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-powder" />
            {fact}
          </li>
        ))}
      </ul>
    </section>
  );
}
