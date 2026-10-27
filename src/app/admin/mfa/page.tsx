import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/server/db/server";
import { mfaPageDecision } from "@/lib/admin/mfa-page";
import { adminAccess } from "@/server/admin/admin-access";
import { MfaForm } from "./mfa-form";

export const metadata = { title: "Потвърждение" };

export default function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ enrol?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-dvh" aria-busy="true" />}>
      <MfaGate searchParams={searchParams} />
    </Suspense>
  );
}

async function MfaGate({ searchParams }: { searchParams: Promise<{ enrol?: string | string[] }> }) {
  await connection();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/mfa");
  const [access, { data: aal }, params] = await Promise.all([
    adminAccess(supabase, user.id),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    searchParams,
  ]);
  // With the test-mode flag off an aal1 admin is let in; the form is then opt-in (?enrol=1).
  const decision = mfaPageDecision({
    access,
    aal: aal?.currentLevel,
    enrol: params.enrol === "1",
  });
  if (decision === "not_found") notFound();
  if (decision === "admin") redirect("/admin");
  return <MfaForm />;
}
