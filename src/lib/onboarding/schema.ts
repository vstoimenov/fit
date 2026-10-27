import { z } from "zod";
import { EXPERIENCE, GOALS, PROBLEMS, TIMES, type Experience } from "@/lib/labels";
import { nutritionAnswersSchema } from "@/lib/nutrition/schema";
import { sofiaToday } from "@/lib/progress-photos/today";
import type { Level } from "@/lib/program/types";

/** Accepts how people actually type numbers ("0888-123-456", "(088) 8123456"); stores digits with an optional leading +. */
const phoneSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().replace(/[\s\-().]/g, "") : value),
  z.union([z.literal(""), z.string().regex(/^\+?[0-9]{8,15}$/, "Невалиден телефон")]),
);

/** Answers a member can correct after onboarding; the single source of ranges, labels and phone rules. */
const profileFields = {
  goal: z.enum(GOALS),
  problems: z.array(z.enum(PROBLEMS)).max(PROBLEMS.length),
  heightCm: z
    .number()
    .int()
    .min(120, "Ръстът е между 120 и 230 см")
    .max(230, "Ръстът е между 120 и 230 см"),
  weightKg: z
    .number()
    .min(30, "Теглото е между 30 и 250 кг")
    .max(250, "Теглото е между 30 и 250 кг"),
  targetWeightKg: z
    .number()
    .min(30, "Целта е между 30 и 250 кг")
    .max(250, "Целта е между 30 и 250 кг"),
  phone: phoneSchema,
  phoneCallConsent: z.boolean(),
  marketingConsent: z.boolean(),
};

/** Being called needs a number to call. */
const callConsentHasPhone = (a: { phone: string; phoneCallConsent: boolean }) =>
  !a.phoneCallConsent || a.phone !== "";
const callConsentNeedsPhone = {
  path: ["phone"],
  message: "Остави телефон, за да можем да ти се обадим.",
};

/** The sign-up screen asks for a phone first: required there, same normalization as everywhere else. */
export const contactStepSchema = z.object({
  phone: phoneSchema.refine((phone) => phone !== "", "Остави телефон, за да се свържем с теб."),
  phoneCallConsent: z.boolean(),
});

export type ContactStep = z.infer<typeof contactStepSchema>;

export const profileAnswersSchema = z
  .object(profileFields)
  .refine(callConsentHasPhone, callConsentNeedsPhone);

export type ProfileAnswers = z.infer<typeof profileAnswersSchema>;

/**
 * The nutrition answers, with the same enums and bounds as the diary. The factory's year ceiling is
 * moved out of reach here (it would freeze at module load); the real ceiling is checked when parsing.
 */
const nutritionFields = nutritionAnswersSchema(2100 + 16).shape;

/** She must be at least 16 this (Sofia) year; read when parsing, so it moves with the calendar. */
const birthYearIsOldEnough = (a: { birthYear: number }) =>
  a.birthYear <= Number(sofiaToday().slice(0, 4)) - 16;
const birthYearTooRecent = {
  path: ["birthYear"],
  error: () => `Годината на раждане е между 1940 и ${Number(sofiaToday().slice(0, 4)) - 16}`,
};

/** Just the nutrition screen: the wizard checks it before moving on, without judging the later screens. */
export const nutritionStepSchema = z
  .object(nutritionFields)
  .refine(birthYearIsOldEnough, birthYearTooRecent);

export const onboardingSchema = z
  .object({
    ...profileFields,
    ...nutritionFields,
    name: z.string().trim().min(1, "Как да те наричаме?").max(60),
    experience: z.enum(EXPERIENCE),
    time: z.enum(TIMES),
    healthConsent: z.literal(true, { error: "Без това съгласие не можем да ти направим план." }),
    /** IANA name from the browser; optional, and the database has the last word on its validity. */
    timezone: z.string().max(64).optional(),
  })
  .refine(callConsentHasPhone, callConsentNeedsPhone)
  .refine(birthYearIsOldEnough, birthYearTooRecent);

export type OnboardingAnswers = z.infer<typeof onboardingSchema>;

export function levelFromExperience(experience: Experience): Level {
  return experience === "never" ? "beginner" : experience === "sometimes" ? "advanced" : "pro";
}
