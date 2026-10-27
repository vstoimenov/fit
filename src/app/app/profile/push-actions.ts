"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/require-user";
import { createAdminSupabaseClient } from "@/server/db/admin";
import {
  claimSubscription,
  removeSubscription,
  saveSubscription,
  setPushHour,
  subscriptionSchema,
} from "@/server/push/subscriptions";

const hourSchema = z.number().int().min(0).max(23).nullable();

/** Stores the browser subscription and switches the daily reminder on at `hour`. */
export async function subscribePushAction(
  subscription: unknown,
  hour: number,
): Promise<ActionResult<null>> {
  try {
    const { user, supabase } = await requireUser();
    const input = subscriptionSchema.parse(subscription);
    const userAgent = (await headers()).get("user-agent");
    // Hour first: if the device save fails she is not left with a silent subscription.
    await setPushHour(supabase, user.id, hourSchema.parse(hour));
    await saveSubscription(createAdminSupabaseClient(), user.id, input, userAgent);
    revalidatePath("/app/profile");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

/**
 * A subscription found on the device at load time is re-attached to whoever is signed in now.
 * `claimed: false` means the server does not know this device (any more): the caller re-subscribes.
 */
export async function claimPushAction(
  subscription: unknown,
): Promise<ActionResult<{ claimed: boolean }>> {
  try {
    const { user } = await requireUser();
    const claimed = await claimSubscription(
      createAdminSupabaseClient(),
      user.id,
      subscriptionSchema.parse(subscription),
    );
    return actionOk({ claimed });
  } catch (error) {
    return actionFail(error);
  }
}

/** Forgets this device; reminders stay as they are for her other devices. */
export async function unsubscribePushAction(endpoint: unknown): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    await removeSubscription(supabase, z.url().max(2048).parse(endpoint));
    revalidatePath("/app/profile");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function setPushHourAction(hour: unknown): Promise<ActionResult<null>> {
  try {
    const { user, supabase } = await requireUser();
    await setPushHour(supabase, user.id, hourSchema.parse(hour));
    revalidatePath("/app/profile");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}
