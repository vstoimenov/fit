"use server";

import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/require-user";

export async function checkAccessAction(): Promise<ActionResult<boolean>> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("my_access");
    if (error) throw new Error(`load access failed: ${error.message}`);
    return actionOk(data === true);
  } catch (error) {
    return actionFail(error);
  }
}
