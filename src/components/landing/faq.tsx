import { ChevronDown } from "lucide-react";

const QUESTIONS = [
  {
    q: "Трябват ли ми уреди?",
    a: "Не задължително. Ако за дадена тренировка ти трябва нещо, това е посочено при самата тренировка.",
  },
  {
    q: "Колко време отнема една тренировка?",
    a: "Зависи от теб: избираш дали имаш до 15 минути, 20–30 или повече, а програмата се нагажда към това.",
  },
  {
    q: "Подходящо ли е за начинаещи?",
    a: "Да. Започваш с въпроси за нивото ти, а първите седмици са леки, за да влезеш в ритъм без мускулна треска.",
  },
  {
    q: "Мога ли да откажа, когато поискам?",
    a: "Да. Абонаментът се управлява от профила ти и можеш да го спреш по всяко време.",
  },
  {
    q: "Как гледам видеата?",
    a: "Директно в приложението, на телефона, таблета или компютъра. Не е нужно да сваляш нищо.",
  },
];

export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-5 py-12 lg:px-8 lg:py-16">
      <h2 id="faq-title" className="font-display text-3xl font-extrabold text-balance">
        Въпроси
      </h2>
      <div className="mt-8 divide-y divide-line border-y border-line">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown
                aria-hidden
                className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="pb-4 text-ink-soft">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
