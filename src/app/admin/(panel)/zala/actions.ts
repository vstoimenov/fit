"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverEnv } from "@/env";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { formBool, formInt, formString } from "@/lib/form-data";
import { requireAdmin } from "@/server/admin/require-admin";
import { saveSetting } from "@/server/admin/settings";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { webPushTransport } from "@/server/push/send";
import {
  adminAddBooking,
  adminRemoveBooking,
  cancelStudioSession,
  saveStudioSlot,
} from "@/server/studio/admin";
import { adjustStudioCard, grantStudioCard, voidStudioCard } from "@/server/studio/cards";
import { createStudioInvite } from "@/server/studio/invite";
import { addAtDoor, searchClients, setAttended, type ClientHit } from "@/server/studio/today";
import { createWalkIn } from "@/server/studio/walkin";

const BASE = "/admin/zala";
const uuid = (v: string) => z.uuid().parse(v);
/** The server modules answer `{ ok: false, message }` for her mistakes; show it as is. */
const fail = (message: string) => {
  throw new AppError("INVALID", message);
};

function refresh() {
  revalidatePath(BASE, "layout");
  revalidatePath("/zala");
}

export async function saveSlotAction(
  id: string | null,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const res = await saveStudioSlot(supabase, createAdminSupabaseClient(), id && uuid(id), {
      weekday: formInt(form, "weekday"),
      startTime: formString(form, "startTime"),
      durationMin: formInt(form, "durationMin"),
      title: formString(form, "title"),
      capacity: formInt(form, "capacity"),
      active: formBool(form, "active"),
    });
    if (!res.ok) fail(res.message);
    refresh();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function addBookingAction(
  sessionId: string,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ message: string }>> {
  try {
    const { supabase } = await requireAdmin();
    const res = await adminAddBooking(supabase, uuid(sessionId), uuid(formString(form, "userId")));
    if (!res.ok) return fail(res.message);
    refresh();
    return actionOk({ message: res.overLimit ? "Добавена ✓ (над лимита)" : "Добавена ✓" });
  } catch (error) {
    return actionFail(error);
  }
}

/** „Нова клиентка“: name + phone; added to the training when one is open. */
export async function addWalkInAction(
  sessionId: string | null,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ message: string }>> {
  try {
    const { supabase } = await requireAdmin();
    const created = await createWalkIn(createAdminSupabaseClient(), {
      name: formString(form, "name"),
      phone: formString(form, "phone"),
    });
    if (!created.ok) return fail(created.message);
    let message = "Клиентката е добавена ✓";
    if (sessionId) {
      const res = await adminAddBooking(supabase, uuid(sessionId), created.userId);
      if (!res.ok) return fail(res.message);
      if (res.overLimit) message += " (над лимита)";
    }
    refresh();
    return actionOk({ message });
  } catch (error) {
    return actionFail(error);
  }
}

export async function removeBookingAction(bookingId: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const res = await adminRemoveBooking(supabase, uuid(bookingId));
    if (!res.ok) fail(res.message);
    refresh();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function cancelSessionAction(
  sessionId: string,
): Promise<ActionResult<{ message: string }>> {
  try {
    const { supabase } = await requireAdmin();
    const { notified } = await cancelStudioSession(
      supabase,
      createAdminSupabaseClient(),
      uuid(sessionId),
      webPushTransport(serverEnv),
    );
    refresh();
    return actionOk({
      message: `Тренировката е отменена. Посещенията са върнати. Известени: ${notified}.`,
    });
  } catch (error) {
    return actionFail(error);
  }
}

export async function grantCardAction(
  userId: string,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ message: string }>> {
  try {
    const { supabase } = await requireAdmin();
    const res = await grantStudioCard(supabase, {
      userId: uuid(userId),
      kind: formString(form, "kind"),
      startsOn: formString(form, "startsOn"),
      usedBefore: formString(form, "usedBefore") || "0",
    });
    if (!res.ok) return fail(res.message);
    refresh();
    return actionOk({ message: `Картата е дадена. Преместени записвания: ${res.moved}.` });
  } catch (error) {
    return actionFail(error);
  }
}

export async function adjustCardAction(
  cardId: string,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const res = await adjustStudioCard(supabase, {
      cardId: uuid(cardId),
      delta: formString(form, "delta"),
      reason: formString(form, "reason"),
    });
    if (!res.ok) fail(res.message);
    refresh();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function voidCardAction(cardId: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const res = await voidStudioCard(supabase, uuid(cardId));
    if (!res.ok) fail(res.message);
    refresh();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

/** A one-time link for a walk-in to set her own login; shown to Аксения to send by Viber/WhatsApp. */
export async function inviteAction(userId: string): Promise<ActionResult<{ message: string }>> {
  try {
    const { user } = await requireAdmin();
    const token = await createStudioInvite(createAdminSupabaseClient(), uuid(userId), user.id);
    const base = serverEnv.APP_URL.replace(/\/$/, "");
    return actionOk({ message: `${base}/zala/pokana/${token}` });
  } catch (error) {
    return actionFail(error);
  }
}

/** „Адрес на залата“: shown with a map at the bottom of /zala (empty hides the map). */
export async function saveStudioAddressAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await saveSetting(supabase, "studio_address", formString(form, "address"));
    refresh();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

/** „Дошла ✓“ on the day board (no page reload: the toggle updates itself). */
export async function setAttendedAction(
  bookingId: string,
  attended: boolean,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const res = await setAttended(supabase, uuid(bookingId), Boolean(attended));
    if (!res.ok) fail(res.message);
    revalidatePath(BASE, "layout");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function searchClientsAction(query: string): Promise<ActionResult<ClientHit[]>> {
  try {
    const { supabase } = await requireAdmin();
    return actionOk(await searchClients(supabase, String(query).slice(0, 60)));
  } catch (error) {
    return actionFail(error);
  }
}

/** „+ На вратата“ for someone already in the system: booked and ticked. */
export async function doorAddAction(
  sessionId: string,
  userId: string,
): Promise<ActionResult<{ message: string }>> {
  try {
    const { supabase } = await requireAdmin();
    const res = await addAtDoor(supabase, uuid(sessionId), uuid(userId));
    if (!res.ok) return fail(res.message);
    refresh();
    return actionOk({ message: res.overLimit ? "Добавена ✓ (над лимита)" : "Добавена ✓" });
  } catch (error) {
    return actionFail(error);
  }
}

/** „Нова клиентка“ at the door: created with name and phone, booked and ticked. */
export async function doorWalkInAction(
  sessionId: string,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ message: string }>> {
  try {
    const { supabase } = await requireAdmin();
    const created = await createWalkIn(createAdminSupabaseClient(), {
      name: formString(form, "name"),
      phone: formString(form, "phone"),
    });
    if (!created.ok) return fail(created.message);
    const res = await addAtDoor(supabase, uuid(sessionId), created.userId);
    if (!res.ok) return fail(res.message);
    refresh();
    return actionOk({ message: "Добавена и отметната ✓" });
  } catch (error) {
    return actionFail(error);
  }
}
