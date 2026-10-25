import { z } from "zod";
import { isDay } from "./calendar";

// Same shape the admin_save_challenge RPC accepts (any hex uuid, not only v4).
const WORKOUT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const challengeTaskSchema = z.object({
  task: z
    .string("Липсва задача")
    .trim()
    .min(1, "Задачата е между 1 и 200 символа")
    .max(200, "Задачата е между 1 и 200 символа"),
  workoutId: z.string().regex(WORKOUT_ID, "Невалидна тренировка").nullable(),
});

/** Admin input for a challenge: one task per day, the day count is 3..60 and the start is not before 2026. */
export const challengeInputSchema = z
  .object({
    title: z
      .string("Липсва заглавие")
      .trim()
      .min(3, "Заглавието трябва да е между 3 и 80 символа")
      .max(80, "Заглавието трябва да е между 3 и 80 символа"),
    description: z.string().max(4000, "Описанието е до 4 000 символа").default(""),
    startDate: z
      .string("Избери начална дата")
      .refine(isDay, "Невалидна дата")
      .refine((day) => day >= "2026-01-01", "Началната дата не може да е преди 1 януари 2026."),
    days: z
      .number("Въведи брой дни")
      .int("Дните са цяло число")
      .min(3, "Дните трябва да са между 3 и 60")
      .max(60, "Дните трябва да са между 3 и 60"),
    published: z.boolean("Липсва статус на публикуване"),
    tasks: z.array(challengeTaskSchema),
  })
  .superRefine((value, ctx) => {
    if (value.tasks.length !== value.days) {
      ctx.addIssue({
        code: "custom",
        path: ["tasks"],
        message: "Нужна е по една задача за всеки ден",
      });
    }
  });

export type ChallengeInput = z.infer<typeof challengeInputSchema>;
