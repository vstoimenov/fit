"use client";

import { Plus, Sparkles, X } from "lucide-react";
import { useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/cn";
import { ALLERGEN_LABEL, ALLERGENS, MEAL_LABEL, MEAL_SLOTS } from "@/lib/nutrition/labels";
import {
  emptyMealForm,
  fillEmptyFields,
  mealToForm,
  type MealFormState,
} from "@/lib/nutrition/meal-form";
import type { Meal } from "@/lib/nutrition/meal-schema";
import { deleteMealAction, draftMealAction } from "./actions";

type FormAction = (
  prev: ActionResult<unknown> | null,
  form: FormData,
) => Promise<ActionResult<unknown>>;

const MAX_INGREDIENTS = 30;

/** A toggle chip: pressed = ink, otherwise sand. Always at least 44 px tall. */
function ToggleChip({
  pressed,
  onToggle,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        pressed ? "bg-ink text-white" : "bg-sand text-ink",
      )}
    >
      {children}
    </button>
  );
}

function toggled<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function MealForm({ action, meal }: { action: FormAction; meal?: Meal }) {
  const [form, setForm] = useState<MealFormState>(() =>
    meal ? mealToForm(meal) : emptyMealForm(),
  );
  const [notes, setNotes] = useState("");
  const [aiMessage, setAiMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [nextKey, setNextKey] = useState(1);
  const [aiPending, startAi] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [deleteMessage, setDeleteMessage] = useState("");

  const set = (patch: Partial<MealFormState>) => setForm((f) => ({ ...f, ...patch }));

  function fillWithAi() {
    setAiMessage(null);
    startAi(async () => {
      const result = await draftMealAction(form.title, notes);
      if (!result.ok) {
        setAiMessage({ ok: false, text: result.message });
        return;
      }
      // Read the latest state: she may have typed while the answer was on its way.
      setForm((current) => fillEmptyFields(current, result.data.draft));
      setAiMessage({
        ok: true,
        text: "Попълних празните полета — провери ги, преди да запазиш. Нищо не е публикувано.",
      });
    });
  }

  function setRow(key: string, patch: { name?: string; grams?: string }) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }));
  }

  function addRow() {
    setForm((f) => ({
      ...f,
      ingredients: [...f.ingredients, { key: `new-${nextKey}`, name: "", grams: "" }],
    }));
    setNextKey((n) => n + 1);
  }

  function removeRow(key: string) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((row) => row.key !== key) }));
  }

  function remove(id: string) {
    startDelete(async () => {
      const result = await deleteMealAction(id);
      if (!result.ok) setDeleteMessage(result.message);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <ActionForm action={action} submitLabel="Запази" className="space-y-6">
        <Field label="Име на ястието">
          <input
            name="title"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            required
            minLength={2}
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <section className="space-y-3 rounded-2xl bg-sand p-4">
          <Field
            label="Бележки за AI (по желание)"
            hint="Например: с кисело мляко и боровинки, без захар. AI попълва само празните полета долу."
          >
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={2}
              className={cn(inputClass, "h-auto bg-white py-3")}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="md" disabled={aiPending} onClick={fillWithAi}>
              <Sparkles size={16} aria-hidden="true" />
              {aiPending ? "Мисля…" : "Попълни с AI"}
            </Button>
            {aiMessage && (
              <p
                role={aiMessage.ok ? "status" : "alert"}
                className={cn("text-sm", aiMessage.ok ? "text-moss" : "text-brick")}
              >
                {aiMessage.text}
              </p>
            )}
          </div>
        </section>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Вид ястие</legend>
          <div className="flex flex-wrap gap-2">
            {MEAL_SLOTS.map((slot) => (
              <ToggleChip
                key={slot}
                pressed={form.mealTypes.includes(slot)}
                onToggle={() => set({ mealTypes: toggled(form.mealTypes, slot) })}
              >
                {MEAL_LABEL[slot]}
              </ToggleChip>
            ))}
          </div>
          {form.mealTypes.map((slot) => (
            <input key={slot} type="hidden" name="mealTypes" value={slot} />
          ))}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Съставки за една порция</legend>
          <ul className="space-y-2">
            {form.ingredients.map((row, i) => (
              <li key={row.key} className="flex items-center gap-2">
                <input
                  name="ingredientName"
                  value={row.name}
                  onChange={(e) => setRow(row.key, { name: e.target.value })}
                  aria-label={`Съставка ${i + 1}`}
                  placeholder="Съставка"
                  maxLength={80}
                  autoComplete="off"
                  className={cn(inputClass, "min-w-0 flex-1")}
                />
                <input
                  name="ingredientGrams"
                  value={row.grams}
                  onChange={(e) => setRow(row.key, { grams: e.target.value })}
                  aria-label={`Грамове за съставка ${i + 1}`}
                  placeholder="г"
                  inputMode="decimal"
                  autoComplete="off"
                  className={cn(inputClass, "w-24 shrink-0")}
                />
                <Button
                  variant="link"
                  size="md"
                  aria-label={`Махни съставка ${i + 1}`}
                  onClick={() => removeRow(row.key)}
                  className="w-11 shrink-0 justify-center no-underline"
                >
                  <X size={18} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="md"
            onClick={addRow}
            disabled={form.ingredients.length >= MAX_INGREDIENTS}
          >
            <Plus size={16} aria-hidden="true" />
            Добави съставка
          </Button>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Калории на порция (ккал)">
            <input
              name="kcal"
              value={form.kcal}
              onChange={(e) => set({ kcal: e.target.value })}
              inputMode="numeric"
              autoComplete="off"
              className={inputClass}
            />
          </Field>
          <Field label="Белтъчини (г)">
            <input
              name="proteinG"
              value={form.proteinG}
              onChange={(e) => set({ proteinG: e.target.value })}
              inputMode="decimal"
              autoComplete="off"
              className={inputClass}
            />
          </Field>
          <Field label="Въглехидрати (г)">
            <input
              name="carbsG"
              value={form.carbsG}
              onChange={(e) => set({ carbsG: e.target.value })}
              inputMode="decimal"
              autoComplete="off"
              className={inputClass}
            />
          </Field>
          <Field label="Мазнини (г)">
            <input
              name="fatG"
              value={form.fatG}
              onChange={(e) => set({ fatG: e.target.value })}
              inputMode="decimal"
              autoComplete="off"
              className={inputClass}
            />
          </Field>
        </div>

        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold">Подходящо за</legend>
          <p className="text-sm text-ink-soft">Които ядат всичко, получават всяко ястие.</p>
          {(
            [
              ["fitsVegetarian", "Вегетарианки"],
              ["fitsPescatarian", "Пескетарианки"],
              ["fitsVegan", "Веган"],
            ] as const
          ).map(([name, label]) => (
            <label key={name} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={name}
                checked={form[name]}
                onChange={(e) => set({ [name]: e.target.checked })}
                className="size-5"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Алергени</legend>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((code) => (
              <ToggleChip
                key={code}
                pressed={form.allergens.includes(code)}
                onToggle={() => set({ allergens: toggled(form.allergens, code) })}
              >
                {ALLERGEN_LABEL[code]}
              </ToggleChip>
            ))}
          </div>
          {form.allergens.map((code) => (
            <input key={code} type="hidden" name="allergens" value={code} />
          ))}
          <p className="text-sm text-ink-soft">Алергените отбелязваш ти — AI само предлага.</p>
        </fieldset>

        <Field label="Приготвяне (по желание)" hint="Markdown: **удебелено**, - списък, 1. стъпки.">
          <textarea
            name="steps"
            value={form.steps}
            onChange={(e) => set({ steps: e.target.value })}
            maxLength={10000}
            rows={10}
            className={cn(inputClass, "h-auto py-3")}
          />
        </Field>

        <Field
          label="Снимка (по желание)"
          hint="Линк, който започва с https://, или път /photos/име.jpg (без ? и интервали)"
        >
          <input
            name="photoUrl"
            value={form.photoUrl}
            onChange={(e) => set({ photoUrl: e.target.value })}
            maxLength={500}
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="published"
            checked={form.published}
            onChange={(e) => set({ published: e.target.checked })}
            className="size-5"
          />
          Публикувано — вижда се в менюто на абонатките
        </label>
      </ActionForm>

      {meal && (
        <section className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button
            variant="quiet"
            size="md"
            disabled={deletePending}
            className="text-brick"
            onClick={() => confirm("Да изтрия ли ястието?") && remove(meal.id)}
          >
            Изтрий
          </Button>
          {deleteMessage && (
            <p role="alert" className="text-sm text-brick">
              {deleteMessage}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
