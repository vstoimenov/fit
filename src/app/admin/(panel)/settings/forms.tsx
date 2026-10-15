"use client";

import { ActionForm } from "@/components/admin/action-form";
import { Field, inputClass } from "@/components/ui/field";
import type { Settings } from "@/lib/admin/settings";
import {
  savePlanAction,
  saveProviderAction,
  saveRiskAction,
  saveTemplatesAction,
  saveTrackingAction,
} from "./actions";

type Plan = {
  id: string;
  name: string;
  interval: "month" | "year";
  price_cents: number;
  active: boolean;
  sort: number;
};

function PlanForm({ plan }: { plan?: Plan }) {
  return (
    <ActionForm
      action={savePlanAction.bind(null, plan?.id ?? null)}
      submitLabel={plan ? "Запази" : "Добави план"}
      resetOnSuccess={!plan}
      className="grid items-end gap-2 rounded-xl bg-paper p-3 sm:grid-cols-[minmax(0,2fr)_7.5rem_minmax(0,1fr)_5rem_auto_7rem]"
    >
      <Field label="Име">
        <input name="name" defaultValue={plan?.name} required className={inputClass + " h-11"} />
      </Field>
      <Field label="Период">
        <select
          name="interval"
          defaultValue={plan?.interval ?? "month"}
          className={inputClass + " h-11"}
        >
          <option value="month">Месец</option>
          <option value="year">Година</option>
        </select>
      </Field>
      <Field label="Цена €">
        <input
          name="price"
          title="Промяната на цена/период важи и за текущите абонати в MRR."
          inputMode="decimal"
          defaultValue={plan ? (plan.price_cents / 100).toFixed(2) : ""}
          required
          className={inputClass + " h-11"}
        />
      </Field>
      <Field label="Ред">
        <input
          name="sort"
          type="number"
          min={0}
          max={100}
          defaultValue={plan?.sort ?? 0}
          className={inputClass + " h-11"}
        />
      </Field>
      <label className="flex items-center gap-2 pb-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={plan?.active ?? true} /> Активен
      </label>
    </ActionForm>
  );
}

export function SettingsForms({ settings, plans }: { settings: Settings; plans: Plan[] }) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-semibold">Планове и цени</h2>
        <p className="text-sm text-ink-soft">
          Плановете не се трият — изключи „Активен“, за да спре да се предлага. Свързването със
          Stripe/Revolut идва в 1C. Промяната на цена/период важи и за текущите абонати в MRR.
        </p>
        {plans.map((p) => (
          <PlanForm key={p.id} plan={p} />
        ))}
        <PlanForm />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Доставчик на плащания</h2>
        <ActionForm
          action={saveProviderAction}
          submitLabel="Запази"
          className="flex flex-wrap items-end gap-2"
        >
          <select
            name="provider"
            defaultValue={settings.payment_provider.provider}
            aria-label="Доставчик на плащания"
            className={inputClass + " h-11 max-w-xs"}
          >
            <option value="stripe">Stripe</option>
            <option value="revolut">Revolut</option>
          </select>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Проследяване (ID-та)</h2>
        <p className="text-sm text-ink-soft">
          Тайните ключове (CAPI token, GA4 secret) се пазят в настройките на сървъра, не тук.
        </p>
        <ActionForm
          action={saveTrackingAction}
          submitLabel="Запази"
          className="grid gap-2 sm:grid-cols-2"
        >
          <Field label="Meta Pixel ID">
            <input
              name="metaPixelId"
              defaultValue={settings.tracking.metaPixelId}
              className={inputClass}
            />
          </Field>
          <Field label="GA4 ID">
            <input
              name="ga4Id"
              defaultValue={settings.tracking.ga4Id}
              placeholder="G-XXXXXXX"
              className={inputClass}
            />
          </Field>
          <Field label="GTM ID">
            <input
              name="gtmId"
              defaultValue={settings.tracking.gtmId}
              placeholder="GTM-XXXXXX"
              className={inputClass}
            />
          </Field>
          <Field label="Google Ads ID">
            <input
              name="googleAdsId"
              defaultValue={settings.tracking.googleAdsId}
              placeholder="AW-123456789"
              className={inputClass}
            />
          </Field>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Прагове за „Изостават“</h2>
        <ActionForm
          action={saveRiskAction}
          submitLabel="Запази"
          className="flex flex-wrap items-end gap-2"
        >
          <Field label="Дни без тренировка">
            <input
              name="inactiveDays"
              type="number"
              min={1}
              max={60}
              defaultValue={settings.risk.inactiveDays}
              className={inputClass + " h-11 w-28"}
            />
          </Field>
          <Field label="Минимален % за 14 дни">
            <input
              name="minCompletionPct"
              type="number"
              min={0}
              max={100}
              defaultValue={settings.risk.minCompletionPct}
              className={inputClass + " h-11 w-28"}
            />
          </Field>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Имейл „Липсваш ни“</h2>
        <p className="text-sm text-ink-soft">Използвай {"{{name}}"} за името на клиентката.</p>
        <ActionForm action={saveTemplatesAction} submitLabel="Запази">
          <Field label="Тема">
            <input
              name="nudgeSubject"
              defaultValue={settings.email_templates.nudgeSubject}
              maxLength={150}
              className={inputClass}
            />
          </Field>
          <Field label="Текст">
            <textarea
              name="nudgeBody"
              defaultValue={settings.email_templates.nudgeBody}
              rows={6}
              maxLength={4000}
              className={inputClass + " h-auto py-3"}
            />
          </Field>
        </ActionForm>
      </section>
    </div>
  );
}
