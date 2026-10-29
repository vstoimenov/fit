import { Field, inputClass } from "@/components/ui/field";
import type { StudioSlot } from "@/server/studio/admin";

const DAYS = ["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"];

export function SlotFields({ slot }: { slot: StudioSlot | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Ден">
        <select name="weekday" defaultValue={slot?.weekday ?? 1} className={inputClass}>
          {DAYS.map((d, i) => (
            <option key={d} value={i + 1}>
              {d}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Час">
        <input
          name="startTime"
          type="time"
          required
          defaultValue={slot?.startTime ?? "18:00"}
          className={inputClass}
        />
      </Field>
      <Field label="Заглавие">
        <input
          name="title"
          required
          minLength={2}
          maxLength={80}
          defaultValue={slot?.title ?? "Кръгова тренировка"}
          className={inputClass}
        />
      </Field>
      <Field label="Места">
        <input
          name="capacity"
          type="number"
          min={1}
          max={100}
          required
          defaultValue={slot?.capacity ?? 12}
          className={inputClass}
        />
      </Field>
      <Field label="Продължителност (мин.)">
        <input
          name="durationMin"
          type="number"
          min={15}
          max={180}
          required
          defaultValue={slot?.durationMin ?? 60}
          className={inputClass}
        />
      </Field>
      <label className="flex min-h-11 items-center gap-3 self-end text-sm font-semibold">
        <input
          type="checkbox"
          name="active"
          defaultChecked={slot?.active ?? true}
          className="h-5 w-5"
        />
        Активна
      </label>
    </div>
  );
}
