import { Field, inputClass } from "@/components/ui/field";

export function WalkInFields() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Име">
        <input name="name" required minLength={2} maxLength={60} className={inputClass} />
      </Field>
      <Field label="Телефон">
        <input name="phone" type="tel" required className={inputClass} />
      </Field>
    </div>
  );
}
