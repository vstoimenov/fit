"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverEnv } from "@/env";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { formBool, formList, formString } from "@/lib/form-data";
import { mealInputSchema, type MealDraft } from "@/lib/nutrition/meal-schema";
import { deleteMeal, saveMeal } from "@/server/admin/meals";
import { requireAdmin } from "@/server/admin/require-admin";
import { createClaudeMealDrafter, MealDraftFailed } from "@/server/nutrition/meal-drafter";

const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_NOTES = 1000;

const idSchema = z.uuid();

function validId(id: string): string {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw new AppError("INVALID", "Невалидно ястие.");
  return parsed.data;
}

/** A decimal typed with a comma or a dot; empty or unreadable is NaN, which the schema reports. */
function formNumber(form: FormData, key: string): number {
  return numberOf(formString(form, key));
}

function numberOf(raw: string): number {
  return /^-?\d+([.,]\d+)?$/.test(raw) ? Number(raw.replace(",", ".")) : Number.NaN;
}

function readMeal(form: FormData) {
  const names = form.getAll("ingredientName").map((v) => (typeof v === "string" ? v.trim() : ""));
  const grams = form.getAll("ingredientGrams").map((v) => (typeof v === "string" ? v.trim() : ""));
  // A row left completely empty is dropped; a half-filled one stays so the schema can name the gap.
  const ingredients = names
    .map((name, i) => ({ name, rawGrams: grams[i] ?? "" }))
    .filter((row) => row.name !== "" || row.rawGrams !== "")
    .map((row) => ({ name: row.name, grams: numberOf(row.rawGrams) }));

  return {
    title: formString(form, "title"),
    mealTypes: formList(form, "mealTypes"),
    ingredients,
    kcal: formNumber(form, "kcal"),
    proteinG: formNumber(form, "proteinG"),
    carbsG: formNumber(form, "carbsG"),
    fatG: formNumber(form, "fatG"),
    fitsVegetarian: formBool(form, "fitsVegetarian"),
    fitsVegan: formBool(form, "fitsVegan"),
    fitsPescatarian: formBool(form, "fitsPescatarian"),
    allergens: formList(form, "allergens"),
    // Browsers submit textarea line breaks as CRLF.
    steps: formString(form, "steps").replace(/\r\n/g, "\n"),
    photoUrl: formString(form, "photoUrl"),
    published: formBool(form, "published"),
  };
}

function revalidate(id?: string) {
  revalidatePath("/admin/meals");
  if (id) revalidatePath(`/admin/meals/${id}`);
}

export async function createMealAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  let id: string;
  try {
    const { supabase } = await requireAdmin();
    const { published, ...rest } = readMeal(form);
    id = await saveMeal(supabase, { ...mealInputSchema.parse(rest), published });
  } catch (error) {
    return actionFail(error);
  }
  revalidate();
  redirect(`/admin/meals/${id}?saved=1`);
}

export async function updateMealAction(
  id: string,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const mealId = validId(id);
    const { published, ...rest } = readMeal(form);
    await saveMeal(supabase, { ...mealInputSchema.parse(rest), id: mealId, published });
    revalidate(mealId);
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function deleteMealAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await deleteMeal(supabase, validId(id));
  } catch (error) {
    return actionFail(error);
  }
  revalidate();
  redirect("/admin/meals");
}

/**
 * Suggests the data of a meal from its title and notes. Spends one of the 200 daily drafts shared by
 * all admins, claimed only right before the call, so bad input or a missing key never burns the quota.
 * Nothing is saved.
 */
export async function draftMealAction(
  title: string,
  notes: string,
): Promise<ActionResult<{ draft: MealDraft }>> {
  try {
    const { supabase } = await requireAdmin();

    const cleanTitle = typeof title === "string" ? title.trim() : "";
    const cleanNotes = typeof notes === "string" ? notes.trim() : "";
    if (!mealInputSchema.shape.title.safeParse(cleanTitle).success)
      throw new AppError("INVALID", "Първо въведи името на ястието (2–120 знака).");
    if (cleanNotes.length > MAX_NOTES)
      throw new AppError("INVALID", `Бележките са до ${MAX_NOTES} знака.`);

    const apiKey = serverEnv.ANTHROPIC_API_KEY;
    if (!apiKey) throw new AppError("INVALID", "AI помощникът скоро ще е включен.");

    const { data: claimed, error } = await supabase.rpc("claim_meal_draft_call");
    if (error) throw error;
    if (!claimed) throw new AppError("INVALID", "Днес достигнахте лимита за AI предложения.");

    const drafter = createClaudeMealDrafter({
      apiKey,
      model: serverEnv.NUTRITION_AI_MODEL ?? DEFAULT_MODEL,
    });
    try {
      return actionOk({ draft: await drafter.draft(cleanTitle, cleanNotes) });
    } catch (failure) {
      if (!(failure instanceof MealDraftFailed)) throw failure;
      // Never log the admin's text; the cause is an SDK or validation error.
      console.error(
        "meal draft failed",
        failure.cause instanceof Error ? failure.cause.message : failure.message,
      );
      throw new AppError(
        "INVALID",
        "Не успяхме да направим предложение. Опитай пак или попълни ръчно.",
      );
    }
  } catch (error) {
    return actionFail(error);
  }
}
