"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import {
  SEATS_LEFT,
  SEATS_TOTAL,
  countdown,
  levelView,
  painMessage,
  seatsLeft,
} from "@/lib/landing/strong";

// A shared 30-second clock. The server snapshot is null, so the static HTML carries no time and
// never mismatches; the browser switches to the real time on hydration.
let clockNow = 0;
function subscribeClock(onChange: () => void) {
  clockNow = Date.now();
  const id = setInterval(() => {
    clockNow = Date.now();
    onChange();
  }, 30_000);
  return () => clearInterval(id);
}
function clockSnapshot(): number {
  if (clockNow === 0) clockNow = Date.now();
  return clockNow;
}

function useNow(): number | null {
  return useSyncExternalStore<number | null>(subscribeClock, clockSnapshot, () => null);
}

const ctaClass =
  "inline-flex min-h-14 items-center gap-3 rounded-full px-7 text-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-powder";

export function CountdownText({ fallback }: { fallback: string }) {
  const now = useNow();
  return <span aria-live="polite">{now === null ? fallback : countdown(now).strip}</span>;
}

export function CountdownTiles() {
  const now = useNow();
  if (now === null) return <div className="mb-9 min-h-[92px]" aria-hidden />;
  const c = countdown(now);
  if (!c.open) return null;
  const tiles = [
    { value: String(c.days), label: "дни" },
    { value: c.hours, label: "часа" },
    { value: c.minutes, label: "минути" },
  ];
  return (
    <div className="mb-9 grid max-w-[420px] grid-cols-3 gap-2.5" aria-label="Оставащо време">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl bg-white p-3.5 text-center">
          <p className="text-[40px] leading-none font-extrabold tracking-[-0.02em]">{t.value}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.label}</p>
        </div>
      ))}
    </div>
  );
}

const PAINS = [
  "Започваш в понеделник. В сряда вече си спряла и чакаш следващия понеделник.",
  "Търсиш в YouTube „какво да тренирам“, гледаш петнайсет минути и затваряш, без да си направила и един клек.",
  "Децата заспиват в 21:30. Ти заспиваш в 21:35.",
  "Гледаш стара снимка и не помниш кога за последно си се чувствала силна.",
];

export function PainPicker() {
  const [picked, setPicked] = useState<boolean[]>(() => PAINS.map(() => false));
  const count = picked.filter(Boolean).length;
  return (
    <>
      <ul className="flex flex-col gap-3">
        {PAINS.map((text, i) => {
          const on = picked[i]!;
          return (
            <li key={text}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setPicked((p) => p.map((v, j) => (j === i ? !v : v)))}
                className={cn(
                  "grid w-full grid-cols-[44px_minmax(0,1fr)] items-center gap-4 rounded-2xl px-5 py-5 text-left text-xl leading-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-powder sm:grid-cols-[44px_minmax(0,1fr)_auto]",
                  on ? "bg-powder-chip text-ink" : "bg-[#1E1E1E] text-white",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-full text-lg font-extrabold",
                    on ? "bg-rose-deep text-white" : "bg-powder-chip text-rose-deep",
                  )}
                >
                  {on ? "✓" : i + 1}
                </span>
                <span>{text}</span>
                <span className="col-start-2 text-sm font-semibold sm:col-start-auto">
                  {on ? "Това съм аз" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div aria-live="polite" className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <p className="max-w-3xl text-2xl leading-snug font-semibold">{painMessage(count)}</p>
        {count > 0 && (
          <Link href="/start" className={cn(ctaClass, "bg-white text-ink hover:bg-sand")}>
            Искам място <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </>
  );
}

export function LevelPicker() {
  const [level, setLevel] = useState(4);
  const view = levelView(level);
  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-sand p-6 sm:p-7">
      <div role="group" aria-label="Ниво" className="flex flex-wrap gap-2">
        {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => {
          const current = n === view.level;
          const reached = n <= view.level;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={current}
              aria-label={`Ниво ${n}`}
              onClick={() => setLevel(n)}
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-full border-[1.5px] text-base font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink",
                current
                  ? "border-ink bg-ink text-white"
                  : reached
                    ? "border-powder-chip bg-powder-chip text-rose-deep"
                    : "border-line bg-white text-ink",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div
        role="progressbar"
        aria-label="Напредък по нива"
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={view.level}
        className="h-2.5 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-powder transition-[width] duration-200"
          style={{ width: `${view.level * 10}%` }}
        />
      </div>
      <div aria-live="polite">
        <p className="text-[32px] leading-tight font-extrabold tracking-[-0.02em]">
          Ниво {view.level}
        </p>
        <p className="mt-1.5 text-[19px]">{view.text}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {view.rewards.map((r) => (
          <li
            key={r.level}
            className={cn(
              "rounded-[14px] border p-4",
              r.unlocked
                ? r.level === 10
                  ? "border-powder bg-powder text-ink"
                  : "border-white bg-white text-ink"
                : "border-line text-ink-soft",
            )}
          >
            <p className="text-sm font-semibold">
              Ниво {r.level} · {r.unlocked ? "отключено" : "заключено"}
            </p>
            <p className="mt-1.5 font-semibold">{r.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MYTHS = [
  {
    claim: "„Без зала няма резултат“",
    truth:
      "Тялото ти не знае дали си в зала или в хола. Знае само дали работиш редовно. Двайсет минути всеки ден бият два часа веднъж в месеца.",
  },
  {
    claim: "„Нямам време“",
    truth:
      "Нямаш час и половина плюс път до залата. Двайсет минути намираш, докато детето спи или преди всички да станат.",
  },
  {
    claim: "„Пак ще се откажа“",
    truth:
      "Досега си тренирала сама и никой не е забелязвал, че те няма. С общ старт, група и Аксения на живо е много по-трудно да изчезнеш.",
  },
];

export function Myths() {
  const [open, setOpen] = useState<boolean[]>(() => MYTHS.map(() => false));
  return (
    <ul className="flex flex-col gap-3">
      {MYTHS.map((m, i) => {
        const isOpen = open[i]!;
        const id = `myth-${i}`;
        return (
          <li key={m.claim} className="flex flex-col gap-3.5 rounded-2xl bg-[#1E1E1E] px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <p
                className={cn(
                  "text-[30px] leading-tight font-extrabold tracking-[-0.02em] decoration-powder decoration-[3px]",
                  isOpen && "line-through",
                )}
              >
                {m.claim}
              </p>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={id}
                onClick={() => setOpen((o) => o.map((v, j) => (j === i ? !v : v)))}
                className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-white px-[18px] text-[15px] font-semibold text-white transition-colors hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-powder"
              >
                {isOpen ? "Скрий" : "Виж истината"}
              </button>
            </div>
            <p id={id} hidden={!isOpen} className="max-w-3xl text-[19px] text-line">
              {m.truth}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

const PLANS = [
  {
    id: "month",
    label: "Първите 50",
    price: "€14,90",
    per: "на месец, за 12 месеца",
    cta: "Взимам място",
    summary: "€14,90 на месец, заключени за 12 месеца.",
  },
  {
    id: "year",
    label: "Цяла година",
    price: "€179",
    per: "веднъж, около €14,90 на месец",
    note: "Вътре си до края на 2027",
    cta: "Взимам годината",
    summary: "€179 веднъж, вътре си до края на 2027.",
  },
] as const;

export function OfferPicker() {
  const [planId, setPlanId] = useState<(typeof PLANS)[number]["id"]>("month");
  const seats = seatsLeft(SEATS_LEFT);
  const chosen = PLANS.find((p) => p.id === planId) ?? PLANS[0];
  return (
    <>
      <div role="radiogroup" aria-label="Избери план" className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((p) => {
          const on = p.id === planId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPlanId(p.id)}
              className={cn(
                "flex flex-col gap-2.5 rounded-2xl bg-white p-7 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink",
                on ? "shadow-[inset_0_0_0_2px_#111111]" : "shadow-[inset_0_0_0_1px_#E6E4DF]",
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="inline-flex min-h-8 items-center rounded-full bg-powder-chip px-3.5 py-1 text-[15px] font-semibold text-rose-deep">
                  {p.label}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full border-2 border-ink",
                    on ? "bg-ink" : "bg-white",
                  )}
                >
                  <span className="size-3 rounded-full bg-white" />
                </span>
              </span>
              <span className="text-[56px] leading-none font-extrabold tracking-[-0.02em] sm:text-[64px]">
                {p.price}
              </span>
              <span>{p.per}</span>
              {p.id === "month" ? (
                <>
                  <span className="font-semibold">
                    Остават {seats.left} от {SEATS_TOTAL} места
                  </span>
                  <span className="block h-2 overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full bg-powder"
                      style={{ width: `${seats.percent}%` }}
                    />
                  </span>
                </>
              ) : (
                <span className="font-semibold">{"note" in p ? p.note : ""}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
        <Link href="/start" className={cn(ctaClass, "bg-ink text-white hover:bg-[#2A2A2A]")}>
          {chosen.cta} <span aria-hidden>→</span>
        </Link>
        <p aria-live="polite" className="text-ink-soft">
          {chosen.summary}
        </p>
      </div>
    </>
  );
}
