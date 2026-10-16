import { Bell, CalendarDays, LineChart, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

const ITEMS = [
  {
    icon: CalendarDays,
    title: "Седмична програма по ниво",
    text: "Нови тренировки всяка седмица, подбрани за твоето ниво и време.",
  },
  {
    icon: PlayCircle,
    title: "Библиотека с тренировки",
    text: "Филтрирай по ниво, продължителност и фокус и тренирай, когато ти е удобно.",
  },
  {
    icon: LineChart,
    title: "Проследяване на прогреса",
    text: "Тегло, мерки и серии на едно място, за да виждаш как вървиш.",
  },
  {
    icon: Bell,
    title: "Напомняния",
    text: "Тихо напомняне в удобен за теб час, за да не изпускаш ритъма.",
  },
];

export function Included() {
  return (
    <section
      aria-labelledby="included-title"
      className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16"
    >
      <h2 id="included-title" className="font-display text-3xl font-extrabold text-balance">
        Какво получаваш
      </h2>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Card className="h-full space-y-3 p-5">
              <Icon aria-hidden className="h-7 w-7" strokeWidth={1.75} />
              <h3 className="font-display text-lg font-extrabold">{title}</h3>
              <p className="text-ink-soft">{text}</p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
