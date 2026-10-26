import { z } from "zod";

const optionalId = (re: RegExp, message: string) => z.string().trim().regex(re, message);

export const SETTINGS = {
  risk: z.object({
    inactiveDays: z
      .number("Въведи брой дни")
      .int("Въведи цяло число")
      .min(1, "Поне 1 ден")
      .max(60, "До 60 дни"),
    minCompletionPct: z
      .number("Въведи процент")
      .int("Въведи цяло число")
      .min(0, "От 0 до 100")
      .max(100, "От 0 до 100"),
  }),
  payment_provider: z.object({ provider: z.enum(["stripe", "revolut"], "Избери доставчик") }),
  tracking: z.object({
    metaPixelId: optionalId(/^\d{0,20}$/, "Само цифри"),
    ga4Id: optionalId(/^(G-[A-Z0-9]{4,12})?$/, "Формат G-XXXXXXX"),
    gtmId: optionalId(/^(GTM-[A-Z0-9]{4,10})?$/, "Формат GTM-XXXXXX"),
    googleAdsId: optionalId(/^(AW-\d{6,12})?$/, "Формат AW-123456789"),
  }),
  email_templates: z.object({
    nudgeSubject: z.string().trim().min(1, "Нужна е тема").max(150),
    nudgeBody: z.string().trim().min(1, "Нужен е текст").max(4000),
  }),
  community_url: httpsUrlOrEmpty(),
  // Public site: the trainer's 60-second video and the Instagram profile (empty = hidden).
  trainer_video_url: httpsUrlOrEmpty(),
  instagram_url: httpsUrlOrEmpty(),
} as const;

function httpsUrlOrEmpty() {
  return z.union(
    [
      z.literal(""),
      z
        .string()
        .trim()
        .max(300, "До 300 знака")
        .regex(/^https:\/\/\S+$/, "Адресът трябва да започва с https://"),
    ],
    "Адресът трябва да започва с https://",
  );
}

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]>;
export type Settings = { [K in SettingKey]: SettingValue<K> };

export const SETTING_DEFAULTS: Settings = {
  risk: { inactiveDays: 5, minCompletionPct: 50 },
  payment_provider: { provider: "stripe" },
  tracking: { metaPixelId: "", ga4Id: "", gtmId: "", googleAdsId: "" },
  email_templates: {
    nudgeSubject: "Липсваш ни, {{name}}",
    nudgeBody:
      "Здравей, {{name}}!\n\nНе сме те виждали от няколко дни. Днешната тренировка те чака — 20 минути стигат.\n\nДо скоро!",
  },
  community_url: "",
  trainer_video_url: "",
  instagram_url: "",
};

export function parseSetting<K extends SettingKey>(key: K, raw: unknown): SettingValue<K> {
  const parsed = SETTINGS[key].safeParse(raw);
  return (parsed.success ? parsed.data : SETTING_DEFAULTS[key]) as SettingValue<K>;
}

export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    Object.hasOwn(vars, name) ? vars[name]! : match,
  );
}
