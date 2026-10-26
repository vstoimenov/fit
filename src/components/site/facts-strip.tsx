import { Check } from "lucide-react";
import { WRAP } from "./styles";

const FACTS = [
  "Нови тренировки всяка седмица",
  "Лекция всеки месец с Аксения и гост-лектори",
  "Доказана методика: 3 нива, стартова седмица, план ден по ден",
];

/** Three proof points under the hero. Horizontal snap scroll on phones, one row on desktop. */
export function FactsStrip() {
  return (
    <section aria-label="Накратко" className="border-y border-line">
      <ul
        className={`${WRAP} flex snap-x snap-mandatory gap-x-8 overflow-x-auto py-5 text-[15px] font-semibold whitespace-nowrap [scrollbar-width:none] lg:justify-between lg:gap-x-6 [&::-webkit-scrollbar]:hidden`}
      >
        {FACTS.map((fact) => (
          <li key={fact} className="flex snap-start items-center gap-3">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-powder text-ink">
              <Check size={14} strokeWidth={3} aria-hidden="true" />
            </span>
            {fact}
          </li>
        ))}
      </ul>
    </section>
  );
}
