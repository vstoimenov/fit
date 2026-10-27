"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/server/admin/require-admin";
import {
  deletePostAsAdmin,
  dismissReport,
  moderateComment,
  moderatePost,
} from "@/server/community/admin";

function done() {
  revalidatePath("/admin/community");
  revalidatePath("/app/community");
  revalidatePath("/app");
}

export async function hidePostAction(id: string, hidden: boolean): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await moderatePost(supabase, z.uuid().parse(id), hidden);
    done();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function hideCommentAction(id: string, hidden: boolean): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await moderateComment(supabase, z.uuid().parse(id), hidden);
    done();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function deletePostAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await deletePostAsAdmin(supabase, z.uuid().parse(id));
    done();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function dismissReportAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await dismissReport(supabase, z.uuid().parse(id));
    done();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}
