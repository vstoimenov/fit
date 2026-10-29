import { formatDateBg } from "@/lib/admin/time";
import { cardLine, cardWarning, dayMonth, DROP_IN_PRICE_EUR } from "@/lib/studio/rules";
import type { CardAdjustment, StudioCard } from "@/server/studio/booking";

/** Her card as Аксения would read it from the notebook, plus every reason her count changed. */
export function MyCard({
  card,
  adjustments,
  today,
}: {
  card: StudioCard | null;
  adjustments: CardAdjustment[];
  today: string;
}) {
  if (!card) {
    return (
      <div className="rounded-2xl bg-sand p-5">
        <p className="font-semibold">Нямаш карта.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Еднократна тренировка: {DROP_IN_PRICE_EUR} € на място. Карта 8 или Карта 12 купуваш от
          Аксения в залата.
        </p>
      </div>
    );
  }
  const ended = card.endsOn < today;
  const warning = cardWarning(card, today);
  const mine = adjustments.filter((a) => a.cardId === card.id);
  return (
    <div className="space-y-3 rounded-2xl bg-ink p-5 text-white">
      <p className="text-lg font-bold">{cardLine(card)}</p>
      {ended && <p className="text-sm text-white/80">Картата е изтекла. Поднови я при Аксения.</p>}
      {warning === "low" && (
        <p className="rounded-xl bg-white/10 px-3 py-2 text-sm">
          Остава ти 1 посещение. Поднови картата при Аксения.
        </p>
      )}
      {warning === "expiring" && (
        <p className="rounded-xl bg-white/10 px-3 py-2 text-sm">
          Картата ти изтича на {dayMonth(card.endsOn)}.
        </p>
      )}
      <ul className="space-y-1 text-sm text-white/80">
        <li>Валидна от {formatDateBg(card.startsOn)}</li>
        {card.usedBefore > 0 && <li>Пренесени от тефтера: {card.usedBefore}</li>}
        <li>Записвания по картата: {card.booked}</li>
        {mine.map((a) => (
          <li key={a.createdAt + a.reason}>
            Корекция {a.delta > 0 ? `+${a.delta}` : `−${-a.delta}`}: {a.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
