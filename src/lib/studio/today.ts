import { DROP_IN_PRICE_EUR } from "./rules";

type Entry = { card: unknown; attended: boolean };

/** „Дошли 5 от 8“ */
export const attendanceLine = (entries: Entry[]) =>
  `Дошли ${entries.filter((e) => e.attended).length} от ${entries.length}`;

/** What Аксения collects on site: the drop-ins who came × 7 €. Null when nobody pays on site. */
export function cashLine(entries: Entry[]): string | null {
  const dropIns = entries.filter((e) => e.card === null);
  if (dropIns.length === 0) return null;
  const came = dropIns.filter((e) => e.attended).length;
  return `${DROP_IN_PRICE_EUR} € на място: записани ${dropIns.length} · дошли ${came} = ${came * DROP_IN_PRICE_EUR} €`;
}

export const telHref = (phone: string) => `tel:${phone.replace(/\s+/g, "")}`;
