import "server-only";

import { randomUUID } from "node:crypto";
import type { TypedClient } from "@/server/db/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function check(label: string, error: { message: string } | null) {
  if (error) throw new Error(`demo account: ${label} failed: ${error.message}`);
}

/**
 * Test-share mode only: a fresh tester account with everything unlocked (answers filled in,
 * 30 days of manual access, level 10), so testers never share or delete each other's data.
 * Needs the service-role client.
 */
export async function createDemoClient(
  admin: TypedClient,
): Promise<{ userId: string; email: string }> {
  const email = `test-${randomUUID().slice(0, 8)}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name: "Тестова клиентка" },
  });
  if (error || !data.user) throw new Error(`demo account: create user failed: ${error?.message}`);
  const userId = data.user.id;
  const now = new Date();

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      name: "Тестова клиентка",
      onboarding_done: true,
      health_data_consent_at: now.toISOString(),
      goal: "tone",
      height_cm: 165,
      weight_kg: 65,
      target_weight_kg: 60,
      birth_year: 1994,
      activity_level: "light",
      diet: "omnivore",
      allergens: [],
      meals_per_day: 3,
      nutrition_answered_at: now.toISOString(),
    })
    .eq("id", userId);
  check("profile", profileError);

  const { error: subError } = await admin.from("subscriptions").upsert({
    user_id: userId,
    provider: "manual",
    status: "active",
    current_period_end: new Date(now.getTime() + 30 * DAY_MS).toISOString(),
  });
  check("subscription", subError);

  const { error: pointsError } = await admin.from("points_ledger").insert({
    user_id: userId,
    source: "admin",
    ref: "test-share",
    points: 1600,
    reason: "Тестов профил: всичко отключено",
  });
  check("points", pointsError);

  return { userId, email };
}
