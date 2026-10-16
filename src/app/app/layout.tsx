import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BottomNav } from "@/components/app/bottom-nav";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { pastDueNotice } from "@/lib/subscription-text";
import { createServerSupabaseClient } from "@/server/db/server";
import { ManageSubscriptionButton } from "./profile/manage-subscription-button";

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
  const [{ data: profile, error }, { data: sub, error: subError }] = await Promise.all([
    supabase.from("profiles").select("onboarding_done").eq("id", user.id).single(),
    supabase
      .from("subscriptions")
      .select("provider, provider_sub_id, provider_customer_id, status, grace_until")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  // A failed query must not look like "not onboarded" (that would bounce her into the funnel).
  if (error) throw new Error(`load onboarding state failed: ${error.message}`);
  if (!profile.onboarding_done) redirect("/start/finish");
  // The banner is a nudge, not an access rule: a failed read only hides it.
  if (subError) console.error("load subscription for banner failed", subError.message);
  // Failed renewal, still in grace. The portal is always Stripe's (see openPortalAction).
  const notice = sub?.provider === "stripe" && sub.provider_customer_id ? pastDueNotice(sub) : null;
  return (
    <div className="min-h-dvh lg:flex">
      <SidebarNav />
      <div className="min-w-0 flex-1 pb-28 lg:pb-10">
        <div className="mx-auto max-w-md lg:max-w-5xl">
          {notice && (
            <aside
              role="alert"
              className="mx-5 mt-5 space-y-2 rounded-2xl bg-brick/10 p-4 ring-1 ring-brick/30 lg:mx-8"
            >
              <p className="font-semibold text-brick">{notice}</p>
              <ManageSubscriptionButton label="Обнови картата" />
            </aside>
          )}
          {children}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
