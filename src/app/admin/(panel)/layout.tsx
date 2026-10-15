import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAppError } from "@/lib/app-error";
import { adminMfaBypassed, requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: { default: "Админ", template: "%s · Админ" } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await connection();
  let mfaOff = false;
  try {
    const { supabase } = await requireAdmin();
    mfaOff = await adminMfaBypassed(supabase);
  } catch (error) {
    if (isAppError(error) && error.code === "UNAUTHORIZED") redirect("/login?next=/admin");
    if (isAppError(error) && error.code === "MFA_REQUIRED") redirect("/admin/mfa");
    if (isAppError(error) && error.code === "FORBIDDEN") notFound();
    throw error;
  }
  return (
    <div className="min-h-dvh">
      {mfaOff && (
        <p
          role="status"
          className="bg-mustard/20 px-4 py-2 text-center text-sm font-medium text-ink"
        >
          Двуфакторният вход е изключен (тестов режим). Включи го преди пускане.
        </p>
      )}
      <div className="lg:grid lg:grid-cols-[220px_1fr]">
        <AdminNav />
        <main className="min-w-0 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
