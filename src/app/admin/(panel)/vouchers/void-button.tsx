"use client";

import { ActionForm } from "@/components/admin/action-form";
import { voidVoucherAction } from "./actions";

export function VoidButton({ id, code }: { id: string; code: string }) {
  return (
    <ActionForm
      action={async () => voidVoucherAction(id)}
      submitLabel="Анулирай"
      submitVariant="secondary"
      submitAriaLabel={`Анулирай ваучер ${code}`}
      successMessage="Анулиран ✓"
      confirmMessage={`Да анулираме ваучер ${code}? Кодът повече няма да може да се активира.`}
      className="inline-block"
    >
      <span />
    </ActionForm>
  );
}
