"use client";

import { useId } from "react";
import { ChoiceList } from "@/components/onboarding/steps";
import { Field, inputOnCardClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  ACTIVITY_LABEL,
  ACTIVITY_LEVELS,
  ALLERGEN_LABEL,
  ALLERGENS,
  DIET_LABEL,
  DIETS,
  type ActivityLevel,
  type Allergen,
  type Diet,
} from "@/lib/nutrition/labels";
import { sofiaToday } from "@/lib/progress-photos/today";

const MEALS_PER_DAY = [3, 4, 5] as const;

/** What the nutrition questions edit. Choices stay undefined until she answers. */
export interface NutritionValues {
  birthYear?: number;
  activity?: ActivityLevel;
  diet?: Diet;
  allergens: Allergen[];
  avoidFoods: string;
  mealsPerDay: 3 | 4 | 5;
}

/** The nutrition questions, controlled. Shared by the onboarding screen and the saved-answers form. */
export function NutritionFields({
  value,
  onChange,
  errors = {},
}: {
  value: NutritionValues;
  onChange: (patch: Partial<NutritionValues>) => void;
  errors?: Record<string, string>;
}) {
  const ids = useId();
  const activityId = `${ids}-activity`;
  const dietId = `${ids}-diet`;
  const allergensId = `${ids}-allergens`;
  const mealsId = `${ids}-meals`;
  const maxBirthYear = Number(sofiaToday().slice(0, 4)) - 16;

  function toggleAllergen(allergen: Allergen) {
    const on = value.allergens.includes(allergen);
    onChange({
      allergens: on
        ? value.allergens.filter((a) => a !== allergen)
        : ALLERGENS.filter((a) => a === allergen || value.allergens.includes(a)),
    });
  }

  return (
    <div className="space-y-6">
      <Field label="Година на раждане" error={errors.birthYear}>
        <input
          name="birthYear"
          type="number"
          inputMode="numeric"
          min={1940}
          max={maxBirthYear}
          autoComplete="bday-year"
          value={value.birthYear ?? ""}
          onChange={(e) =>
            onChange({ birthYear: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          className={inputOnCardClass}
        />
      </Field>

      <div className="space-y-2">
        <p id={activityId} className="text-sm font-semibold">
          Колко се движиш през деня?
        </p>
        <ChoiceList
          name="activity"
          labelledBy={activityId}
          options={ACTIVITY_LEVELS}
          labels={ACTIVITY_LABEL}
          value={value.activity}
          onChange={(v) => onChange({ activity: v as ActivityLevel })}
        />
        {errors.activity && <p className="text-sm text-brick">{errors.activity}</p>}
      </div>

      <div className="space-y-2">
        <p id={dietId} className="text-sm font-semibold">
          Как се храниш?
        </p>
        <ChoiceList
          name="diet"
          labelledBy={dietId}
          options={DIETS}
          labels={DIET_LABEL}
          value={value.diet}
          onChange={(v) => onChange({ diet: v as Diet })}
        />
        {errors.diet && <p className="text-sm text-brick">{errors.diet}</p>}
      </div>

      <div className="space-y-2">
        <p id={allergensId} className="text-sm font-semibold">
          Алергии и непоносимости
        </p>
        <p className="text-sm text-ink-soft">Избери всичко, което важи за теб.</p>
        <div role="group" aria-labelledby={allergensId} className="flex flex-wrap gap-2">
          {ALLERGENS.map((allergen) => {
            const on = value.allergens.includes(allergen);
            return (
              <button
                key={allergen}
                type="button"
                aria-pressed={on}
                onClick={() => toggleAllergen(allergen)}
                className={cn(
                  "min-h-11 rounded-full border-[1.5px] px-4 text-sm font-semibold text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  on ? "border-ink bg-powder-light" : "border-line bg-white",
                )}
              >
                {ALLERGEN_LABEL[allergen]}
              </button>
            );
          })}
        </div>
        {value.allergens.map((a) => (
          <input key={a} type="hidden" name="allergens" value={a} />
        ))}
        {errors.allergens && <p className="text-sm text-brick">{errors.allergens}</p>}
      </div>

      <Field label="Храни, които не ям" hint="По желание. До 200 знака." error={errors.avoidFoods}>
        <textarea
          name="avoidFoods"
          rows={3}
          maxLength={200}
          value={value.avoidFoods}
          onChange={(e) => onChange({ avoidFoods: e.target.value })}
          className={cn(inputOnCardClass, "h-auto min-h-24 resize-none py-3")}
        />
      </Field>

      <div className="space-y-2">
        <p id={mealsId} className="text-sm font-semibold">
          Колко пъти на ден се храниш?
        </p>
        <div role="radiogroup" aria-labelledby={mealsId} className="flex gap-2">
          {MEALS_PER_DAY.map((n) => {
            const on = value.mealsPerDay === n;
            return (
              <label
                key={n}
                className={cn(
                  "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border-[1.5px] text-base font-semibold text-ink transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                  on ? "border-ink bg-powder-light" : "border-line bg-white",
                )}
              >
                <input
                  type="radio"
                  name="mealsPerDay"
                  value={n}
                  checked={on}
                  onChange={() => onChange({ mealsPerDay: n })}
                  className="sr-only"
                />
                {n}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
