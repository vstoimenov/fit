import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { DeletedNotice } from "@/components/landing/deleted-notice";
import {
  CountdownText,
  CountdownTiles,
  LevelPicker,
  Myths,
  OfferPicker,
  PainPicker,
} from "@/components/landing/strong/interactive";
import { Logo } from "@/components/ui/logo";
import { brand } from "@/lib/brand";
import { PHOTOS } from "@/lib/photos";

export const metadata = {
  title: { absolute: "I AM STRONG · онлайн клубът на Аксения" },
  description:
    "Силно тяло. 20 минути на ден. Без зала. Онлайн клубът на Аксения Михайлова за заети жени и майки.",
  alternates: { canonical: "/osnovatelki" },
};

const wrap = "mx-auto max-w-[1200px] px-[18px] sm:px-8";
const display = "font-extrabold tracking-[-0.02em] leading-[1.05]";
const chip =
  "inline-flex min-h-8 items-center rounded-full bg-powder-chip px-3.5 py-1 text-[15px] font-semibold text-rose-deep";
const cta =
  "inline-flex min-h-14 items-center gap-3 rounded-full px-7 text-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-powder";

const GET = [
  {
    title: "Тренировка, която влиза в деня ти",
    body: "Всеки делничен ден нова тренировка от 20 до 25 минути, вкъщи и без уреди. Всяко упражнение има три нива, от първия клек до истинска сила.",
    scene:
      "Детето заспива следобед. Пускаш видеото, изпотяваш се и до три часа вече си направила нещо за себе си.",
  },
  {
    title: "Край на понеделнишките старти",
    body: "Започваме всички заедно на 23 ноември. В групата получаваш задача всеки ден, а Аксения е на живо веднъж седмично.",
    scene:
      "Сряда е, а ти още тренираш. Стотици жени отмятат задачата с теб и някоя от тях ще пита къде си.",
  },
  {
    title: "Тяло, което усещаш по-силно",
    body: "Всеки месец има тема: корем, дупе, енергия. В края се измерваш, за да виждаш напредъка, а не да гадаеш.",
    scene:
      "Вдигаш детето от пода и гърбът не протестира. Дънките от дъното на гардероба се закопчават без да си поемаш дъх.",
  },
];

const STEPS = [
  { big: "01", title: "Записваш се", body: "Плащаш с карта и влизаш в групата веднага." },
  { big: "23.11", title: "Общ старт", body: "„Първите 14 дни“ започват за всички едновременно." },
  { big: "20′", title: "Всеки ден", body: "Тренировка, когато ти е удобно, и отметка в групата." },
  { big: "30", title: "Всеки месец", body: "Нова тема и измерване. Напредъкът е на снимка." },
];

const GIFTS = [
  ["Месец 3", "Тениска"],
  ["Месец 6", "Шапка"],
  ["Месец 9", "Чорапи"],
  ["Месец 12", "Изненада"],
];

const FAQ = [
  {
    q: "Никога не съм тренирала. Ще се справя ли?",
    lead: "Да, точно за теб е нивото за начинаещи.",
    a: "Всяко упражнение има три варианта. Започваш от най-лекия и минаваш нагоре, когато ти си готова.",
  },
  {
    q: "Трябват ли ми уреди?",
    lead: "Не.",
    a: "Трябват ти постелка или килим и два квадратни метра място.",
  },
  {
    q: "Родих наскоро или съм бременна. Може ли?",
    lead: "Само след разрешение от лекар.",
    a: "Програмата не е създадена за бременност и ранния период след раждане. Щом лекарят ти разреши, започваш от нивото за начинаещи.",
  },
  {
    q: "Ако пропусна живото включване?",
    lead: "Гледаш го на запис.",
    a: "Всяко включване остава в клуба.",
  },
  {
    q: "Ами ако не ми хареса?",
    lead: "Връщаме ти парите.",
    a: "Тренирай 10 от първите 14 дни и ако не се чувстваш по-силна, ни пишеш.",
  },
  {
    q: "Как плащам и мога ли да спра?",
    lead: "С карта, Apple Pay или Google Pay, и да, можеш.",
    a: "Абонаментът се подновява всеки месец. Ако ти трябва почивка, го паузираш за месец и пазиш основателската си цена.",
  },
];

export default function Home() {
  return (
    <div className="bg-white text-lg leading-relaxed text-ink">
      {/* Лента */}
      <div className="bg-ink text-white">
        <div
          className={`${wrap} flex flex-wrap items-center gap-x-6 gap-y-2 py-2.5 text-[15px] font-semibold`}
        >
          <span>Старт 23.11</span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full bg-powder" />
            Първите 50 места: €14,90
          </span>
          <CountdownText fallback="Записването затваря на 21.11" />
        </div>
      </div>

      {/* Хедър */}
      <header className={`${wrap} flex items-center justify-between gap-4 py-5`}>
        <Link href="/" aria-label="Начало">
          <Logo size="md" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center px-2 font-semibold whitespace-nowrap underline-offset-4 hover:underline sm:px-3"
          >
            Вход
          </Link>
          <a
            href="#oferta"
            className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-ink px-3.5 text-[15px] font-semibold whitespace-nowrap sm:px-5 sm:text-base"
          >
            Запиши се
          </a>
        </nav>
      </header>

      <main>
        <div className={wrap}>
          <Suspense>
            <DeletedNotice />
          </Suspense>
        </div>

        {/* Hero */}
        <section className={`${wrap} pt-8 pb-22`}>
          <p className="mb-5">
            <span className={chip}>За заети жени и майки, които нямат време за зала</span>
          </p>
          <h1 className={`${display} text-[44px] leading-[1.12] sm:text-7xl lg:text-[88px]`}>
            Силно тяло.
            <br />
            20 минути на ден.
            <br />
            <span className="mt-1 inline-block rounded-[14px] bg-powder px-3.5 py-0.5">
              Без зала.
            </span>
          </h1>
          <div className="mt-14 grid gap-8 lg:grid-cols-12">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand lg:col-span-7">
              <Image
                src={PHOTOS.hero.src}
                alt={PHOTOS.hero.alt}
                fill
                preload
                sizes="(min-width:1024px) 680px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-end gap-5 lg:col-span-5">
              <p className="text-xl">
                I AM STRONG е онлайн клубът на Аксения Михайлова. Всеки ден нова тренировка, която
                правиш вкъщи, докато детето спи. Започваме всички заедно на 23 ноември, а веднъж
                седмично тренираш с нея на живо.
              </p>
              <p className="text-xl">Ако за 14 дни не се почувстваш по-силна, връщаме ти парите.</p>
              <div>
                <a href="#oferta" className={`${cta} bg-ink text-white hover:bg-[#2A2A2A]`}>
                  Искам място <span aria-hidden>→</span>
                </a>
              </div>
              <p className="text-[15px] text-ink-soft">
                €14,90 на месец за първите 50 жени, заключени за 12 месеца.
              </p>
            </div>
          </div>
        </section>

        {/* Познаваш ли се */}
        <section className="bg-ink py-22 text-white">
          <div className={wrap}>
            <h2 className={`${display} mb-2.5 text-4xl sm:text-[56px]`}>Познаваш ли се?</h2>
            <p className="mb-8 text-[#BDBBB4]">Докосни това, което е за теб.</p>
            <PainPicker />
          </div>
        </section>

        {/* Какво получаваш */}
        <section className={`${wrap} pt-24 pb-18`}>
          <h2 className={`${display} mb-7 text-4xl sm:text-[56px]`}>Какво получаваш</h2>
          <div className="flex flex-col gap-4">
            {GET.map((g) => (
              <div
                key={g.title}
                className="grid gap-3 rounded-2xl bg-sand p-7 lg:grid-cols-[5fr_7fr] lg:gap-8"
              >
                <h3 className={`${display} text-[30px] leading-tight`}>{g.title}</h3>
                <div className="flex flex-col gap-3">
                  <p>{g.body}</p>
                  <p className="text-ink-soft">{g.scene}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Как започваш */}
        <section className={`${wrap} pb-24`}>
          <h2 className={`${display} mb-6 text-[40px]`}>Как започваш</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.title} className="rounded-2xl bg-sand p-6">
                <span className={`${display} text-[44px]`}>{s.big}</span>
                <p className="mt-3 font-semibold">{s.title}</p>
                <p className="mt-1 text-base text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Аксения */}
        <section className="bg-sand py-24">
          <div className={`${wrap} grid items-end gap-8 lg:grid-cols-12`}>
            {/* A stock photo here would pass for her: keep a labelled slot until her own photo arrives. */}
            <div className="flex aspect-[3/4] items-end rounded-2xl bg-line p-5 text-sm text-ink-soft lg:col-span-5">
              [Снимка на Аксения]
            </div>
            <div className="flex flex-col gap-5 lg:col-span-6 lg:col-start-7">
              <p>
                <span className={chip}>Здравей, аз съм Аксения</span>
              </p>
              <p className={`${display} text-[40px] leading-tight`}>
                „Не искам да си слаба. Искам да си силна.“
              </p>
              <p className="text-[19px]">
                Майка съм на две деца и знам какво е денят да свърши, преди да си направила нещо за
                себе си. Всичко, което виждаш в профила ми, го правя между грижата за тях. Затова
                знам, че не ти трябват два часа в зала. Трябват ти план, двайсет минути и хора до
                теб.
              </p>
            </div>
          </div>
        </section>

        {/* Нива */}
        <section className={`${wrap} py-24`}>
          <h2 className={`${display} mb-3 text-4xl sm:text-[56px]`}>Тренираш. Качваш ниво.</h2>
          <p className="mb-7 max-w-3xl text-xl text-ink-soft">
            Всяка тренировка, споделяне и коментар в групата ти носи точки. Избери ниво и виж какво
            отключваш.
          </p>
          <LevelPicker />

          <h3 className={`${display} mt-18 mb-3 text-4xl`}>И подарък на всеки 3 месеца</h3>
          <p className="mb-6 max-w-2xl text-[19px] text-ink-soft">
            Неща с логото на клуба, които не се продават никъде. Има ги само членките.
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GIFTS.map(([when, what]) => (
              <li key={when} className="rounded-2xl bg-sand p-6">
                <span className={chip}>{when}</span>
                <p className={`${display} mt-3.5 text-[28px]`}>{what}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Митове */}
        <section className="bg-ink py-24 text-white">
          <div className={wrap}>
            <h2 className={`${display} mb-9 text-4xl sm:text-[56px]`}>
              Това, което ти казваш на себе си
            </h2>
            <Myths />
          </div>
        </section>

        {/* Оферта */}
        <section id="oferta" className="scroll-mt-4 bg-powder-light py-24">
          <div className={wrap}>
            <p className="mb-3.5">
              <span className={`${chip} bg-white`}>Записването затваря на 21 ноември</span>
            </p>
            <h2 className={`${display} mb-4 text-[40px] sm:text-[80px]`}>Стани основателка</h2>
            <p className="mb-7 max-w-3xl text-xl">
              Редовната цена на клуба е €29 на месец. Основателките я заключват по-ниско за цели 12
              месеца.
            </p>
            <CountdownTiles />
            <OfferPicker />
            <p className="mt-7 max-w-4xl">
              Във всеки план: тренировка всеки делничен ден, три нива на трудност, „Първите 14 дни“
              с общ старт, групата на членките, Аксения на живо всяка седмица (и на запис), рецепти
              за 15 минути, месечно измерване, нива и подаръци.
            </p>
            <p className="mt-3 text-[15px] text-ink-soft">
              Плащане с карта, Apple Pay или Google Pay. Абонаментът се подновява сам. Ако ти трябва
              почивка, го паузираш за месец и пазиш цената.
            </p>
          </div>
        </section>

        {/* Гаранция */}
        <section className={`${wrap} py-24`}>
          <div className="grid items-start gap-5 rounded-2xl bg-sand p-8 sm:p-10 lg:grid-cols-12">
            <h2 className={`${display} text-4xl sm:text-[56px] lg:col-span-5`}>
              14 дни
              <br />
              гаранция
            </h2>
            <div className="flex flex-col gap-3.5 lg:col-span-6 lg:col-start-7">
              <p className="text-2xl leading-snug font-semibold">
                Тренирай 10 от първите 14 дни. Ако не се чувстваш по-силна, пишеш ни и ти връщаме
                парите.
              </p>
              <p className="text-[19px] text-ink-soft">
                Без формуляри и без обяснения. Рискът е наш.
              </p>
            </div>
          </div>
        </section>

        {/* Въпроси */}
        <section className={`${wrap} pb-24`}>
          <h2 className={`${display} mb-5 text-[40px]`}>Въпроси</h2>
          <div className="max-w-4xl">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-t border-line py-5 last:border-b">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 rounded-lg text-xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span
                    aria-hidden
                    className="text-[28px] leading-none font-extrabold text-rose-deep"
                  >
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">×</span>
                  </span>
                </summary>
                <p className="mt-3.5 text-ink-soft">
                  <strong className="text-ink">{f.lead}</strong> {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Финал */}
        <section className="bg-ink pt-26 pb-22 text-white">
          <div className={wrap}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-[#1E1E1E] p-6">
                <p className="mb-2.5 text-base font-semibold text-[#9A9893]">Едната възможност</p>
                <p className="text-xl text-[#BDBBB4]">
                  Затваряш страницата с „ще започна от понеделник“. След месец пак гледаш старата
                  снимка и пак търсиш тренировки в единайсет вечерта.
                </p>
              </div>
              <div className="rounded-2xl bg-[#1E1E1E] p-6">
                <p className="mb-2.5">
                  <span className={chip}>Другата</span>
                </p>
                <p className="text-xl">
                  Влизаш днес. На 23 ноември тренираш заедно със стотици жени и за първи път не си
                  сама в това.
                </p>
              </div>
            </div>
            <p className={`${display} mt-18 mb-7 text-5xl sm:text-[96px]`}>I AM STRONG</p>
            <Link href="/start" className={`${cta} bg-white text-ink hover:bg-sand`}>
              Искам място <span aria-hidden>→</span>
            </Link>
            <p className="mt-4 text-[15px] text-[#9A9893]">
              €14,90 на месец за първите 50 · 14 дни гаранция · затваря на 21.11
            </p>
            <footer className="mt-16 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#9A9893]">
              {/* Plain text until the legal pages exist; then these become <Link>s. */}
              <span>Политика за поверителност</span>
              <span>Общи условия</span>
              <a
                href={`mailto:${brand.supportEmail}`}
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                {brand.supportEmail}
              </a>
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                Вход за членки
              </Link>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
