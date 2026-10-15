import { connection } from "next/server";
import { Suspense } from "react";
import { requireAdmin } from "@/server/admin/require-admin";
import { getSettings, listPlans } from "@/server/admin/settings";
import { SettingsForms } from "./forms";

export const metadata = { title: "Настройки" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  await connection();
  const { supabase } = await requireAdmin();
  const [settings, plans] = await Promise.all([getSettings(supabase), listPlans(supabase)]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Настройки</h1>
      <SettingsForms settings={settings} plans={plans} />
    </div>
  );
}
