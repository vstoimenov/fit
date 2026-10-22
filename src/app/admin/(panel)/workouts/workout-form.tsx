"use client";

import { useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { utcToZoned } from "@/lib/admin/time";
import type { ActionResult } from "@/lib/action-result";
import { FOCUS, FOCUS_LABEL, LEVEL_LABEL } from "@/lib/labels";
import type { AdminWorkout } from "@/server/admin/workouts";
import { deleteWorkoutAction, unpublishWorkoutAction } from "./actions";

type FormAction = (
  prev: ActionResult<unknown> | null,
  form: FormData,
) => Promise<ActionResult<unknown>>;

export function WorkoutForm({ action, workout }: { action: FormAction; workout?: AdminWorkout }) {
  const [kind, setKind] = useState(workout?.kind ?? "regular");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const when = workout?.publishAt ? utcToZoned(workout.publishAt) : null;

  function run(fn: () => Promise<ActionResult<null>>) {
    startTransition(async () => {
      const result = await fn();
      setMessage(result.ok ? "Готово ✓" : result.message);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <ActionForm action={action} submitLabel={workout ? "Запази" : "Създай"}>
        <Field label="Заглавие">
          <input
            name="title"
            defaultValue={workout?.title}
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>
        <Field label="Линк към видеото" hint="YouTube (скрит), Vimeo или Bunny">
          <input
            name="videoUrl"
            defaultValue={workout?.videoUrl ?? ""}
            required
            className={inputClass}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Вид">
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className={inputClass}
            >
              <option value="regular">Обикновена</option>
              <option value="starter">Стартова седмица</option>
              <option value="free">Безплатна</option>
            </select>
          </Field>
          {kind === "regular" && (
            <Field label="Ниво">
              <select
                name="level"
                defaultValue={workout?.level ?? "beginner"}
                className={inputClass}
              >
                {Object.entries(LEVEL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Минути">
            <input
              name="durationMin"
              type="number"
              min={1}
              max={180}
              step={1}
              defaultValue={workout?.durationMin ?? 30}
              required
              className={inputClass}
            />
          </Field>
        </div>
        <Field
          label="Само от ниво"
          hint="Ексклузивна тренировка: клиентките я гледат от това ниво точки нагоре."
        >
          <select
            name="minMemberLevel"
            defaultValue={workout?.minMemberLevel ?? ""}
            className={inputClass}
          >
            <option value="">Всички</option>
            {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                Ниво {n}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Зони</legend>
          <div className="flex flex-wrap gap-3">
            {FOCUS.map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="focus"
                  value={f}
                  defaultChecked={workout?.focus.includes(f)}
                />
                {FOCUS_LABEL[f]}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Описание (по желание)">
          <textarea
            name="description"
            defaultValue={workout?.description}
            maxLength={2000}
            rows={3}
            className={inputClass + " h-auto py-3"}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Дата на публикуване" hint="Празно = чернова. Време в София.">
            <input name="date" type="date" defaultValue={when?.date ?? ""} className={inputClass} />
          </Field>
          <Field label="Час">
            <input
              name="time"
              type="time"
              defaultValue={when?.time ?? "07:00"}
              className={inputClass}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked={workout?.notify ?? true} /> Изпрати
          известие при публикуване
        </label>
      </ActionForm>

      {workout && (
        <section className="flex flex-wrap gap-3 border-t border-line pt-4">
          <a
            href={`/app/workout/${workout.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline underline-offset-4"
          >
            Преглед като клиентка
          </a>
          {workout.publishAt && (
            <Button
              variant="quiet"
              size="md"
              disabled={pending}
              onClick={() =>
                (workout.completions === 0 ||
                  confirm("Тази тренировка вече е правена от клиентки. Да я скрия?")) &&
                run(() => unpublishWorkoutAction(workout.id))
              }
            >
              Скрий (чернова)
            </Button>
          )}
          {workout.completions === 0 && (
            <Button
              variant="quiet"
              size="md"
              disabled={pending}
              className="text-brick"
              onClick={() =>
                confirm("Да изтрия ли тренировката?") && run(() => deleteWorkoutAction(workout.id))
              }
            >
              Изтрий
            </Button>
          )}
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
