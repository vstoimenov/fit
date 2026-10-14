import { z } from "zod";
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

/** Validates against the setting's schema before writing; a bad value throws and stores nothing. */
export async function saveSetting<K extends SettingKey>(
  db: TypedClient,
  key: K,
  raw: unknown,
): Promise<void> {
  const value = SETTINGS[key].parse(raw);
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
});

/** All plans, including inactive ones (plans are never deleted: subscriptions may point at them). */
export async function listPlans(db: TypedClient) {
  const { data, error } = await db
    .from("plans")
    .select("id, name, interval, price_cents, currency, active, sort")
    .order("sort")
    .order("name");
  if (error) throw new Error(`load plans failed: ${error.message}`);
  return data;
}

export async function savePlan(db: TypedClient, id: string | null, raw: unknown): Promise<void> {
  const p = planInputSchema.parse(raw);
  const row = {
    name: p.name,
    interval: p.interval,
    price_cents: p.priceCents,
    active: p.active,
    sort: p.sort,
  };
  const { error } = id
    ? await db.from("plans").update(row).eq("id", id)
    : await db.from("plans").insert(row);
  if (error) throw new Error(`save plan failed: ${error.message}`);
}
