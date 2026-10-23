"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { isOwnPhotoPath } from "@/lib/progress-photos/path";
import { requireUser } from "@/server/auth/require-user";
import { deleteProgressPhoto, recordProgressPhoto } from "@/server/progress/photos";

const inputSchema = z.object({
  path: z.string().min(1, "Снимката не се качи. Опитай пак."),
  takenOn: z.iso.date("Избери валидна дата."),
});

/** Records a photo the browser has just uploaded to her own folder in storage. */
export async function addProgressPhoto(input: {
  path: string;
  takenOn: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const { path, takenOn } = inputSchema.parse(input);
    const { user, supabase } = await requireUser();
    if (!isOwnPhotoPath(user.id, path)) {
      throw new AppError("INVALID", "Снимката не се качи. Опитай пак.");
    }
    const id = await recordProgressPhoto(supabase, { path, takenOn });
    revalidatePath("/app/progress");
    revalidatePath("/app/progress/photos");
    return actionOk({ id });
  } catch (error) {
    return actionFail(error);
  }
}

/**
 * Deletes one of her photos (file first, then the row) and returns to the grid. Only a failure comes
 * back as a result; on success the redirect takes over. `redirect` throws, so it stays outside the try.
 */
export async function removeProgressPhoto(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    await deleteProgressPhoto(supabase, id);
    revalidatePath("/app/progress");
    revalidatePath("/app/progress/photos");
  } catch (error) {
    return actionFail(error);
  }
  redirect("/app/progress/photos");
}
