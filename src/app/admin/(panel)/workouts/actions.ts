"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/lib/app-error";
import { zonedToUtc } from "@/lib/admin/time";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { formBool, formInt, formList, formString } from "@/lib/form-data";
import { requireAdmin } from "@/server/admin/require-admin";
import {
  createAdminWorkout,
  deleteAdminWorkout,
  reorderStarters,
  scheduleWorkout,
  updateAdminWorkout,
} from "@/server/admin/workouts";

const idSchema = z.uuid();
const idsSchema = z.array(z.uuid()).max(50);

function validId(id: string): string {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw new AppError("INVALID", "Невалидна тренировка.");
  return parsed.data;
}

function readWorkout(form: FormData) {
  const date = formString(form, "date");
  const time = formString(form, "time") || "07:00";
  const kind = formString(form, "kind");
  return {
    title: formString(form, "title"),
    description: formString(form, "description"),
    kind,
    level: kind === "regular" ? formString(form, "level") || null : null,
    durationMin: formInt(form, "durationMin"),
    focus: formList(form, "focus"),
    videoUrl: formString(form, "videoUrl"),
    publishAt: date ? zonedToUtc(date, time) : null,
    notify: formBool(form, "notify"),
  };
}

export async function createWorkoutAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  let id: string;
  try {
    const { user, supabase } = await requireAdmin();
    id = await createAdminWorkout(supabase, user.id, readWorkout(form));
  } catch (error) {
    return actionFail(error);
  }
  revalidatePath("/admin/workouts");
  revalidatePath("/admin/calendar");
  redirect(`/admin/workouts/${id}?saved=1`);
}

export async function updateWorkoutAction(
  id: string,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await updateAdminWorkout(supabase, validId(id), readWorkout(form));
    revalidatePath("/admin/workouts");
    revalidatePath("/admin/calendar");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function unpublishWorkoutAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await scheduleWorkout(supabase, validId(id), null);
    revalidatePath("/admin/workouts");
    revalidatePath("/admin/calendar");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function deleteWorkoutAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await deleteAdminWorkout(supabase, validId(id));
  } catch (error) {
    return actionFail(error);
  }
  revalidatePath("/admin/workouts");
  revalidatePath("/admin/calendar");
  redirect("/admin/workouts");
}

export async function reorderStartersAction(ids: string[]): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = idsSchema.safeParse(ids);
    if (!parsed.success) throw new AppError("INVALID", "Невалидна подредба.");
    await reorderStarters(supabase, parsed.data);
    revalidatePath("/admin/workouts");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}
