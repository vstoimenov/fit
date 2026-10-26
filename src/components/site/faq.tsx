import { ChevronDown } from "lucide-react";
import { FAQ } from "@/lib/site/faq";
import { DISPLAY, WRAP } from "./styles";

/** Native <details> accordion; the chevron rotates with the open state. */
export function Faq() {
  return (
    <section id="vaprosi" className={`${WRAP} scroll-mt-20 pb-24`}>
      <h2 className={`${DISPLAY} text-4xl sm:text-[56px]`}>Въпроси</h2>
      <div className="mt-8 border-t border-line">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="group border-b border-line">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-xl font-bold tracking-[-0.01em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown
                size={22}
                aria-hidden="true"
                className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <p className="max-w-3xl pb-6 text-lg leading-relaxed text-ink-soft">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
