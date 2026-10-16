import Image from "next/image";
import { PHOTOS } from "@/lib/photos";
import { QUESTION_COUNT } from "@/lib/onboarding/question-steps";

const STEPS = [
  {
    photo: PHOTOS.step1,
    title: `Отговори на ${QUESTION_COUNT} въпроса`,
    text: "Цел, ниво и колко време имаш. Отнема няколко минути.",
  },
  {
    photo: PHOTOS.step2,
    title: "Направи първата тренировка безплатно",
    text: "Без карта и без ангажимент. Просто пробвай.",
  },
  {
    photo: PHOTOS.step3,
    title: "Тренирай по своя програма",
    text: "Всяка седмица получаваш тренировки по твоето ниво.",
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
      <h2 id="how-title" className="font-display text-3xl font-extrabold text-balance">
        Как работи
      </h2>
      <ol className="mt-8 grid gap-8 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="space-y-4">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand">
              <Image
                src={step.photo.src}
                alt={step.photo.alt}
                fill
                sizes="(min-width: 1152px) 360px, (min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink-soft">Стъпка {i + 1}</p>
              <h3 className="font-display text-xl font-extrabold">{step.title}</h3>
              <p className="text-ink-soft">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
