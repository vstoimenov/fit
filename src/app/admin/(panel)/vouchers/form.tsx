"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { Field, inputClass } from "@/components/ui/field";
import { issueVoucherAction } from "./actions";

/** The owner issues a free voucher; the code is shown once here and stays in the list. */
export function IssueVoucherForm() {
  const [issued, setIssued] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <ActionForm
        action={async (prev, form) => {
          const result = await issueVoucherAction(prev, form);
          if (result.ok) setIssued((result.data as { code: string }).code);
          return result;
        }}
        submitLabel="Издай ваучер"
        successMessage="Издаден ✓"
        resetOnSuccess
        className="grid gap-4 sm:grid-cols-3"
      >
        <Field label="Месеци">
          <select name="months" defaultValue="1" className={inputClass}>
            <option value="1">1 месец</option>
            <option value="3">3 месеца</option>
            <option value="12">12 месеца</option>
          </select>
        </Field>
        <Field label="За кого (по избор)">
          <input name="recipientName" maxLength={60} className={inputClass} />
        </Field>
        <Field label="Бележка (по избор)">
          <input
            name="note"
            maxLength={200}
            placeholder="напр. томбола октомври"
            className={inputClass}
          />
        </Field>
      </ActionForm>
      {issued && (
        <p className="rounded-xl bg-powder-light px-4 py-3 font-semibold" role="status">
          Код: <span className="tracking-[0.08em]">{issued}</span>
        </p>
      )}
    </div>
  );
}
