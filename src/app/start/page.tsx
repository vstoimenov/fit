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
  let phone: string | null = null;
  if (user) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("onboarding_done, phone")
      .eq("id", user.id)
      .single();
    // A failed query must not look like "not onboarded".
    if (error) throw new Error(`load onboarding state failed: ${error.message}`);
    if (profile.onboarding_done) return <DraftResetRedirect to="/app" />;
    phone = profile.phone;
  }
  // Back from Google (or a sign-up that stopped before the phone was saved): ask for the phone first.
  return <Wizard signedIn={user !== null} needsPhone={user !== null && !phone} />;
}
