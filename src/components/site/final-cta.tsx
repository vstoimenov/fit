import Link from "next/link";
import { CTA, CTA_WHITE, DISPLAY, WRAP } from "./styles";

/** Last word before the footer: the promise once more, one white button, one handwritten note. */
export function FinalCta() {
  return (
    <section className="bg-ink py-24 text-white">
      <div className={`${WRAP} flex flex-col items-start gap-8`}>
        <h2 className={`${DISPLAY} text-4xl sm:text-[56px]`}>
          Силно тяло.
          <br />
          20 минути на ден.
          <br />
          Без зала.
        </h2>
        <div className="flex flex-col gap-3">
          <Link href="/start" className={`${CTA} ${CTA_WHITE}`}>
            Започни безплатно <span aria-hidden>→</span>
          </Link>
          <p className="font-script -rotate-2 pl-2 text-2xl text-powder">
            първата тренировка е без карта
          </p>
        </div>
      </div>
    </section>
  );
}
