import { DROP_IN_PRICE_EUR, STUDIO_CARDS, type CardKind } from "./rules";

/** The price comparison on /zala: per-training price, savings and how long a card lasts. */

export const eur = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} €`;

export const perTraining = (kind: CardKind) =>
  STUDIO_CARDS[kind].priceEur / STUDIO_CARDS[kind].visits;

/** What the card saves against paying 7 € each time. */
export const cardSavings = (kind: CardKind) =>
  STUDIO_CARDS[kind].visits * DROP_IN_PRICE_EUR - STUDIO_CARDS[kind].priceEur;

const weeksText = (n: number) => (n === 1 ? "1 седмица" : `${n} седмици`);

/** For `perWeek` trainings a week: how long the card lasts, or how many visits would expire. */
export function cardAdvice(kind: CardKind, perWeek: number): string {
  const { visits, weeks } = STUDIO_CARDS[kind];
  const used = Math.min(visits, perWeek * weeks);
  if (used < visits) {
    return `За ${weeksText(weeks)} ще използваш ${used} от ${visits} посещения, останалите изтичат.`;
  }
  const lasts = Math.ceil(visits / perWeek);
  return `Стига ти за ${weeksText(lasts)} · ${eur(perTraining(kind))} на тренировка · спестяваш ${eur(cardSavings(kind))}.`;
}

/** Paying 7 € each time for four weeks, and the card that would cost less. */
export function dropInAdvice(perWeek: number): string {
  const count = perWeek * 4;
  const head = `${count} тренировки за 4 седмици = ${eur(count * DROP_IN_PRICE_EUR)}.`;
  if (perWeek < 2) return `${head} Удобно, ако идваш от време на време.`;
  const kind: CardKind = perWeek >= 3 ? "card12" : "card8";
  const card = STUDIO_CARDS[kind];
  return `${head} С ${card.label} плащаш ${eur(card.priceEur)} за ${card.visits} тренировки и спестяваш ${eur(cardSavings(kind))}.`;
}
