"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { formBool, formInt, formString } from "@/lib/form-data";
import { requireAdmin } from "@/server/admin/require-admin";
import { savePlan, saveSetting } from "@/server/admin/settings";

type Db = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

async function run(fn: (db: Db) => Promise<void>): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await fn(supabase);
    revalidatePath("/admin/settings");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function saveRiskAction(_prev: unknown, form: FormData) {
  return run((db) =>
    saveSetting(db, "risk", {
      inactiveDays: formInt(form, "inactiveDays"),
      minCompletionPct: formInt(form, "minCompletionPct"),
    }),
  );
}

export async function saveProviderAction(_prev: unknown, form: FormData) {
  return run((db) =>
    saveSetting(db, "payment_provider", { provider: formString(form, "provider") }),
  );
}

export async function saveTrackingAction(_prev: unknown, form: FormData) {
  return run((db) =>
    saveSetting(db, "tracking", {
      metaPixelId: formString(form, "metaPixelId"),
      ga4Id: formString(form, "ga4Id"),
      gtmId: formString(form, "gtmId"),
      googleAdsId: formString(form, "googleAdsId"),
    }),
  );
}

export async function saveCommunityAction(_prev: unknown, form: FormData) {
  return run((db) => saveSetting(db, "community_url", formString(form, "communityUrl")));
}

export async function saveSiteLinksAction(_prev: unknown, form: FormData) {
  return run(async (db) => {
    await saveSetting(db, "trainer_video_url", formString(form, "trainerVideoUrl"));
    await saveSetting(db, "instagram_url", formString(form, "instagramUrl"));
  });
}

export async function saveTemplatesAction(_prev: unknown, form: FormData) {
  return run((db) =>
    saveSetting(db, "email_templates", {
      nudgeSubject: formString(form, "nudgeSubject"),
      // Browsers submit textarea line breaks as CRLF.
      nudgeBody: formString(form, "nudgeBody").replace(/\r\n/g, "\n"),
    }),
  );
}

/** `id` is null for a new plan. The price arrives in euros ("29,90") and is stored in cents. */
export async function savePlanAction(id: string | null, _prev: unknown, form: FormData) {
  const euros = formString(form, "price").replace(",", ".");
  return run((db) =>
    savePlan(db, id === null ? null : z.uuid().parse(id), {
      name: formString(form, "name"),
      interval: formString(form, "interval"),
      priceCents: /^\d+(\.\d{1,2})?$/.test(euros) ? Math.round(Number(euros) * 100) : Number.NaN,
      active: formBool(form, "active"),
      sort: formInt(form, "sort"),
      stripePriceId: formString(form, "stripePriceId"),
    }),
  );
}
