"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui/field";
import { grantPreview } from "@/lib/studio/format";
import { STUDIO_CARDS, type CardKind } from "@/lib/studio/rules";

/** Card type, start date and notebook visits, with the resulting end date and balance. */
export function GrantFields({ today }: { today: string }) {
  const [kind, setKind] = useState<CardKind>("card8");
  const [startsOn, setStartsOn] = useState(today);
  const [used, setUsed] = useState("0");
  const preview = grantPreview(kind, startsOn, Number(used || 0));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Карта">
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as CardKind)}
            className={inputClass}
          >
            {(Object.keys(STUDIO_CARDS) as CardKind[]).map((k) => (
              <option key={k} value={k}>
                {STUDIO_CARDS[k].label} — {STUDIO_CARDS[k].priceEur} €
              </option>
            ))}
          </select>
        </Field>
        <Field label="Начална дата">
          <input
            name="startsOn"
            type="date"
            required
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Вече използвани" hint="От тефтера, ако картата е стара.">
          <input
            name="usedBefore"
            type="number"
            min={0}
            max={STUDIO_CARDS[kind].visits - 1}
            value={used}
            onChange={(e) => setUsed(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      {preview && <p className="text-sm font-semibold">{preview}</p>}
    </div>
  );
}
