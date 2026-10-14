"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { requireUser } from "@/server/auth/require-user";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { createServerSupabaseClient } from "@/server/db/server";
import { deleteAccount, updateProfileBasics } from "@/server/profile/profile";

const basicsSchema = z.object({
  name: z.string().trim().min(1, "Името е задължително").max(60),
  level: z.enum(["beginner", "advanced", "pro"]),
});

export async function saveProfile(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    const { user, supabase } = await requireUser();
    await updateProfileBasics(supabase, user.id, basicsSchema.parse(Object.fromEntries(form)));
    revalidatePath("/app", "layout");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function signOut(): Promise<void> {
  // No requireUser(): an already-expired session should still end up on the landing page.
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteMyAccount(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    if (form.get("confirm") !== "ИЗТРИЙ") {
      throw new AppError("INVALID", "Напиши ИЗТРИЙ, за да потвърдиш.");
    }
    const { user, supabase } = await requireUser();
    await deleteAccount(createAdminSupabaseClient(), user.id);
    await supabase.auth.signOut();
  } catch (error) {
    return actionFail(error);
  }
  redirect("/?deleted=1");
}
