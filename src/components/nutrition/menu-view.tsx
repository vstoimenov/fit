import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { formatGrams, formatNumber } from "@/lib/nutrition/format";
import { formatPortion, nextCandidate, scalePortion, SLOT_PLANS } from "@/lib/nutrition/menu";
import { menuTotals, slotLabel } from "@/lib/nutrition/menu-format";
import type { getMenuDay } from "@/server/nutrition/menu";
import { DishCard, type DishCardData } from "./dish-card";

export const ALLERGY_NOTE = "Провери етикетите на продуктите — при алергия бъди внимателна.";
const EMPTY_SLOT = "Менюто ти се подготвя — скоро ще има ястия за теб.";

/**
 * Today's menu: one card per slot, the day total and the notes. Only the first dish she has not eaten
 * yet gets the primary „Изядох го“, so the screen keeps one primary action.
 */
export function MenuView({
  data,
  day,
}: {
  data: Awaited<ReturnType<typeof getMenuDay>>;
  day: string;
}) {
  if (!data.hasAccess) {
    return (
      <section className="space-y-3 rounded-2xl bg-sand p-5">
        <p className="font-semibold">Менюто е достъпно с активен абонамент.</p>
        <Link href="/app/plan" className={`${buttonClass("primary", "md")} w-full`}>
          Виж плановете
        </Link>
      </section>
    );
  }

  // Slot count follows her meals per day; the engine always builds one slot per plan entry.
  const plan = SLOT_PLANS[data.slots.length as 3 | 4 | 5] ?? [];
  const firstOpen = data.slots.find((s) => s.pick && !data.eatenSlots.includes(s.slot))?.slot;
  const totals = menuTotals(data.slots);

  return (
    <div className="space-y-4">
      {data.usingDefaultTarget && (
        <p className="rounded-2xl bg-sand px-4 py-3 text-sm">
          Целта ти още не е изчислена — менюто е за {formatNumber(data.targetKcal)} ккал.
          <Link
            href="/app/profile"
            className="mt-1 flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            Отвори Профил
          </Link>
        </p>
      )}

      {totals.filled > 0 && (
        <section aria-label="Общо за деня" className="space-y-1 rounded-2xl p-4 ring-1 ring-line">
          <p className="font-extrabold">
            Общо ≈ {formatNumber(totals.kcal)} ккал от {formatNumber(data.targetKcal)}
          </p>
          <p className="text-xs text-ink-soft">
            белтъчини {formatGrams(totals.proteinG)} · въглехидрати {formatGrams(totals.carbsG)} ·
            мазнини {formatGrams(totals.fatG)}
          </p>
        </section>
      )}

      <div className="space-y-4">
        {data.slots.map((slot) => {
          const label = slotLabel(slot.meal, slot.slot, plan);
          if (!slot.pick) {
            return (
              <section
                key={slot.slot}
                aria-label={label}
                className="space-y-1 rounded-2xl bg-sand p-4"
              >
                <p className="text-xs font-semibold text-ink-soft">{label}</p>
                <p className="text-sm">{EMPTY_SLOT}</p>
              </section>
            );
          }
          const portion = scalePortion(slot.pick.meal, slot.pick.factor);
          const dish: DishCardData = {
            slot: slot.slot,
            label,
            mealId: slot.pick.meal.id,
            title: slot.pick.meal.title,
            photoUrl: slot.pick.meal.photoUrl,
            kcal: portion.kcal,
            proteinG: portion.proteinG,
            carbsG: portion.carbsG,
            fatG: portion.fatG,
            portion: formatPortion(slot.pick.factor),
            canSwap: nextCandidate(slot) !== null,
            eaten: data.eatenSlots.includes(slot.slot),
            primary: slot.slot === firstOpen,
          };
          return <DishCard key={slot.slot} day={day} dish={dish} />;
        })}
      </div>

      <p className="text-xs text-ink-soft">{ALLERGY_NOTE}</p>
    </div>
  );
}
