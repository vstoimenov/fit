export type Situation = {
  id: "mother" | "long-hours" | "comeback" | "first-time";
  label: string;
  /** How her day looks. */
  day: string;
  /** What she gets from the club. */
  gets: string;
  /** What she starts with. */
  startsWith: string;
};

/** The „За теб ли е?" picker on the home page. Copy fixed by the design spec. */
export const SITUATIONS: readonly Situation[] = [
  {
    id: "mother",
    label: "Майка съм на малко дете",
    day: "Единственото сигурно време е, докато спи.",
    gets: "Тренировки по 10–20 минути без скокове и без шум, които спираш и пускаш.",
    startsWith: "Стартова седмица от 5 леки тренировки.",
  },
  {
    id: "long-hours",
    label: "Работя по 10 часа",
    day: "Вечер нямаш сили за зала, а сутрин нямаш време.",
    gets: "Програма, която решава вместо теб какво тренираш днес.",
    startsWith: "15-минутни сутрешни тренировки.",
  },
  {
    id: "comeback",
    label: "Връщам се след пауза",
    day: "Знаеш какво е да си във форма и те е страх да започнеш отново.",
    gets: "Три нива — почваш от средното и сменяш, когато усетиш.",
    startsWith: "Предизвикателството „Първите 14 дни“ с жени в същата ситуация.",
  },
  {
    id: "first-time",
    label: "Никога не съм тренирала",
    day: "Залата те плаши, а видеата в интернет са за други.",
    gets: "Всяко упражнение е показано бавно; Аксения го обяснява.",
    startsWith: "Стартова седмица и живата сесия, в която питаш каквото искаш.",
  },
];
