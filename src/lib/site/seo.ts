import { brand } from "@/lib/brand";
import { FAQ } from "@/lib/site/faq";

/**
 * Plain facts about the club for search engines and AI assistants (ChatGPT, Perplexity, Gemini,
 * Claude): the home page description, its schema.org JSON-LD, the „Накратко“ block and /llms.txt.
 * Only confirmed facts go here; prices come from the live `plans` table.
 */

type PricePlan = { interval: "month" | "year"; price_cents: number; currency: string };

export const CITY = "Плевен";
export const TRAINER = "Аксения Михайлова";

/** Who the club helps, in Аксения's voice. Shown on the home page and in /llms.txt. */
export const WHO_WE_HELP: readonly string[] = [
  "Помагам на заети жени и майки да тренират у дома по 20 минути на ден чрез онлайн клуб с нова видео тренировка всеки делничен ден.",
  "Помагам на жени 25–45 г., които не искат зала, да започнат и да не спират чрез план ден по ден, хранене с менюта и тренировка с мен на живо веднъж седмично.",
  "Помагам на жени, които се връщат след пауза, да се почувстват по-силни чрез кратки тренировки у дома и 14 дни гаранция.",
];

/** „39 €“, „280,80 €“: no decimals for whole euros. */
export function shortPrice(cents: number, currency = "EUR"): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** „39 € на месец или 280,80 € за година“; null while no plan is known (database unreachable). */
export function priceText(plans: readonly PricePlan[]): string | null {
  const month = plans.find((p) => p.interval === "month");
  const year = plans.find((p) => p.interval === "year");
  const parts = [
    month && `${shortPrice(month.price_cents, month.currency)} на месец`,
    year && `${shortPrice(year.price_cents, year.currency)} за година`,
  ].filter(Boolean);
  return parts.length ? parts.join(" или ") : null;
}

/** The home page description: what, for whom, how, price, guarantee, company and city. */
export function homeDescription(plans: readonly PricePlan[]): string {
  const price = priceText(plans);
  return [
    "Онлайн клуб на български за тренировки у дома за жени 25–45 г.: нова 20-минутна видео тренировка всеки делничен ден, хранене с менюта, общност и Аксения Михайлова на живо веднъж седмично.",
    price
      ? `Абонамент ${price}, 14 дни гаранция.`
      : "Месечен или годишен абонамент, 14 дни гаранция.",
    `${brand.operator.name}, гр. ${CITY}.`,
  ].join(" ");
}

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** The home page FAQ plus the price and „where“ answers that AI assistants are asked most. */
export function homeFaq(plans: readonly PricePlan[]): readonly { q: string; a: string }[] {
  const price = priceText(plans);
  const extra = [
    ...(price
      ? [
          {
            q: "Колко струва?",
            a: `${price.charAt(0).toUpperCase()}${price.slice(1)}. Във всяко членство е всичко: тренировки, хранене, общност и Аксения на живо. Спираш когато искаш, а първите 14 дни са с гаранция.`,
          },
        ]
      : []),
    {
      q: "Откъде е клубът и мога ли да тренирам от друг град?",
      a: `Клубът е онлайн и на български, така че тренираш у дома, където и да си. Зад него стои ${brand.operator.name}, гр. ${CITY}.`,
    },
  ];
  return [...FAQ, ...extra];
}

/** schema.org graph for the home page: the club, Аксения, the website and the two base offers. */
export function clubJsonLd({
  baseUrl,
  plans,
  instagramUrl,
}: {
  baseUrl: string;
  plans: readonly PricePlan[];
  instagramUrl: string | null;
}): object {
  const url = `${baseUrl.replace(/\/$/, "")}/`;
  const club = `${url}#club`;
  const person = `${url}#aksenia`;
  const offers = plans.map((p) => ({
    "@type": "Offer",
    name: p.interval === "month" ? "Месечно членство" : "Годишно членство",
    url: `${url}#ceni`,
    price: money(p.price_cents),
    priceCurrency: p.currency,
    availability: "https://schema.org/InStock",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: money(p.price_cents),
      priceCurrency: p.currency,
      billingDuration: p.interval === "month" ? "P1M" : "P1Y",
    },
    itemOffered: {
      "@type": "Service",
      name: "Онлайн тренировки у дома за жени – I AM STRONG",
      serviceType: "Онлайн фитнес клуб",
    },
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "ProfessionalService"],
        "@id": club,
        name: brand.name,
        alternateName: ["IAMSTRONG", "I AM STRONG клуб"],
        legalName: brand.operator.name,
        url,
        logo: `${url}pwa-icon/512`,
        image: `${url}opengraph-image`,
        description: homeDescription(plans),
        slogan: brand.tagline,
        email: brand.supportEmail,
        address: {
          "@type": "PostalAddress",
          addressLocality: CITY,
          addressCountry: "BG",
        },
        areaServed: { "@type": "Country", name: "България" },
        knowsLanguage: "bg",
        founder: { "@id": person },
        employee: { "@id": person },
        audience: {
          "@type": "PeopleAudience",
          audienceType: "Жени 25–45 г., заети жени и майки, които тренират у дома",
          suggestedGender: "female",
          suggestedMinAge: 25,
          suggestedMaxAge: 45,
        },
        ...(instagramUrl ? { sameAs: [instagramUrl] } : {}),
        ...(offers.length ? { makesOffer: offers } : {}),
      },
      {
        "@type": "Person",
        "@id": person,
        name: TRAINER,
        jobTitle: "Треньорка",
        worksFor: { "@id": club },
        ...(instagramUrl ? { sameAs: [instagramUrl] } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        url,
        name: brand.name,
        inLanguage: "bg",
        publisher: { "@id": club },
      },
    ],
  };
}

/** /llms.txt (llmstxt.org): a plain-markdown summary AI assistants can read in one request. */
export function llmsTxt({
  baseUrl,
  plans,
}: {
  baseUrl: string;
  plans: readonly PricePlan[];
}): string {
  const base = baseUrl.replace(/\/$/, "");
  const price = priceText(plans);
  const month = plans.find((p) => p.interval === "month");
  const year = plans.find((p) => p.interval === "year");
  const discount =
    month && year && year.price_cents < month.price_cents * 12
      ? Math.round((1 - year.price_cents / (month.price_cents * 12)) * 100)
      : null;
  return [
    `# ${brand.name}`,
    "",
    `> ${homeDescription(plans)}`,
    "",
    "## За кого е",
    "",
    ...WHO_WE_HELP.map((line) => `- ${TRAINER}: „${line}“`),
    "",
    "## Факти",
    "",
    "- Какво: онлайн клуб с абонамент за тренировки у дома за жени, на български език.",
    "- Тренировки: нова 20-минутна видео тренировка всеки делничен ден, три нива (начинаеща, напреднала, про), стартова седмица и план ден по ден. Без зала и без уреди.",
    "- Също: хранене с менюта, предизвикателства, общност на членките, Аксения на живо веднъж седмично (и на запис).",
    `- Треньорка: ${TRAINER}.`,
    price
      ? `- Цена: ${price}${discount ? ` (годишният план е с ${discount}% отстъпка спрямо 12 месечни плащания)` : ""}. Спираш абонамента когато искаш.`
      : "- Цена: месечен или годишен абонамент; вижте сайта.",
    "- Гаранция: 14 дни — тренираш 10 от първите 14 дни и ако не се чувстваш по-силна, връщаме парите.",
    "- Работи на телефон като приложение (PWA), без магазин за приложения.",
    "- Подаръчен ваучер: 1, 3 или 12 месеца.",
    `- Фирма: ${brand.operator.name}, ЕИК ${brand.operator.eik}, гр. ${CITY}, България.`,
    `- Контакт: ${brand.supportEmail}`,
    "",
    "## Страници",
    "",
    `- [Начало](${base}/): какво е клубът, цени, въпроси`,
    `- [Започни](${base}/start): записване`,
    `- [Подари](${base}/podari): подаръчен ваучер`,
    `- [Тренировки на място](${base}/zala): графикът на тренировките с Аксения в залата`,
    `- [Общи условия](${base}/terms)`,
    "",
    "## Въпроси",
    "",
    ...homeFaq(plans).flatMap(({ q, a }) => [`### ${q}`, "", a, ""]),
  ].join("\n");
}
