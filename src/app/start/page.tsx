import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Wizard } from "@/components/onboarding/wizard";
import { createServerSupabaseClient } from "@/server/db/server";

export const metadata = { title: "Твоят план" };

export default function StartPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" aria-busy="true" />}>
      <StartGate />
    </Suspense>
  );
}

/** Reads the session at request time, so it streams in behind the Suspense boundary. */
async function StartGate() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_done")
      .eq("id", user.id)
      .single();
    if (profile?.onboarding_done) redirect("/app");
  }
  return <Wizard signedIn={user !== null} />;
}
