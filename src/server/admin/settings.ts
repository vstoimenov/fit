import { z } from "zod";
import { AppError } from "@/lib/app-error";
import { parseSetting, SETTINGS, type SettingKey, type Settings } from "@/lib/admin/settings";
import type { TypedClient } from "@/server/db/types";

/** Every setting, with the default for anything missing or no longer valid. */
export async function getSettings(db: TypedClient): Promise<Settings> {
  const { data, error } = await db.from("settings").select("key, value");
  if (error) throw new Error(`load settings failed: ${error.message}`);
  const stored = new Map(data.map((r) => [r.key, r.value]));
  const keys = Object.keys(SETTINGS) as SettingKey[];
  return Object.fromEntries(keys.map((k) => [k, parseSetting(k, stored.get(k))])) as Settings;
}

/** Payment providers that can actually take payments; the rest are shown as disabled options. */
const ENABLED_PROVIDERS: ReadonlySet<string> = new Set(["stripe"]);

/** Validates against the setting's schema before writing; a bad value throws and stores nothing. */
export async function saveSetting<K extends SettingKey>(
  db: TypedClient,
  key: K,
  raw: unknown,
): Promise<void> {
  const value = SETTINGS[key].parse(raw);
  if (key === "payment_provider") {
    const { provider } = value as Settings["payment_provider"];
    if (!ENABLED_PROVIDERS.has(provider)) {
      throw new AppError("INVALID", "Този доставчик на плащания още не е наличен.");
    }
  }
  const { error } = await db.from("settings").upsert({ key, value });
  if (error) throw new Error(`save setting failed: ${error.message}`);
}

export const planInputSchema = z.object({
  name: z.string("Нужно е име").trim().min(1, "Нужно е име").max(60, "До 60 знака"),
  interval: z.enum(["month", "year"], "Избери период"),
  priceCents: z
    .number("Невалидна цена")
    .int("Невалидна цена")
    .min(1, "Цената трябва да е положителна")
    .max(1_000_000, "Цената е прекалено висока"),
  active: z.boolean(),
  sort: z
    .number("Невалиден ред")
    .int("Невалиден ред")
    .min(0, "От 0 до 100")
    .max(100, "От 0 до 100"),
  stripePriceId: z.union(
    [
      z.literal(""),
      z.string().regex(/^price_[A-Za-z0-9]+$/, "Stripe Price ID изглежда като price_…"),
    ],
    "Невалиден Stripe Price ID",
  ),
});

/** All plans, including inactive ones (plans are never deleted: subscriptions may point at them). */
export async function listPlans(db: TypedClient) {
  const { data, error } = await db
    .from("plans")
    .select("id, name, interval, price_cents, currency, active, sort, provider_price_ids")
    .order("sort")
    .order("name");
  if (error) throw new Error(`load plans failed: ${error.message}`);
  return data;
}

/** A Stripe price belongs to one plan: a second plan on the same price would make webhooks ambiguous. */
async function assertStripeIdFree(db: TypedClient, stripePriceId: string, exceptId: string | null) {
  if (!stripePriceId) return;
  let query = db.from("plans").select("id").eq("provider_price_ids->>stripe", stripePriceId);
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query.limit(1);
  if (error) throw new Error(`check stripe price failed: ${error.message}`);
  if (data.length > 0) {
    throw new AppError("CONFLICT", "Тази Stripe цена вече е свързана с друг план.");
  }
}

/**
 * Once a plan has a Stripe price id its amount and interval are frozen (Stripe prices are immutable;
 * a different price needs a new plan), and the id itself can change only while nobody subscribes to it.
 */
export async function savePlan(db: TypedClient, id: string | null, raw: unknown): Promise<void> {
  const p = planInputSchema.parse(raw);
  await assertStripeIdFree(db, p.stripePriceId, id);
  if (id) {
    const { data: current, error: loadError } = await db
      .from("plans")
      .select("price_cents, interval, provider_price_ids")
      .eq("id", id)
      .maybeSingle();
    if (loadError) throw new Error(`load plan failed: ${loadError.message}`);
    if (!current) throw new AppError("NOT_FOUND", "Планът не е намерен.");
    const ids = { ...(current.provider_price_ids as Record<string, string>) };
    if (ids.stripe && (current.price_cents !== p.priceCents || current.interval !== p.interval)) {
      throw new AppError(
        "CONFLICT",
        "Цената е свързана със Stripe — за нова цена създай нов план.",
      );
    }
    if (ids.stripe && p.stripePriceId !== ids.stripe) {
      const { count, error: countError } = await db
        .from("subscriptions")
        .select("user_id", { count: "exact", head: true })
        .eq("plan_id", id);
      if (countError) throw new Error(`count subscribers failed: ${countError.message}`);
      if ((count ?? 0) > 0) {
        throw new AppError("CONFLICT", "Планът има абонати — Stripe цената не може да се смени.");
      }
    }
    if (p.stripePriceId) ids.stripe = p.stripePriceId;
    else delete ids.stripe;
    const { data, error } = await db
      .from("plans")
      .update({
        name: p.name,
        interval: p.interval,
        price_cents: p.priceCents,
        active: p.active,
        sort: p.sort,
        provider_price_ids: ids,
      })
      .eq("id", id)
      .select("id");
    if (error) throw new Error(`save plan failed: ${error.message}`);
    if (data.length === 0) throw new AppError("NOT_FOUND", "Планът не е намерен.");
    return;
  }
  const { error } = await db.from("plans").insert({
    name: p.name,
    interval: p.interval,
    price_cents: p.priceCents,
    active: p.active,
    sort: p.sort,
    provider_price_ids: p.stripePriceId ? { stripe: p.stripePriceId } : {},
  });
  if (error) throw new Error(`save plan failed: ${error.message}`);
}
