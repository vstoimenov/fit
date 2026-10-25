"use client";

import { useRef, useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/cn";
import {
  growRows,
  parseDays,
  templateRows,
  templateWouldOverwrite,
  type TaskRow,
} from "@/lib/challenges/task-rows";
import type { AdminChallenge, WorkoutOption } from "@/server/admin/challenges";
import { deleteChallengeAction } from "./actions";

type FormAction = (
  prev: ActionResult<unknown> | null,
  form: FormData,
) => Promise<ActionResult<unknown>>;

const MIN_DAYS = 3;
const MAX_DAYS = 60;
const DEFAULT_DAYS = 14;

/** Keys first-0, first-1, … for the rows a new form starts with. */
function positionalKeys(): () => string {
  let n = 0;
  return () => `first-${n++}`;
}

export function ChallengeForm({
  action,
  challenge,
  workouts,
}: {
  action: FormAction;
  challenge?: AdminChallenge;
  workouts: WorkoutOption[];
}) {
  const locked = challenge?.hasParticipants ?? false;
  const [title, setTitle] = useState(challenge?.title ?? "");
  const [description, setDescription] = useState(challenge?.description ?? "");
  const [startDate, setStartDate] = useState(challenge?.startDate ?? "");
  const [daysText, setDaysText] = useState(String(challenge?.days ?? DEFAULT_DAYS));
  const [published, setPublished] = useState(challenge?.published ?? false);
  // Keys of rows added later; the first rows are keyed by position (a ref is not read while rendering).
  const nextKey = useRef(0);
  const newKey = () => `added-${nextKey.current++}`;
  // Every row ever shown: rows beyond the day count stay here (hidden, not submitted) with their text.
  const [rows, setRows] = useState<TaskRow[]>(() =>
    challenge
      ? challenge.tasks.map((t, i) => ({
          key: `first-${i}`,
          task: t.task,
          workoutId: t.workoutId ?? "",
        }))
      : growRows([], DEFAULT_DAYS, positionalKeys()),
  );
  // The last valid day count: while the field holds something unfinished the rows do not change.
  const [shownDays, setShownDays] = useState(challenge?.days ?? DEFAULT_DAYS);
  const [deletePending, startDelete] = useTransition();
  const [deleteMessage, setDeleteMessage] = useState("");

  const known = new Set(workouts.map((w) => w.id));

  function changeDays(text: string) {
    setDaysText(text);
    const n = parseDays(text);
    if (n === null) return;
    setShownDays(n);
    setRows(growRows(rows, n, newKey));
  }

  function fillTemplate() {
    if (
      templateWouldOverwrite(rows) &&
      !window.confirm("Шаблонът ще замени въведените задачи. Продължаваш ли?")
    )
      return;
    setDaysText(String(DEFAULT_DAYS));
    setShownDays(DEFAULT_DAYS);
    setRows(templateRows(rows, newKey));
    setTitle((current) => current || "Първите 14 дни");
  }

  function setRow(key: string, patch: Partial<TaskRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function remove(id: string) {
    startDelete(async () => {
      const result = await deleteChallengeAction(id);
      if (!result.ok) setDeleteMessage(result.message);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <ActionForm action={action} submitLabel="Запази" className="space-y-6">
        <Field label="Заглавие">
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={80}
            className={inputClass}
          />
        </Field>

        <Field
          label="Описание (по желание)"
          hint="Markdown: **удебелено**, - списък. Показва се на абонатките в началото на предизвикателството."
        >
          <textarea
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
            rows={6}
            className={cn(inputClass, "h-auto py-3")}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Начална дата" hint={locked ? "Вече има участнички" : undefined}>
            <input
              type="date"
              name="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min="2026-01-01"
              required
              readOnly={locked}
              className={cn(inputClass, locked && "opacity-60")}
            />
          </Field>
          <Field
            label="Брой дни (3–60)"
            hint={locked ? "Вече има участнички" : "Промяната добавя или маха редове долу."}
          >
            <input
              type="number"
              name="days"
              value={daysText}
              onChange={(e) => changeDays(e.target.value)}
              min={MIN_DAYS}
              max={MAX_DAYS}
              step={1}
              inputMode="numeric"
              required
              readOnly={locked}
              className={cn(inputClass, locked && "opacity-60")}
            />
          </Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Задачи по дни</legend>
          {!challenge && (
            <div>
              <Button variant="secondary" size="md" onClick={fillTemplate}>
                Шаблон: Първите 14 дни
              </Button>
            </div>
          )}
          <ol className="space-y-3">
            {rows.slice(0, shownDays).map((row, i) => (
              <li key={row.key} className="space-y-2 rounded-2xl bg-sand p-3">
                <p className="text-sm font-semibold">Ден {i + 1}</p>
                <input
                  name="task"
                  value={row.task}
                  onChange={(e) => setRow(row.key, { task: e.target.value })}
                  aria-label={`Задача за ден ${i + 1}`}
                  placeholder="Какво прави тя този ден?"
                  required
                  maxLength={200}
                  autoComplete="off"
                  className={cn(inputClass, "bg-white")}
                />
                <select
                  name="workoutId"
                  value={row.workoutId}
                  onChange={(e) => setRow(row.key, { workoutId: e.target.value })}
                  aria-label={`Тренировка за ден ${i + 1}`}
                  className={cn(inputClass, "bg-white")}
                >
                  <option value="">Без тренировка</option>
                  {row.workoutId && !known.has(row.workoutId) && (
                    <option value={row.workoutId}>Тренировка (вече не е публикувана)</option>
                  )}
                  {workouts.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ol>
        </fieldset>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="size-5"
          />
          Публикувано — вижда се от абонатките
        </label>
      </ActionForm>

      {challenge && (
        <section className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {locked ? (
            <p className="text-sm text-ink-soft">
              Само скриване — има участнички ({challenge.participants}). Махни отметката
              „Публикувано“ и запази.
            </p>
          ) : (
            <Button
              variant="quiet"
              size="md"
              disabled={deletePending}
              className="text-brick"
              onClick={() => confirm("Да изтрия ли предизвикателството?") && remove(challenge.id)}
            >
              Изтрий
            </Button>
          )}
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
