import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/server/db/server";
import { adminAccess } from "@/server/admin/admin-access";
import { MfaForm } from "./mfa-form";

export const metadata = { title: "Потвърждение" };

export default function MfaPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" aria-busy="true" />}>
      <MfaGate />
    </Suspense>
  );
}

async function MfaGate() {
  await connection();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/mfa");
  const access = await adminAccess(supabase, user.id);
  if (access === "not_admin") notFound();
  // With the test-mode flag off an aal1 admin is "ok" too, but may still enrol TOTP here.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (access === "ok" && aal?.currentLevel === "aal2") redirect("/admin");
  return <MfaForm />;
}
