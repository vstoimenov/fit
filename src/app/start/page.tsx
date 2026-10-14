import { connection } from "next/server";
import { Suspense } from "react";
import { DraftResetRedirect } from "@/components/onboarding/draft-reset";
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
  // Opt out of prerendering before the session read: supabase-js compares token expiry with Date.now().
  await connection();
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
    if (profile?.onboarding_done) return <DraftResetRedirect to="/app" />;
  }
  return <Wizard signedIn={user !== null} />;
}
