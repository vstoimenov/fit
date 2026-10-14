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
