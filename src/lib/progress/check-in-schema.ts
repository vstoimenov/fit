import { z } from "zod";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const decimal = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => {
      const b = blankToUndefined(v);
      return typeof b === "string" ? Number(b.replace(",", ".")) : b;
    },
    z.number({ error: message }).min(min, message).max(max, message).optional(),
  );
const scale = z.preprocess((v) => {
  const b = blankToUndefined(v);
  return typeof b === "string" ? Number(b) : b;
}, z.number().int().min(1).max(5).optional());

export const checkInSchema = z
  .object({
    weight_kg: decimal(30, 250, "Теглото е между 30 и 250 кг"),
    waist_cm: decimal(40, 200, "Талията е между 40 и 200 см"),
    hips_cm: decimal(50, 220, "Ханшът е между 50 и 220 см"),
    energy: scale,
    mood: scale,
    note: z.preprocess(blankToUndefined, z.string().trim().max(500).optional()),
  })
  .transform(
    (v) =>
      Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) as Partial<typeof v>,
  )
  .refine((v) => Object.keys(v).length > 0, { message: "Попълни поне едно поле." });

export type CheckInInput = z.infer<typeof checkInSchema>;
