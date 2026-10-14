import { z } from "zod";
import { EXPERIENCE, GOALS, PROBLEMS, TIMES, type Experience } from "@/lib/labels";
import type { Level } from "@/lib/program/types";

export const onboardingSchema = z
  .object({
    name: z.string().trim().min(1, "Как да те наричаме?").max(60),
    goal: z.enum(GOALS),
    problems: z.array(z.enum(PROBLEMS)).max(PROBLEMS.length),
    experience: z.enum(EXPERIENCE),
    heightCm: z
      .number()
      .int()
      .min(120, "Ръстът е между 120 и 230 см")
      .max(230, "Ръстът е между 120 и 230 см"),
    weightKg: z
      .number()
      .min(30, "Теглото е между 30 и 250 кг")
      .max(250, "Теглото е между 30 и 250 кг"),
    targetWeightKg: z.number().min(30).max(250),
    time: z.enum(TIMES),
    phone: z.union([
      z.literal(""),
      z
        .string()
        .trim()
        .regex(/^\+?[0-9 ]{8,16}$/, "Невалиден телефон"),
    ]),
    phoneCallConsent: z.boolean(),
    healthConsent: z.literal(true, { error: "Без това съгласие не можем да ти направим план." }),
    marketingConsent: z.boolean(),
  })
  .refine((a) => !a.phoneCallConsent || a.phone !== "", {
    path: ["phone"],
    message: "Остави телефон, за да можем да ти се обадим.",
  });

export type OnboardingAnswers = z.infer<typeof onboardingSchema>;

export function levelFromExperience(experience: Experience): Level {
  return experience === "never" ? "beginner" : experience === "sometimes" ? "advanced" : "pro";
}
