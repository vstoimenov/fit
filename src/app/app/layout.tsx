import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BottomNav } from "@/components/app/bottom-nav";
import { createServerSupabaseClient } from "@/server/db/server";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
      <AppGate>{children}</AppGate>
    </Suspense>
  );
}

/** Onboarding gate. Reads the session at request time, so it streams in behind the Suspense boundary. */
async function AppGate({ children }: { children: React.ReactNode }) {
  // Opt out of prerendering before the session read: supabase-js compares token expiry with Date.now().
  await connection();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app");
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_done")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarding_done) redirect("/start/finish");
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      {children}
      <BottomNav />
    </div>
  );
}
