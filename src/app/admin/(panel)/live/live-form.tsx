"use client";

import { ActionForm } from "@/components/admin/action-form";
import { Field, inputClass } from "@/components/ui/field";
import { utcToZoned } from "@/lib/admin/time";
import type { AdminLiveSession } from "@/server/live/admin";
import { deleteLiveAction, saveLiveAction } from "./actions";

/** Create or edit one session. Date and time are Europe/Sofia. */
export function LiveForm({ session }: { session: AdminLiveSession | null }) {
  const at = session ? utcToZoned(session.startsAt) : null;
  return (
    <div className="space-y-4">
      <ActionForm
        action={saveLiveAction.bind(null, session?.id ?? null)}
        submitLabel={session ? "Запази" : "Създай сесия"}
        successMessage="Запазено ✓"
        resetOnSuccess={!session}
        className="grid gap-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <Field label="Заглавие">
            <input
              name="title"
              required
              maxLength={120}
              defaultValue={session?.title}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Дата">
          <input name="date" type="date" required defaultValue={at?.date} className={inputClass} />
        </Field>
        <Field label="Час (София)">
          <input name="time" type="time" required defaultValue={at?.time} className={inputClass} />
        </Field>
        <Field label="Продължителност (мин)">
          <input
            name="durationMin"
            type="number"
            min={15}
            max={180}
            step={5}
            required
            defaultValue={session?.durationMin ?? 60}
            className={inputClass}
          />
        </Field>
        <Field label="Линк за влизане (Zoom / YouTube)">
          <input
            name="joinUrl"
            type="url"
            required
            placeholder="https://"
            defaultValue={session?.joinUrl}
            className={inputClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Описание (по избор)">
            <textarea
              name="description"
              rows={2}
              maxLength={1000}
              defaultValue={session?.description}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Запис (по избор, след сесията)">
          <input
            name="recordingUrl"
            type="url"
            placeholder="https://"
            defaultValue={session?.recordingUrl ?? ""}
            className={inputClass}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-3 self-end text-sm font-semibold">
          <input
            name="published"
            type="checkbox"
            defaultChecked={session?.published ?? true}
            className="size-4 accent-ink"
          />
          Публикувана (видима за клиентките)
        </label>
      </ActionForm>
      {session && (
        <ActionForm
          action={async () => deleteLiveAction(session.id)}
          submitLabel="Изтрий сесията"
          submitVariant="secondary"
          successMessage="Изтрита ✓"
          confirmMessage="Да изтрием тази сесия? Сесия с отбелязани присъствия не може да се трие — махни публикуването."
        >
          <span />
        </ActionForm>
      )}
    </div>
  );
}
