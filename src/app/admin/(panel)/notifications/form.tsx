"use client";

import { ActionForm } from "@/components/admin/action-form";
import { Field, inputClass } from "@/components/ui/field";
import { sendBroadcastAction } from "./actions";

export function BroadcastForm() {
  return (
    <ActionForm
      action={sendBroadcastAction}
      submitLabel="Изпрати на всички"
      successMessage="Изпратено ✓"
      resetOnSuccess
      confirmMessage="Да изпратим известието на всички включили го клиентки?"
      className="space-y-4"
    >
      <fieldset className="space-y-4">
        <Field label="Заглавие (до 80 знака)">
          <input name="title" required maxLength={80} className={inputClass} />
        </Field>
        <Field label="Текст (до 200 знака)">
          <textarea name="body" required maxLength={200} rows={3} className={inputClass} />
        </Field>
        <Field label="Линк в приложението (по избор, напр. /app/learn)">
          <input name="url" placeholder="/app" className={inputClass} />
        </Field>
      </fieldset>
    </ActionForm>
  );
}
