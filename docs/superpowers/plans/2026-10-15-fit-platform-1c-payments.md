# Fit Platform 1C — Payments (Stripe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A client can subscribe (monthly or yearly) through Stripe Checkout — card, Apple Pay, Google Pay — get access the moment the webhook arrives, manage or cancel in the Stripe Customer Portal, keep access until the paid period ends, and get a 3-day grace period after a failed renewal; admins see accurate subscription data and MRR; deleting an account cancels the paid subscription first.

**Architecture:** A provider-neutral layer (`src/server/payments/*`) defines `PaymentProvider` (checkout, portal, cancel, webhook parsing into a `NormalizedSubscriptionEvent`). The Stripe adapter wraps an injected Stripe client so everything is testable offline. Webhooks are verified, stored idempotently in `payment_events`, and applied to the single `subscriptions` row per user by one service (`applySubscriptionEvent`) that is order-safe (ignores events older than the last applied one) and snapshots the paid price for MRR. Which provider is active comes from settings through a narrow `security definer` function. Revolut gets the interface slot only (`RevolutProvider` reports "not available") until a Revolut Business sandbox exists — then a separate small plan fills it in against the real API.

**Tech Stack:** Next.js 16 (cacheComponents), Supabase (Postgres RLS, service role for webhooks only), `stripe` Node SDK (v23), zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-14-fit-platform-stage1-design.md` §7 (Плащания), §9 (webhook before return, failed renewal). Follow-ups: `docs/superpowers/plans/2026-10-14-fit-platform-1a-followups.md` (1C items).

## Global Constraints

- Repo `/Users/macbookpro/Downloads/cloude-c/fit-platform`, branch `plan-1c` (from `main` after the 1B merge). Shell: `export PATH="$HOME/.npm-global/bin:$PATH" DOCKER_CONFIG=/tmp/dockercfg`. Local Supabase 553xx, container `supabase_db_fit-platform` only (never `supabase_db_adsnap`). `pnpm db:reset` + `pnpm db:types` after migrations; never edit applied migrations.
- Next 16 cacheComponents page pattern: sync export → `<Suspense>` → async inner with `await connection()`. Services imported by DB/unit tests must NOT import `src/env.ts` (directly or via `require-user`/`require-admin`/`db/server`/`db/admin`); env is read only in `app/**` actions, routes and pages and passed in.
- Card data never touches our server (Stripe-hosted Checkout + Customer Portal → PCI SAQ A).
- Stripe keys are **optional** env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`); without them the app works, the subscribe button says „Плащането още не е настроено" and the webhook route answers 503. Tests never call the Stripe network: inject a fake client; webhook signatures are generated offline with `stripe.webhooks.generateTestHeaderString`.
- Access rules stay in Postgres (`has_active_access`): `active`/`trialing` → access; `past_due` → access while `grace_until > now()`; `canceled` → access while `current_period_end > now()`. Grace period = 3 days from the first failed renewal (spec §7).
- Webhook writes use the service-role client and only touch `subscriptions` and `payment_events`. `payment_events` has **no** foreign key to `profiles` (accounting records outlive account deletion).
- One `subscriptions` row per user (PK `user_id`). A paid subscription replaces a manual grant; a manual grant may replace a non-live paid row (former customer) through an admin RPC only.
- Plans: once a plan has a Stripe Price ID, its price and interval are read-only in the admin (prices live in Stripe; a different price = a new plan).
- UI copy Bulgarian; code/commits English; commit messages end with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Tests must prove properties.
- Out of scope: Revolut implementation (slot only), tracking/CAPI purchase events (1D hooks into `applySubscriptionEvent` later), coupons beyond Stripe's own `allow_promotion_codes`, invoices UI (the Customer Portal has them), taxes/VAT configuration (Stripe dashboard).

## Review Focus

1. **Webhook arrives twice, or out of order:** a replayed event must change nothing; an older `customer.subscription.updated` arriving after a newer one must not roll the status back (pinned in Task 3).
2. **Failed renewal:** `past_due` sets `grace_until` = first failure + 3 days and does not push it forward on later retries; paying again clears it (Task 3).
3. **Cancel at period end:** the client keeps access until `current_period_end`; churn counts her only when the subscription actually ends (Task 3 + Task 1 dashboard test).
4. **Forged or unsigned webhook:** wrong/missing signature → 400 and nothing stored (Task 4/5).
5. **Account deletion with a live paid subscription:** the provider subscription is cancelled first; if that fails, the account is NOT deleted and the client sees why (Task 7).

---

## File Structure

```
supabase/migrations/
  20261016100000_payments.sql        payment_events; subscriptions: cancel_at_period_end, price_cents, billing_interval,
                                      provider_event_at; active_payment_provider(); admin_grant_manual(); dashboard MRR snapshot
supabase/tests/
  payments-db.test.ts                schema, RPCs, dashboard MRR
  payments-apply.test.ts             applySubscriptionEvent / recordPaymentEvent
src/lib/payments/
  types.ts                           NormalizedSubscriptionEvent, SubscriptionStatus
  stripe-normalize.ts (+test)        Stripe event → normalized event (pure)
  fixtures/stripe-events.ts          minimal Stripe event fixtures for tests
src/server/payments/
  provider.ts                        PaymentProvider interface, ProviderUnavailableError
  stripe-provider.ts (+test)         StripeProvider(client, config)
  revolut-provider.ts                RevolutProvider (not available yet)
  apply-event.ts                     recordPaymentEvent, applySubscriptionEvent
  webhook.ts (+test)                 handleWebhook(rawBody, headers, deps)
  registry.ts                        getActiveProvider(db, env)
  checkout.ts                        startCheckout / openPortal services (provider + db)
src/app/api/pay/stripe/webhook/route.ts
src/app/app/plan/{page.tsx, plan-picker.tsx, actions.ts}
src/app/app/welcome/{page.tsx, welcome-poll.tsx, actions.ts}
src/app/app/profile/page.tsx (+ manage subscription button) , profile/actions.ts (+ openPortalAction)
src/server/profile/profile.ts       deleteAccount cancels the paid subscription first
src/server/admin/{clients.ts, settings.ts} + admin pages (price id, lock, RPC grant, Revolut "скоро")
README.md                           Payments section
```

---

### Task 1: Payments schema, provider setting function, manual-grant RPC, MRR snapshot

**Files:**
- Create: `supabase/migrations/20261016100000_payments.sql`, `supabase/tests/payments-db.test.ts`
- Modify: `supabase/tests/privileges.test.ts` (`TABLES` += `payment_events`), `src/lib/supabase/database.types.ts`

**Interfaces:**
- Produces (SQL):
  - table `payment_events(id uuid pk, provider payment_provider, event_id text, type text, user_id uuid null (no FK), payload jsonb, received_at timestamptz, processed_at timestamptz null, error text null)`, unique `(provider, event_id)`; RLS on, admin select only; no client writes.
  - `subscriptions` + columns `cancel_at_period_end boolean not null default false`, `price_cents integer null`, `billing_interval plan_interval null`, `provider_event_at timestamptz null`.
  - `active_payment_provider() returns text` — `'stripe'` or `'revolut'` from `settings.payment_provider`, default `'stripe'`; executable by `authenticated` and `service_role`.
  - `admin_grant_manual(p_user_id uuid, p_days int) returns timestamptz` — admin (aal2) only; extends a live manual grant from its end, replaces a non-live row of any provider, refuses (`23P01` → app CONFLICT) when a paid subscription is live; returns the new end.
  - `admin_dashboard` MRR uses `coalesce(s.price_cents, pl.price_cents)` and `coalesce(s.billing_interval, pl.interval)`.

- [ ] **Step 1: Write the failing tests**

`supabase/tests/payments-db.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, createAal1Admin, createAdminUser, createUser, signedInClient, type TypedClient } from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
const day = 86_400_000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "pay-admin")).db;
});

describe("payment_events", () => {
  it("is unique per provider event and hidden from clients", async () => {
    const eventId = `evt_${crypto.randomUUID()}`;
    const first = await admin.from("payment_events").insert({ provider: "stripe", event_id: eventId, type: "x", payload: {} });
    expect(first.error).toBeNull();
    const dup = await admin.from("payment_events").insert({ provider: "stripe", event_id: eventId, type: "x", payload: {} });
    expect(dup.error?.code).toBe("23505");
    const client = await signedInClient(await createUser(admin, "pay-client"));
    const { data, error } = await client.from("payment_events").select("id").eq("event_id", eventId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const write = await client.from("payment_events").insert({ provider: "stripe", event_id: `evt_${crypto.randomUUID()}`, type: "x", payload: {} });
    expect(write.error?.code).toBe("42501");
    const { data: seen } = await boss.from("payment_events").select("id").eq("event_id", eventId);
    expect(seen).toHaveLength(1);
  });

  it("survives deleting the user it mentions", async () => {
    const user = await createUser(admin, "pay-del");
    const eventId = `evt_${crypto.randomUUID()}`;
    await admin.from("payment_events").insert({ provider: "stripe", event_id: eventId, type: "x", user_id: user.id, payload: {} });
    await admin.auth.admin.deleteUser(user.id);
    const { data } = await admin.from("payment_events").select("user_id").eq("event_id", eventId).single();
    expect(data?.user_id).toBe(user.id);
  });
});

describe("active_payment_provider", () => {
  it("defaults to stripe and follows the admin setting", async () => {
    const client = await signedInClient(await createUser(admin, "pay-prov"));
    await boss.from("settings").delete().eq("key", "payment_provider");
    expect((await client.rpc("active_payment_provider")).data).toBe("stripe");
    await boss.from("settings").upsert({ key: "payment_provider", value: { provider: "revolut" } });
    expect((await client.rpc("active_payment_provider")).data).toBe("revolut");
    await boss.from("settings").delete().eq("key", "payment_provider");
  });
});

describe("admin_grant_manual", () => {
  async function sub(userId: string) {
    const { data } = await admin.from("subscriptions").select("provider, status, current_period_end").eq("user_id", userId).single();
    return data!;
  }

  it("creates and extends a manual grant", async () => {
    const user = await createUser(admin, "grant-new");
    const first = await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 10 });
    expect(first.error).toBeNull();
    const second = await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 10 });
    expect(Date.parse(second.data as string) - Date.now()).toBeGreaterThan(19 * day);
    expect((await sub(user.id)).provider).toBe("manual");
  });

  it("replaces a non-live paid row (former customer)", async () => {
    const user = await createUser(admin, "grant-former");
    await admin.from("subscriptions").insert({ user_id: user.id, provider: "stripe", status: "canceled", current_period_end: iso(-day) });
    const { error } = await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 7 });
    expect(error).toBeNull();
    expect(await sub(user.id)).toMatchObject({ provider: "manual", status: "active" });
  });

  it("refuses while a paid subscription is live and refuses non-admins", async () => {
    const user = await createUser(admin, "grant-live");
    await admin.from("subscriptions").insert({ user_id: user.id, provider: "stripe", status: "active", current_period_end: iso(10 * day) });
    const refused = await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 7 });
    expect(refused.error?.code).toBe("23P01");
    expect((await sub(user.id)).provider).toBe("stripe");
    const half = await createAal1Admin(admin, "grant-half");
    const denied = await half.db.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 7 });
    expect(denied.error?.code).toBe("42501");
  });

  it("rejects absurd day counts", async () => {
    const user = await createUser(admin, "grant-days");
    expect((await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 0 })).error?.code).toBe("22023");
    expect((await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 400 })).error?.code).toBe("22023");
  });
});

describe("dashboard MRR uses the paid price snapshot", () => {
  it("counts the snapshot, not the current plan price", async () => {
    const before = ((await boss.rpc("admin_dashboard", {})).data as { subscriptions: { mrr_cents: number } }).subscriptions.mrr_cents;
    const { data: plan } = await admin.from("plans").select("id").eq("interval", "month").single();
    const user = await createUser(admin, "mrr-snap");
    await admin.from("subscriptions").insert({
      user_id: user.id, provider: "stripe", status: "active", plan_id: plan!.id, price_cents: 1500, billing_interval: "month",
    });
    const after = ((await boss.rpc("admin_dashboard", {})).data as { subscriptions: { mrr_cents: number } }).subscriptions.mrr_cents;
    expect(after - before).toBe(1500);
  });
});
```

Run: `pnpm test:db supabase/tests/payments-db.test.ts` → FAIL (table/columns/functions missing).

- [ ] **Step 2: Write the migration**

`supabase/migrations/20261016100000_payments.sql`:

```sql
-- Raw provider webhooks, stored once per provider event. No FK to profiles: accounting records
-- must outlive account deletion.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  event_id text not null check (char_length(event_id) <= 255),
  type text not null check (char_length(type) <= 100),
  user_id uuid,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text check (char_length(error) <= 1000),
  unique (provider, event_id)
);
create index payment_events_user on public.payment_events (user_id, received_at desc);

alter table public.payment_events enable row level security;
create policy payment_events_admin_select on public.payment_events for select to authenticated
  using ((select public.is_admin()));
revoke all on public.payment_events from anon;
revoke insert, update, delete on public.payment_events from authenticated;

alter table public.subscriptions
  add column cancel_at_period_end boolean not null default false,
  add column price_cents integer check (price_cents is null or price_cents > 0),
  add column billing_interval public.plan_interval,
  add column provider_event_at timestamptz;

-- Which provider checkout uses. Settings are admin-only, so clients read just this one value.
create function public.active_payment_provider() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select value ->> 'provider' from public.settings where key = 'payment_provider'),
    'stripe'
  );
$$;
revoke execute on function public.active_payment_provider() from public, anon;
grant execute on function public.active_payment_provider() to authenticated, service_role;

-- Manual (comp) access granted by an admin. Extends a live manual grant from its end; replaces a
-- non-live row of any provider (former customer); refuses while a paid subscription is live.
create function public.admin_grant_manual(p_user_id uuid, p_days int) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  s public.subscriptions%rowtype;
  v_start timestamptz := now();
  v_end timestamptz;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'days must be 1..365' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'client') then
    raise exception 'client not found' using errcode = 'P0002';
  end if;
  select * into s from public.subscriptions where user_id = p_user_id for update;
  if found then
    if s.provider <> 'manual' and public.has_active_access(p_user_id) then
      raise exception 'paid subscription is live' using errcode = '23P01';
    end if;
    if s.provider = 'manual' and s.status = 'active'
       and s.current_period_end is not null and s.current_period_end > now() then
      v_start := s.current_period_end;
    end if;
  end if;
  v_end := v_start + make_interval(days => p_days);
  insert into public.subscriptions as t (user_id, provider, status, current_period_end, grace_until, canceled_at,
                                         cancel_at_period_end, plan_id, provider_customer_id, provider_sub_id,
                                         price_cents, billing_interval, provider_event_at)
  values (p_user_id, 'manual', 'active', v_end, null, null, false, null, null, null, null, null, null)
  on conflict (user_id) do update set
    provider = 'manual', status = 'active', current_period_end = excluded.current_period_end,
    grace_until = null, canceled_at = null, cancel_at_period_end = false, plan_id = null,
    provider_sub_id = null, price_cents = null, billing_interval = null, provider_event_at = null;
  return v_end;
end $$;
revoke execute on function public.admin_grant_manual(uuid, int) from public, anon;
grant execute on function public.admin_grant_manual(uuid, int) to authenticated;
```

Then append to the same migration a `create or replace function public.admin_dashboard(p_now timestamptz default now(), p_own_host text default null)` that is **identical** to the current definition in `supabase/migrations/20261015100250_admin_reports_fixes.sql` except the `mrr_cents` expression becomes:

```sql
      'mrr_cents', (
        select coalesce(sum(
          case coalesce(s.billing_interval, pl.interval)
            when 'year' then round(coalesce(s.price_cents, pl.price_cents) / 12.0)
            else coalesce(s.price_cents, pl.price_cents)
          end), 0)::bigint
        from public.subscriptions s
        left join public.plans pl on pl.id = s.plan_id
        where s.provider <> 'manual' and s.status in ('active', 'trialing')
          and coalesce(s.price_cents, pl.price_cents) is not null
      ),
```

(copy the whole function body verbatim, change only this expression, keep the revoke/grant lines). Add `"payment_events"` to `TABLES` in `supabase/tests/privileges.test.ts`.

Run: `pnpm db:reset && pnpm db:types`.

- [ ] **Step 3: Run the tests**

Run: `pnpm test:db` → all files PASS (including the existing admin-reports MRR tests).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): payment events, subscription snapshot columns, provider setting and manual grant RPCs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Normalised subscription events from Stripe (pure)

**Files:**
- Create: `src/lib/payments/types.ts`, `src/lib/payments/stripe-normalize.ts`, `src/lib/payments/stripe-normalize.test.ts`, `src/lib/payments/fixtures/stripe-events.ts`
- Modify: `package.json` (`pnpm add stripe`)

**Interfaces:**
- Produces:
  - `type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "none"`
  - `interface NormalizedSubscriptionEvent { provider: "stripe" | "revolut"; eventId: string; type: string; occurredAt: string; userId: string | null; customerId: string | null; subscriptionId: string; status: SubscriptionStatus; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; canceledAt: string | null; priceId: string | null; priceCents: number | null; interval: "month" | "year" | null }`
  - `mapStripeStatus(status: string): SubscriptionStatus`
  - `normalizeStripeEvent(event: Stripe.Event): NormalizedSubscriptionEvent | null` — handles `customer.subscription.created|updated|deleted`; returns `null` for every other type.
  - Fixtures: `stripeSubscriptionEvent(overrides): Stripe.Event`

- [ ] **Step 1: Install and write the failing tests**

```bash
pnpm add stripe
```

`src/lib/payments/fixtures/stripe-events.ts`:

```ts
import type Stripe from "stripe";

/** A minimal customer.subscription.* event shaped like Stripe's API (basil+: period on items). */
export function stripeSubscriptionEvent(
  over: {
    type?: string;
    id?: string;
    created?: number;
    status?: string;
    userId?: string | null;
    periodEnd?: number;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: number | null;
    endedAt?: number | null;
    priceId?: string;
    unitAmount?: number;
    interval?: "month" | "year";
    legacyPeriodEnd?: boolean;
  } = {},
): Stripe.Event {
  const periodEnd = over.periodEnd ?? 1_800_000_000;
  const subscription = {
    id: "sub_123",
    object: "subscription",
    customer: "cus_123",
    status: over.status ?? "active",
    cancel_at_period_end: over.cancelAtPeriodEnd ?? false,
    canceled_at: over.canceledAt ?? null,
    ended_at: over.endedAt ?? null,
    metadata: over.userId === null ? {} : { user_id: over.userId ?? "00000000-0000-4000-8000-000000000001" },
    ...(over.legacyPeriodEnd ? { current_period_end: periodEnd } : {}),
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          ...(over.legacyPeriodEnd ? {} : { current_period_end: periodEnd }),
          price: {
            id: over.priceId ?? "price_month",
            unit_amount: over.unitAmount ?? 1990,
            currency: "eur",
            recurring: { interval: over.interval ?? "month" },
          },
        },
      ],
    },
  };
  return {
    id: over.id ?? `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: over.type ?? "customer.subscription.updated",
    created: over.created ?? 1_760_000_000,
    data: { object: subscription },
  } as unknown as Stripe.Event;
}
```

`src/lib/payments/stripe-normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { stripeSubscriptionEvent } from "./fixtures/stripe-events";
import { mapStripeStatus, normalizeStripeEvent } from "./stripe-normalize";

describe("mapStripeStatus", () => {
  it.each([
    ["active", "active"],
    ["trialing", "trialing"],
    ["past_due", "past_due"],
    ["unpaid", "past_due"],
    ["canceled", "canceled"],
    ["incomplete", "none"],
    ["incomplete_expired", "none"],
    ["paused", "none"],
    ["something_new", "none"],
  ])("%s → %s", (input, expected) => {
    expect(mapStripeStatus(input)).toBe(expected);
  });
});

describe("normalizeStripeEvent", () => {
  it("normalises an updated subscription", () => {
    const e = normalizeStripeEvent(
      stripeSubscriptionEvent({ id: "evt_1", created: 1_760_000_000, periodEnd: 1_762_000_000, unitAmount: 14900, interval: "year", priceId: "price_year" }),
    );
    expect(e).toEqual({
      provider: "stripe",
      eventId: "evt_1",
      type: "customer.subscription.updated",
      occurredAt: new Date(1_760_000_000_000).toISOString(),
      userId: "00000000-0000-4000-8000-000000000001",
      customerId: "cus_123",
      subscriptionId: "sub_123",
      status: "active",
      currentPeriodEnd: new Date(1_762_000_000_000).toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      priceId: "price_year",
      priceCents: 14900,
      interval: "year",
    });
  });

  it("reads the legacy top-level period end", () => {
    const e = normalizeStripeEvent(stripeSubscriptionEvent({ legacyPeriodEnd: true, periodEnd: 1_765_000_000 }));
    expect(e?.currentPeriodEnd).toBe(new Date(1_765_000_000_000).toISOString());
  });

  it("marks a deleted subscription canceled and keeps when it ended", () => {
    const e = normalizeStripeEvent(
      stripeSubscriptionEvent({ type: "customer.subscription.deleted", status: "canceled", endedAt: 1_761_000_000, canceledAt: 1_760_500_000 }),
    );
    expect(e).toMatchObject({ status: "canceled", canceledAt: new Date(1_761_000_000_000).toISOString() });
  });

  it("keeps cancel-at-period-end subscriptions active until they end", () => {
    const e = normalizeStripeEvent(stripeSubscriptionEvent({ cancelAtPeriodEnd: true, canceledAt: 1_760_500_000 }));
    expect(e).toMatchObject({ status: "active", cancelAtPeriodEnd: true, canceledAt: null });
  });

  it("returns null for events it does not handle and for a missing user id", () => {
    expect(normalizeStripeEvent(stripeSubscriptionEvent({ type: "invoice.paid" }))).toBeNull();
    expect(normalizeStripeEvent(stripeSubscriptionEvent({ userId: null }))?.userId).toBeNull();
  });
});
```

Run: `pnpm test src/lib/payments` → FAIL.

- [ ] **Step 2: Implement**

`src/lib/payments/types.ts`:

```ts
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "none";
export type PaidProvider = "stripe" | "revolut";

/** What every provider's webhook is turned into before it touches our database. */
export interface NormalizedSubscriptionEvent {
  provider: PaidProvider;
  eventId: string;
  type: string;
  occurredAt: string;
  userId: string | null;
  customerId: string | null;
  subscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** When the subscription actually ended (not when cancellation was requested). */
  canceledAt: string | null;
  priceId: string | null;
  priceCents: number | null;
  interval: "month" | "year" | null;
}
```

`src/lib/payments/stripe-normalize.ts`:

```ts
import type Stripe from "stripe";
import type { NormalizedSubscriptionEvent, SubscriptionStatus } from "./types";

const HANDLED = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);

export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "none";
  }
}

const toIso = (seconds: number | null | undefined) =>
  typeof seconds === "number" && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;

type LooseSubscription = Stripe.Subscription & { current_period_end?: number };
type LooseItem = Stripe.SubscriptionItem & { current_period_end?: number };

/** Subscription lifecycle events only; everything else is ignored (null). */
export function normalizeStripeEvent(event: Stripe.Event): NormalizedSubscriptionEvent | null {
  if (!HANDLED.has(event.type)) return null;
  const sub = event.data.object as LooseSubscription;
  const item = sub.items?.data?.[0] as LooseItem | undefined;
  const price = item?.price;
  const status = event.type === "customer.subscription.deleted" ? "canceled" : mapStripeStatus(sub.status);
  const userId = typeof sub.metadata?.user_id === "string" && sub.metadata.user_id ? sub.metadata.user_id : null;
  const interval = price?.recurring?.interval;
  return {
    provider: "stripe",
    eventId: event.id,
    type: event.type,
    occurredAt: new Date(event.created * 1000).toISOString(),
    userId,
    customerId: typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
    subscriptionId: sub.id,
    status,
    currentPeriodEnd: toIso(item?.current_period_end ?? sub.current_period_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    canceledAt: status === "canceled" ? toIso(sub.ended_at ?? sub.canceled_at) : null,
    priceId: price?.id ?? null,
    priceCents: typeof price?.unit_amount === "number" ? price.unit_amount : null,
    interval: interval === "month" || interval === "year" ? interval : null,
  };
}
```

Run: `pnpm test src/lib/payments` → PASS. `pnpm typecheck` → clean.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(payments): normalise Stripe subscription events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Applying subscription events (idempotent, order-safe, grace period)

**Files:**
- Create: `src/server/payments/apply-event.ts`, `supabase/tests/payments-apply.test.ts`

**Interfaces:**
- Consumes: `NormalizedSubscriptionEvent`; `payment_events`; `subscriptions` columns from Task 1.
- Produces:
  - `GRACE_DAYS = 3`
  - `recordPaymentEvent(admin: TypedClient, e: { provider; eventId; type; userId: string | null; payload: unknown }): Promise<"new" | "seen" | "retry">` — inserts; `"seen"` when the event exists with `processed_at` set, `"retry"` when it exists unprocessed.
  - `markPaymentEvent(admin, provider, eventId, error: string | null): Promise<void>` — sets `processed_at = now()` (and `error`).
  - `applySubscriptionEvent(admin: TypedClient, e: NormalizedSubscriptionEvent): Promise<"applied" | "stale" | "no_user">` — finds the user (metadata `userId`, else by `provider_customer_id`/`provider_sub_id`), ignores events older than `provider_event_at`, resolves `plan_id` from `plans.provider_price_ids ->> provider = priceId`, writes the row (paid replaces manual), sets/keeps/clears `grace_until`, stores the price snapshot.

- [ ] **Step 1: Write the failing DB tests**

`supabase/tests/payments-apply.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import type { NormalizedSubscriptionEvent } from "@/lib/payments/types";
import { applySubscriptionEvent, markPaymentEvent, recordPaymentEvent } from "@/server/payments/apply-event";
import { adminClient, createUser, grantAccess, type TypedClient } from "./helpers";

let admin: TypedClient;
const day = 86_400_000;

beforeAll(() => {
  admin = adminClient();
});

function event(userId: string, over: Partial<NormalizedSubscriptionEvent> = {}): NormalizedSubscriptionEvent {
  return {
    provider: "stripe",
    eventId: `evt_${crypto.randomUUID()}`,
    type: "customer.subscription.updated",
    occurredAt: new Date().toISOString(),
    userId,
    customerId: `cus_${userId.slice(0, 8)}`,
    subscriptionId: `sub_${userId.slice(0, 8)}`,
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * day).toISOString(),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    priceId: "price_test_month",
    priceCents: 1990,
    interval: "month",
    ...over,
  };
}

async function row(userId: string) {
  const { data, error } = await admin.from("subscriptions").select("*").eq("user_id", userId).single();
  expect(error).toBeNull();
  return data!;
}

async function access(userId: string) {
  return (await admin.rpc("has_active_access", { uid: userId })).data === true;
}

describe("recordPaymentEvent", () => {
  it("reports new, retry and seen", async () => {
    const id = `evt_${crypto.randomUUID()}`;
    const e = { provider: "stripe" as const, eventId: id, type: "t", userId: null, payload: { a: 1 } };
    expect(await recordPaymentEvent(admin, e)).toBe("new");
    expect(await recordPaymentEvent(admin, e)).toBe("retry");
    await markPaymentEvent(admin, "stripe", id, null);
    expect(await recordPaymentEvent(admin, e)).toBe("seen");
  });
});

describe("applySubscriptionEvent", () => {
  it("activates a new subscriber with the plan and the price snapshot", async () => {
    const user = await createUser(admin, "pay-new");
    await admin.from("plans").update({ provider_price_ids: { stripe: "price_test_month" } }).eq("interval", "month");
    expect(await applySubscriptionEvent(admin, event(user.id))).toBe("applied");
    const r = await row(user.id);
    expect(r).toMatchObject({ provider: "stripe", status: "active", price_cents: 1990, billing_interval: "month", cancel_at_period_end: false });
    expect(r.plan_id).not.toBeNull();
    expect(await access(user.id)).toBe(true);
  });

  it("replaces a manual grant with the paid subscription", async () => {
    const user = await createUser(admin, "pay-over-manual");
    await grantAccess(admin, user.id);
    await applySubscriptionEvent(admin, event(user.id));
    expect((await row(user.id)).provider).toBe("stripe");
  });

  it("ignores an older event that arrives after a newer one", async () => {
    const user = await createUser(admin, "pay-order");
    const newer = event(user.id, { occurredAt: new Date(Date.now() - 1000).toISOString(), status: "canceled", canceledAt: new Date().toISOString() });
    const older = event(user.id, { occurredAt: new Date(Date.now() - 60_000).toISOString(), status: "active" });
    expect(await applySubscriptionEvent(admin, newer)).toBe("applied");
    expect(await applySubscriptionEvent(admin, older)).toBe("stale");
    expect((await row(user.id)).status).toBe("canceled");
  });

  it("gives 3 days of grace on a failed renewal, keeps it on retries and clears it after payment", async () => {
    const user = await createUser(admin, "pay-grace");
    await applySubscriptionEvent(admin, event(user.id, { occurredAt: new Date(Date.now() - 3000).toISOString() }));
    await applySubscriptionEvent(admin, event(user.id, { status: "past_due", occurredAt: new Date(Date.now() - 2000).toISOString() }));
    const first = (await row(user.id)).grace_until!;
    expect(Date.parse(first) - Date.now()).toBeGreaterThan(2.9 * day);
    expect(await access(user.id)).toBe(true);
    await applySubscriptionEvent(admin, event(user.id, { status: "past_due", occurredAt: new Date(Date.now() - 1000).toISOString() }));
    expect((await row(user.id)).grace_until).toBe(first);
    await applySubscriptionEvent(admin, event(user.id, { status: "active" }));
    expect((await row(user.id)).grace_until).toBeNull();
  });

  it("keeps access after a cancel-at-period-end and records the real end on deletion", async () => {
    const user = await createUser(admin, "pay-cancel");
    const end = new Date(Date.now() + 5 * day).toISOString();
    await applySubscriptionEvent(admin, event(user.id, { cancelAtPeriodEnd: true, currentPeriodEnd: end, occurredAt: new Date(Date.now() - 2000).toISOString() }));
    expect(await row(user.id)).toMatchObject({ status: "active", cancel_at_period_end: true, canceled_at: null });
    expect(await access(user.id)).toBe(true);
    const endedAt = new Date().toISOString();
    await applySubscriptionEvent(admin, event(user.id, { type: "customer.subscription.deleted", status: "canceled", canceledAt: endedAt, currentPeriodEnd: endedAt }));
    const r = await row(user.id);
    expect(r.status).toBe("canceled");
    expect(Date.parse(r.canceled_at!)).toBe(Date.parse(endedAt));
    expect(await access(user.id)).toBe(false);
  });

  it("finds the user by customer id when metadata is missing", async () => {
    const user = await createUser(admin, "pay-bycustomer");
    const first = event(user.id, { occurredAt: new Date(Date.now() - 1000).toISOString() });
    await applySubscriptionEvent(admin, first);
    expect(await applySubscriptionEvent(admin, { ...event(user.id), userId: null, customerId: first.customerId, status: "past_due" })).toBe("applied");
    expect((await row(user.id)).status).toBe("past_due");
  });

  it("reports no_user when nobody matches", async () => {
    expect(await applySubscriptionEvent(admin, { ...event(crypto.randomUUID()), customerId: "cus_nobody", subscriptionId: "sub_nobody" })).toBe("no_user");
  });
});
```

Run: `pnpm test:db supabase/tests/payments-apply.test.ts` → FAIL.

- [ ] **Step 2: Implement**

`src/server/payments/apply-event.ts`:

```ts
import type { NormalizedSubscriptionEvent, PaidProvider } from "@/lib/payments/types";
import type { TypedClient } from "@/server/db/types";

export const GRACE_DAYS = 3;

/** Stores the raw webhook once. "seen" = already processed; "retry" = stored but not processed yet. */
export async function recordPaymentEvent(
  admin: TypedClient,
  e: { provider: PaidProvider; eventId: string; type: string; userId: string | null; payload: unknown },
): Promise<"new" | "seen" | "retry"> {
  const { error } = await admin.from("payment_events").insert({
    provider: e.provider,
    event_id: e.eventId,
    type: e.type.slice(0, 100),
    user_id: e.userId,
    payload: e.payload as never,
  });
  if (!error) return "new";
  if (error.code !== "23505") throw new Error(`store payment event failed: ${error.message}`);
  const { data, error: loadError } = await admin
    .from("payment_events")
    .select("processed_at")
    .eq("provider", e.provider)
    .eq("event_id", e.eventId)
    .single();
  if (loadError) throw new Error(`load payment event failed: ${loadError.message}`);
  return data.processed_at ? "seen" : "retry";
}

export async function markPaymentEvent(
  admin: TypedClient,
  provider: PaidProvider,
  eventId: string,
  errorText: string | null,
): Promise<void> {
  const { error } = await admin
    .from("payment_events")
    .update({ processed_at: new Date().toISOString(), error: errorText?.slice(0, 1000) ?? null })
    .eq("provider", provider)
    .eq("event_id", eventId);
  if (error) throw new Error(`mark payment event failed: ${error.message}`);
}

async function findUserId(admin: TypedClient, e: NormalizedSubscriptionEvent): Promise<string | null> {
  if (e.userId) {
    const { data } = await admin.from("profiles").select("id").eq("id", e.userId).maybeSingle();
    if (data) return data.id;
  }
  for (const [column, value] of [["provider_sub_id", e.subscriptionId], ["provider_customer_id", e.customerId]] as const) {
    if (!value) continue;
    const { data, error } = await admin.from("subscriptions").select("user_id").eq(column, value).limit(1).maybeSingle();
    if (error) throw new Error(`find subscriber failed: ${error.message}`);
    if (data) return data.user_id;
  }
  return null;
}

/** Applies one provider event to the user's single subscription row. */
export async function applySubscriptionEvent(
  admin: TypedClient,
  e: NormalizedSubscriptionEvent,
): Promise<"applied" | "stale" | "no_user"> {
  const userId = await findUserId(admin, e);
  if (!userId) return "no_user";

  const { data: current, error: loadError } = await admin
    .from("subscriptions")
    .select("provider, status, grace_until, provider_event_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) throw new Error(`load subscription failed: ${loadError.message}`);
  if (
    current?.provider === e.provider &&
    current.provider_event_at &&
    Date.parse(current.provider_event_at) > Date.parse(e.occurredAt)
  ) {
    return "stale";
  }

  let planId: string | null = null;
  if (e.priceId) {
    const { data: plan } = await admin
      .from("plans")
      .select("id")
      .eq(`provider_price_ids->>${e.provider}`, e.priceId)
      .limit(1)
      .maybeSingle();
    planId = plan?.id ?? null;
  }

  const keepGrace = current?.provider === e.provider && current.status === "past_due" && current.grace_until;
  const grace_until =
    e.status === "past_due"
      ? keepGrace
        ? current!.grace_until
        : new Date(Date.parse(e.occurredAt) + GRACE_DAYS * 86_400_000).toISOString()
      : null;

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      provider: e.provider,
      provider_customer_id: e.customerId,
      provider_sub_id: e.subscriptionId,
      status: e.status,
      current_period_end: e.currentPeriodEnd,
      cancel_at_period_end: e.cancelAtPeriodEnd,
      canceled_at: e.status === "canceled" ? (e.canceledAt ?? e.occurredAt) : null,
      grace_until,
      plan_id: planId,
      price_cents: e.priceCents,
      billing_interval: e.interval,
      provider_event_at: e.occurredAt,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`apply subscription event failed: ${error.message}`);
  return "applied";
}
```

(If the `->>` filter syntax is not accepted by supabase-js for the jsonb key, use `.filter("provider_price_ids->>stripe", "eq", e.priceId)` with the provider name interpolated from the typed union.)

Run: `pnpm test:db supabase/tests/payments-apply.test.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(payments): idempotent, order-safe subscription event application with grace period

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Provider interface, Stripe adapter, webhook handler, registry

**Files:**
- Create: `src/server/payments/provider.ts`, `src/server/payments/stripe-provider.ts`, `src/server/payments/stripe-provider.test.ts`, `src/server/payments/revolut-provider.ts`, `src/server/payments/webhook.ts`, `src/server/payments/webhook.test.ts`, `src/server/payments/registry.ts`
- Modify: `src/lib/env-schema.ts` (+ `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, both `optionalFromEnv`), `src/lib/env-schema.test.ts`, `.env.example`

**Interfaces:**
- Produces:
  - `class ProviderUnavailableError extends Error`
  - `interface CheckoutInput { userId: string; email: string; customerId: string | null; priceId: string; successUrl: string; cancelUrl: string }`
  - `interface PaymentProvider { readonly name: PaidProvider; readonly ready: boolean; createCheckout(i: CheckoutInput): Promise<{ url: string }>; createPortal(i: { customerId: string; returnUrl: string }): Promise<{ url: string }>; cancelNow(subscriptionId: string): Promise<void>; parseWebhook(rawBody: string, headers: Headers): Promise<{ event: NormalizedSubscriptionEvent | null; eventId: string; type: string; payload: unknown }> }` — `parseWebhook` throws `WebhookSignatureError` on a bad signature.
  - `class WebhookSignatureError extends Error`
  - `createStripeProvider(config: { secretKey?: string; webhookSecret?: string }, client?: StripeLike): PaymentProvider`
  - `createRevolutProvider(): PaymentProvider` (ready = false; every method throws `ProviderUnavailableError`)
  - `handleWebhook(provider: PaymentProvider, rawBody: string, headers: Headers, admin: TypedClient): Promise<{ status: number; body: string }>` — 400 bad signature, 200 for seen/ignored/applied, 500 when applying throws (event stays unprocessed so the provider retries).
  - `getActiveProvider(db: TypedClient, env: { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string }): Promise<PaymentProvider>` — reads `active_payment_provider()`.

- [ ] **Step 1: Write the failing unit tests**

`src/server/payments/stripe-provider.test.ts`:

```ts
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { stripeSubscriptionEvent } from "@/lib/payments/fixtures/stripe-events";
import { ProviderUnavailableError, WebhookSignatureError } from "./provider";
import { createStripeProvider } from "./stripe-provider";

const SECRET = "whsec_test_secret";

function fakeClient() {
  return {
    checkout: { sessions: { create: vi.fn(async () => ({ url: "https://checkout.stripe.test/s/1" })) } },
    billingPortal: { sessions: { create: vi.fn(async () => ({ url: "https://billing.stripe.test/p/1" })) } },
    subscriptions: { cancel: vi.fn(async () => ({ id: "sub_1", status: "canceled" })) },
    webhooks: new Stripe("sk_test_dummy").webhooks,
  };
}

describe("StripeProvider", () => {
  it("creates a subscription checkout tied to the user", async () => {
    const client = fakeClient();
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
    const { url } = await p.createCheckout({
      userId: "u1", email: "ani@example.test", customerId: null, priceId: "price_1",
      successUrl: "http://localhost:3120/app/welcome?session_id={CHECKOUT_SESSION_ID}", cancelUrl: "http://localhost:3120/app/plan",
    });
    expect(url).toBe("https://checkout.stripe.test/s/1");
    expect(client.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_1", quantity: 1 }],
        client_reference_id: "u1",
        customer_email: "ani@example.test",
        subscription_data: { metadata: { user_id: "u1" } },
        metadata: { user_id: "u1" },
        allow_promotion_codes: true,
        locale: "bg",
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
  });

  it("reuses an existing customer instead of the email", async () => {
    const client = fakeClient();
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
    await p.createCheckout({ userId: "u1", email: "a@example.test", customerId: "cus_9", priceId: "price_1", successUrl: "s", cancelUrl: "c" });
    const args = client.checkout.sessions.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.customer).toBe("cus_9");
    expect(args.customer_email).toBeUndefined();
  });

  it("verifies webhook signatures and normalises subscription events", async () => {
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, fakeClient());
    const payload = JSON.stringify(stripeSubscriptionEvent({ id: "evt_sig" }));
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const parsed = await p.parseWebhook(payload, new Headers({ "stripe-signature": header }));
    expect(parsed.eventId).toBe("evt_sig");
    expect(parsed.event?.status).toBe("active");
  });

  it("rejects a forged or missing signature", async () => {
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, fakeClient());
    const payload = JSON.stringify(stripeSubscriptionEvent());
    const forged = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_other" });
    await expect(p.parseWebhook(payload, new Headers({ "stripe-signature": forged }))).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(p.parseWebhook(payload, new Headers())).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("is not ready without keys", async () => {
    const p = createStripeProvider({}, fakeClient());
    expect(p.ready).toBe(false);
    await expect(p.createPortal({ customerId: "cus_1", returnUrl: "r" })).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("cancels a subscription immediately", async () => {
    const client = fakeClient();
    await createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client).cancelNow("sub_1");
    expect(client.subscriptions.cancel).toHaveBeenCalledWith("sub_1");
  });
});
```

`src/server/payments/webhook.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { NormalizedSubscriptionEvent } from "@/lib/payments/types";
import type { TypedClient } from "@/server/db/types";
import { WebhookSignatureError, type PaymentProvider } from "./provider";

vi.mock("./apply-event", () => ({
  recordPaymentEvent: vi.fn(),
  markPaymentEvent: vi.fn(),
  applySubscriptionEvent: vi.fn(),
}));
const applyMod = await import("./apply-event");
const { handleWebhook } = await import("./webhook");

const db = {} as TypedClient;
const normalized = { eventId: "evt_1", userId: "u1" } as NormalizedSubscriptionEvent;

function provider(parse: PaymentProvider["parseWebhook"]): PaymentProvider {
  return { name: "stripe", ready: true, parseWebhook: parse } as PaymentProvider;
}

describe("handleWebhook", () => {
  it("answers 400 to a bad signature and stores nothing", async () => {
    const res = await handleWebhook(provider(async () => { throw new WebhookSignatureError("bad"); }), "{}", new Headers(), db);
    expect(res.status).toBe(400);
    expect(applyMod.recordPaymentEvent).not.toHaveBeenCalled();
  });

  it("skips an already processed event", async () => {
    vi.mocked(applyMod.recordPaymentEvent).mockResolvedValueOnce("seen");
    const res = await handleWebhook(provider(async () => ({ event: normalized, eventId: "evt_1", type: "t", payload: {} })), "{}", new Headers(), db);
    expect(res.status).toBe(200);
    expect(applyMod.applySubscriptionEvent).not.toHaveBeenCalled();
  });

  it("applies a new event and marks it processed", async () => {
    vi.mocked(applyMod.recordPaymentEvent).mockResolvedValueOnce("new");
    vi.mocked(applyMod.applySubscriptionEvent).mockResolvedValueOnce("applied");
    const res = await handleWebhook(provider(async () => ({ event: normalized, eventId: "evt_1", type: "t", payload: {} })), "{}", new Headers(), db);
    expect(res.status).toBe(200);
    expect(applyMod.markPaymentEvent).toHaveBeenCalledWith(db, "stripe", "evt_1", null);
  });

  it("marks ignored event types processed without applying", async () => {
    vi.mocked(applyMod.recordPaymentEvent).mockResolvedValueOnce("new");
    const res = await handleWebhook(provider(async () => ({ event: null, eventId: "evt_2", type: "invoice.paid", payload: {} })), "{}", new Headers(), db);
    expect(res.status).toBe(200);
    expect(applyMod.markPaymentEvent).toHaveBeenCalledWith(db, "stripe", "evt_2", null);
  });

  it("answers 500 and leaves the event unprocessed when applying fails", async () => {
    vi.mocked(applyMod.markPaymentEvent).mockClear();
    vi.mocked(applyMod.recordPaymentEvent).mockResolvedValueOnce("new");
    vi.mocked(applyMod.applySubscriptionEvent).mockRejectedValueOnce(new Error("db down"));
    const res = await handleWebhook(provider(async () => ({ event: normalized, eventId: "evt_3", type: "t", payload: {} })), "{}", new Headers(), db);
    expect(res.status).toBe(500);
    expect(applyMod.markPaymentEvent).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm test src/server/payments` → FAIL.

- [ ] **Step 2: Implement**

`src/server/payments/provider.ts`:

```ts
import type { NormalizedSubscriptionEvent, PaidProvider } from "@/lib/payments/types";

export class ProviderUnavailableError extends Error {
  constructor(provider: string) {
    super(`${provider} payments are not configured`);
    this.name = "ProviderUnavailableError";
  }
}

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export interface CheckoutInput {
  userId: string;
  email: string;
  customerId: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface ParsedWebhook {
  event: NormalizedSubscriptionEvent | null;
  eventId: string;
  type: string;
  payload: unknown;
}

export interface PaymentProvider {
  readonly name: PaidProvider;
  readonly ready: boolean;
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  cancelNow(subscriptionId: string): Promise<void>;
  parseWebhook(rawBody: string, headers: Headers): Promise<ParsedWebhook>;
}
```

`src/server/payments/stripe-provider.ts`:

```ts
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { normalizeStripeEvent } from "@/lib/payments/stripe-normalize";
import { ProviderUnavailableError, WebhookSignatureError, type PaymentProvider } from "./provider";

/** The slice of the Stripe client we use; tests pass a fake. */
export interface StripeLike {
  checkout: { sessions: { create: (params: Stripe.Checkout.SessionCreateParams, options?: Stripe.RequestOptions) => Promise<{ url: string | null }> } };
  billingPortal: { sessions: { create: (params: Stripe.BillingPortal.SessionCreateParams) => Promise<{ url: string }> } };
  subscriptions: { cancel: (id: string) => Promise<unknown> };
  webhooks: Pick<Stripe["webhooks"], "constructEvent">;
}

export function createStripeProvider(
  config: { secretKey?: string; webhookSecret?: string },
  client?: StripeLike,
): PaymentProvider {
  const ready = Boolean(config.secretKey && config.webhookSecret);
  const stripe: StripeLike | null = client ?? (config.secretKey ? (new Stripe(config.secretKey) as unknown as StripeLike) : null);
  const need = () => {
    if (!ready || !stripe) throw new ProviderUnavailableError("stripe");
    return stripe;
  };

  return {
    name: "stripe",
    ready,
    async createCheckout(i) {
      const session = await need().checkout.sessions.create(
        {
          mode: "subscription",
          line_items: [{ price: i.priceId, quantity: 1 }],
          success_url: i.successUrl,
          cancel_url: i.cancelUrl,
          client_reference_id: i.userId,
          ...(i.customerId ? { customer: i.customerId } : { customer_email: i.email }),
          subscription_data: { metadata: { user_id: i.userId } },
          metadata: { user_id: i.userId },
          allow_promotion_codes: true,
          locale: "bg",
        },
        { idempotencyKey: `checkout-${i.userId}-${i.priceId}-${randomUUID()}` },
      );
      if (!session.url) throw new Error("stripe returned no checkout url");
      return { url: session.url };
    },
    async createPortal(i) {
      const session = await need().billingPortal.sessions.create({ customer: i.customerId, return_url: i.returnUrl, locale: "bg" });
      return { url: session.url };
    },
    async cancelNow(subscriptionId) {
      await need().subscriptions.cancel(subscriptionId);
    },
    async parseWebhook(rawBody, headers) {
      const signature = headers.get("stripe-signature");
      if (!signature || !config.webhookSecret || !stripe) throw new WebhookSignatureError("missing signature or secret");
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
      } catch {
        throw new WebhookSignatureError("invalid signature");
      }
      return { event: normalizeStripeEvent(event), eventId: event.id, type: event.type, payload: event };
    },
  };
}
```

(`createPortal` — if `locale: "bg"` is rejected by the installed SDK types for billing portal, drop it.)

`src/server/payments/revolut-provider.ts`:

```ts
import { ProviderUnavailableError, WebhookSignatureError, type PaymentProvider } from "./provider";

/**
 * Placeholder until a Revolut Business merchant sandbox exists: the Merchant API subscription
 * flow and webhook event names must be verified against the live docs before implementing.
 */
export function createRevolutProvider(): PaymentProvider {
  const unavailable = async (): Promise<never> => {
    throw new ProviderUnavailableError("revolut");
  };
  return {
    name: "revolut",
    ready: false,
    createCheckout: unavailable,
    createPortal: unavailable,
    cancelNow: unavailable,
    async parseWebhook() {
      throw new WebhookSignatureError("revolut webhooks are not enabled");
    },
  };
}
```

`src/server/payments/webhook.ts`:

```ts
import type { TypedClient } from "@/server/db/types";
import { applySubscriptionEvent, markPaymentEvent, recordPaymentEvent } from "./apply-event";
import { WebhookSignatureError, type PaymentProvider } from "./provider";

/** Verify → store once → apply → mark processed. A 500 makes the provider retry later. */
export async function handleWebhook(
  provider: PaymentProvider,
  rawBody: string,
  headers: Headers,
  admin: TypedClient,
): Promise<{ status: number; body: string }> {
  let parsed;
  try {
    parsed = await provider.parseWebhook(rawBody, headers);
  } catch (error) {
    if (error instanceof WebhookSignatureError) return { status: 400, body: "invalid signature" };
    throw error;
  }
  const state = await recordPaymentEvent(admin, {
    provider: provider.name,
    eventId: parsed.eventId,
    type: parsed.type,
    userId: parsed.event?.userId ?? null,
    payload: parsed.payload,
  });
  if (state === "seen") return { status: 200, body: "duplicate" };
  if (!parsed.event) {
    await markPaymentEvent(admin, provider.name, parsed.eventId, null);
    return { status: 200, body: "ignored" };
  }
  try {
    const result = await applySubscriptionEvent(admin, parsed.event);
    await markPaymentEvent(admin, provider.name, parsed.eventId, result === "no_user" ? "no matching user" : null);
    return { status: 200, body: result };
  } catch (error) {
    console.error("payment webhook apply failed", parsed.eventId, error instanceof Error ? error.message : "unknown");
    return { status: 500, body: "retry" };
  }
}
```

`src/server/payments/registry.ts`:

```ts
import type { TypedClient } from "@/server/db/types";
import type { PaymentProvider } from "./provider";
import { createRevolutProvider } from "./revolut-provider";
import { createStripeProvider } from "./stripe-provider";

export async function getActiveProvider(
  db: TypedClient,
  env: { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string },
): Promise<PaymentProvider> {
  const { data, error } = await db.rpc("active_payment_provider");
  if (error) throw new Error(`load payment provider failed: ${error.message}`);
  return data === "revolut"
    ? createRevolutProvider()
    : createStripeProvider({ secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET });
}
```

In `src/lib/env-schema.ts` add to `serverEnvSchema`:

```ts
  // Optional: without them checkout shows "not configured" and the webhook answers 503.
  STRIPE_SECRET_KEY: optionalFromEnv(z.string().regex(/^(sk|rk)_(test|live)_/, "Stripe secret key")),
  STRIPE_WEBHOOK_SECRET: optionalFromEnv(z.string().startsWith("whsec_")),
```

Add a unit test in `src/lib/env-schema.test.ts` (empty → undefined; `pk_test_…` rejected for the secret key). Append both names to `.env.example` under a `# Optional (payments)` heading.

Run: `pnpm test` → PASS; `pnpm typecheck` → clean.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(payments): provider interface, Stripe adapter, webhook handler, Revolut slot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Checkout, portal, webhook route, welcome page, profile button

**Files:**
- Create: `src/server/payments/checkout.ts`, `supabase/tests/payments-checkout.test.ts`, `src/app/api/pay/stripe/webhook/route.ts`, `src/app/app/plan/plan-picker.tsx`, `src/app/app/plan/actions.ts`, `src/app/app/welcome/page.tsx`, `src/app/app/welcome/welcome-poll.tsx`, `src/app/app/welcome/actions.ts`
- Modify: `src/app/app/plan/page.tsx` (picker instead of the disabled button), `src/app/app/profile/page.tsx` + `src/app/app/profile/actions.ts` (manage subscription), `src/proxy.ts` matcher (exclude `api/pay`)

**Interfaces:**
- Consumes: `getActiveProvider`, `PaymentProvider`, `ProviderUnavailableError`, `handleWebhook`, `createAdminSupabaseClient`, `requireUser`, `serverEnv`.
- Produces:
  - `startCheckout(db: TypedClient, provider: PaymentProvider, i: { userId: string; email: string; planId: string; appUrl: string }): Promise<{ url: string }>` — validates the plan is active and has a price id for the provider; refuses when the user already has access (`AppError("CONFLICT", "Вече имаш активен абонамент.")`); reuses `subscriptions.provider_customer_id` when the provider matches.
  - `openPortal(db, provider, i: { userId: string; appUrl: string }): Promise<{ url: string }>` — needs a customer id for that provider, else `AppError("NOT_FOUND", "Няма абонамент за управление.")`.
  - actions `startCheckoutAction(planId: string)`, `openPortalAction()`, `checkAccessAction()` (welcome polling) → `ActionResult`.

- [ ] **Step 1: Failing DB tests for the services**

`supabase/tests/payments-checkout.test.ts`:

```ts
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PaymentProvider } from "@/server/payments/provider";
import { openPortal, startCheckout } from "@/server/payments/checkout";
import { adminClient, createUser, grantAccess, signedInClient, type TypedClient } from "./helpers";

let admin: TypedClient;
let monthlyId: string;

beforeAll(async () => {
  admin = adminClient();
  const { data } = await admin.from("plans").update({ provider_price_ids: { stripe: "price_test_month" } }).eq("interval", "month").select("id").single();
  monthlyId = data!.id;
});

function fakeProvider(): PaymentProvider & { createCheckout: ReturnType<typeof vi.fn>; createPortal: ReturnType<typeof vi.fn> } {
  return {
    name: "stripe",
    ready: true,
    createCheckout: vi.fn(async () => ({ url: "https://pay.example/1" })),
    createPortal: vi.fn(async () => ({ url: "https://portal.example/1" })),
    cancelNow: vi.fn(),
    parseWebhook: vi.fn(),
  } as never;
}

describe("startCheckout", () => {
  it("sends the plan's price, success/cancel urls and the user", async () => {
    const user = await createUser(admin, "co-new");
    const p = fakeProvider();
    const { url } = await startCheckout(await signedInClient(user), p, { userId: user.id, email: user.email, planId: monthlyId, appUrl: "http://localhost:3120" });
    expect(url).toBe("https://pay.example/1");
    expect(p.createCheckout).toHaveBeenCalledWith({
      userId: user.id, email: user.email, customerId: null, priceId: "price_test_month",
      successUrl: "http://localhost:3120/app/welcome?session_id={CHECKOUT_SESSION_ID}", cancelUrl: "http://localhost:3120/app/plan",
    });
  });

  it("refuses a user who already has access, an inactive plan and a plan without a price id", async () => {
    const user = await createUser(admin, "co-has");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);
    await expect(startCheckout(db, fakeProvider(), { userId: user.id, email: user.email, planId: monthlyId, appUrl: "x" })).rejects.toMatchObject({ code: "CONFLICT" });
    const other = await createUser(admin, "co-plan");
    const { data: yearly } = await admin.from("plans").select("id").eq("interval", "year").single();
    await admin.from("plans").update({ provider_price_ids: {} }).eq("id", yearly!.id);
    await expect(startCheckout(await signedInClient(other), fakeProvider(), { userId: other.id, email: other.email, planId: yearly!.id, appUrl: "x" })).rejects.toMatchObject({ code: "INVALID" });
    await expect(startCheckout(await signedInClient(other), fakeProvider(), { userId: other.id, email: other.email, planId: crypto.randomUUID(), appUrl: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reuses the stored customer of a former subscriber", async () => {
    const user = await createUser(admin, "co-former");
    await admin.from("subscriptions").insert({ user_id: user.id, provider: "stripe", status: "canceled", provider_customer_id: "cus_old", current_period_end: new Date(Date.now() - 1000).toISOString() });
    const p = fakeProvider();
    await startCheckout(await signedInClient(user), p, { userId: user.id, email: user.email, planId: monthlyId, appUrl: "x" });
    expect(p.createCheckout.mock.calls[0]![0]).toMatchObject({ customerId: "cus_old" });
  });
});

describe("openPortal", () => {
  it("opens the portal for a customer and refuses without one", async () => {
    const user = await createUser(admin, "co-portal");
    const p = fakeProvider();
    await expect(openPortal(await signedInClient(user), p, { userId: user.id, appUrl: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await admin.from("subscriptions").insert({ user_id: user.id, provider: "stripe", status: "active", provider_customer_id: "cus_p" });
    await openPortal(await signedInClient(user), p, { userId: user.id, appUrl: "http://localhost:3120" });
    expect(p.createPortal).toHaveBeenCalledWith({ customerId: "cus_p", returnUrl: "http://localhost:3120/app/profile" });
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement the services**

`src/server/payments/checkout.ts`:

```ts
import { AppError } from "@/lib/app-error";
import type { TypedClient } from "@/server/db/types";
import type { PaymentProvider } from "./provider";

export async function startCheckout(
  db: TypedClient,
  provider: PaymentProvider,
  i: { userId: string; email: string; planId: string; appUrl: string },
): Promise<{ url: string }> {
  const [{ data: access, error: accessError }, { data: plan, error: planError }, { data: sub, error: subError }] = await Promise.all([
    db.rpc("my_access"),
    db.from("plans").select("id, active, provider_price_ids").eq("id", i.planId).maybeSingle(),
    db.from("subscriptions").select("provider, provider_customer_id").eq("user_id", i.userId).maybeSingle(),
  ]);
  const failed = accessError ?? planError ?? subError;
  if (failed) throw new Error(`load checkout data failed: ${failed.message}`);
  if (access) throw new AppError("CONFLICT", "Вече имаш активен абонамент.");
  if (!plan || !plan.active) throw new AppError("NOT_FOUND", "Планът не е намерен.");
  const priceId = (plan.provider_price_ids as Record<string, unknown> | null)?.[provider.name];
  if (typeof priceId !== "string" || !priceId) throw new AppError("INVALID", "Този план още не може да се плати онлайн.");
  return provider.createCheckout({
    userId: i.userId,
    email: i.email,
    customerId: sub?.provider === provider.name ? (sub.provider_customer_id ?? null) : null,
    priceId,
    successUrl: `${i.appUrl}/app/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${i.appUrl}/app/plan`,
  });
}

export async function openPortal(
  db: TypedClient,
  provider: PaymentProvider,
  i: { userId: string; appUrl: string },
): Promise<{ url: string }> {
  const { data: sub, error } = await db.from("subscriptions").select("provider, provider_customer_id").eq("user_id", i.userId).maybeSingle();
  if (error) throw new Error(`load subscription failed: ${error.message}`);
  if (!sub?.provider_customer_id || sub.provider !== provider.name) throw new AppError("NOT_FOUND", "Няма абонамент за управление.");
  return provider.createPortal({ customerId: sub.provider_customer_id, returnUrl: `${i.appUrl}/app/profile` });
}
```

Run → PASS.

- [ ] **Step 3: Route, actions and pages**

`src/app/api/pay/stripe/webhook/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/env";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { handleWebhook } from "@/server/payments/webhook";
import { createStripeProvider } from "@/server/payments/stripe-provider";

/** Stripe → us. Raw body is required for the signature check. */
export async function POST(request: NextRequest) {
  const provider = createStripeProvider({ secretKey: serverEnv.STRIPE_SECRET_KEY, webhookSecret: serverEnv.STRIPE_WEBHOOK_SECRET });
  if (!provider.ready) return new NextResponse("payments not configured", { status: 503 });
  const body = await request.text();
  if (body.length > 512_000) return new NextResponse("too large", { status: 413 });
  const result = await handleWebhook(provider, body, request.headers, createAdminSupabaseClient());
  return new NextResponse(result.body, { status: result.status });
}
```

(The Stripe route stays bound to Stripe regardless of the active provider, so renewals of existing Stripe subscribers keep working if the owner switches providers later.)

In `src/proxy.ts` add `api/pay` to the matcher's exclusions (no session refresh / redirects on webhooks).

`src/app/app/plan/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { serverEnv } from "@/env";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { requireUser } from "@/server/auth/require-user";
import { startCheckout } from "@/server/payments/checkout";
import { ProviderUnavailableError } from "@/server/payments/provider";
import { getActiveProvider } from "@/server/payments/registry";

export async function startCheckoutAction(planId: string): Promise<ActionResult<{ url: string }>> {
  try {
    const { user, supabase } = await requireUser();
    const provider = await getActiveProvider(supabase, serverEnv);
    if (!provider.ready) throw new AppError("INVALID", "Плащането още не е настроено. Опитай по-късно.");
    return actionOk(await startCheckout(supabase, provider, { userId: user.id, email: user.email ?? "", planId: z.uuid().parse(planId), appUrl: serverEnv.APP_URL }));
  } catch (error) {
    if (error instanceof ProviderUnavailableError) return { ok: false, message: "Плащането още не е настроено. Опитай по-късно." };
    return actionFail(error);
  }
}
```

`src/app/app/plan/plan-picker.tsx` (client): radio cards for the active plans (monthly preselected; yearly shows "X € на месец"), a primary button „Абонирай се" that calls `startCheckoutAction(selectedId)` in a transition, then `window.location.assign(result.data.url)`; shows the error message in `role="alert"`; button disabled while pending and when `ready === false` (prop) with the label „Плащането се включва скоро". Replace the disabled `<Button>` in `src/app/app/plan/page.tsx` with `<PlanPicker plans={plans} ready={paymentsReady} />`, where `paymentsReady` is computed in the page: `(await getActiveProvider(supabase, serverEnv)).ready`.

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { startCheckoutAction } from "./actions";

type Plan = { id: string; name: string; interval: "month" | "year"; price_cents: number; currency: string };

export function PlanPicker({ plans, ready }: { plans: Plan[]; ready: boolean }) {
  const [selected, setSelected] = useState(plans.find((p) => p.interval === "month")?.id ?? plans[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function subscribe() {
    setError("");
    startTransition(async () => {
      const result = await startCheckoutAction(selected);
      if (!result.ok) return setError(result.message);
      window.location.assign(result.data.url);
    });
  }

  return (
    <section className="space-y-3">
      <div role="radiogroup" aria-label="Избери план" className="space-y-3">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            role="radio"
            aria-checked={selected === plan.id}
            onClick={() => setSelected(plan.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-3xl border-2 bg-white p-5 text-left",
              selected === plan.id ? "border-ink" : "border-line",
            )}
          >
            <span>
              <span className="block font-display text-lg font-bold">{plan.name}</span>
              {plan.interval === "year" && (
                <span className="text-sm text-moss">{formatPrice(Math.round(plan.price_cents / 12), plan.currency)} на месец</span>
              )}
            </span>
            <span className="font-display text-xl font-bold">
              {formatPrice(plan.price_cents, plan.currency)}
              <span className="text-sm font-medium text-ink-soft">/{plan.interval === "month" ? "мес" : "год"}</span>
            </span>
          </button>
        ))}
      </div>
      <Button className="w-full" disabled={!ready || pending || !selected} onClick={subscribe}>
        {ready ? (pending ? "Пренасочване…" : "Абонирай се") : "Плащането се включва скоро"}
      </Button>
      <p className="text-center text-xs text-ink-soft">Плащане с карта, Apple Pay или Google Pay през Stripe. Можеш да откажеш по всяко време.</p>
      {error && <p role="alert" className="text-center text-sm text-brick">{error}</p>}
    </section>
  );
}
```

`src/app/app/welcome/actions.ts`:

```ts
"use server";

import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/require-user";

export async function checkAccessAction(): Promise<ActionResult<boolean>> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("my_access");
    if (error) throw new Error(`load access failed: ${error.message}`);
    return actionOk(data === true);
  } catch (error) {
    return actionFail(error);
  }
}
```

`src/app/app/welcome/welcome-poll.tsx` (client): every 1.5 s up to 15 s calls `checkAccessAction`; on `true` shows „Добре дошла! Абонаментът е активен." and `router.replace("/app")` after 1.2 s; after 15 s shows „Плащането се обработва — ще получиш имейл, а достъпът ще се отвори автоматично." with a link to `/app`.

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkAccessAction } from "./actions";

export function WelcomePoll() {
  const router = useRouter();
  const [state, setState] = useState<"waiting" | "active" | "slow">("waiting");

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    async function tick() {
      if (cancelled) return;
      const result = await checkAccessAction();
      if (cancelled) return;
      if (result.ok && result.data) {
        setState("active");
        setTimeout(() => router.replace("/app"), 1200);
        return;
      }
      if (Date.now() - started > 15_000) return setState("slow");
      setTimeout(tick, 1500);
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      {state === "waiting" && <p className="font-display text-2xl font-bold">Потвърждаваме плащането…</p>}
      {state === "active" && <p className="font-display text-2xl font-bold">Добре дошла! Абонаментът е активен.</p>}
      {state === "slow" && (
        <>
          <p className="font-display text-xl font-bold">Плащането се обработва</p>
          <p className="text-ink-soft">Ще получиш имейл, а достъпът ще се отвори автоматично до минута.</p>
          <Link href="/app" className="underline underline-offset-4">Към „Днес"</Link>
        </>
      )}
    </main>
  );
}
```

`src/app/app/welcome/page.tsx`:

```tsx
import { WelcomePoll } from "./welcome-poll";

export const metadata = { title: "Добре дошла" };

export default function WelcomePage() {
  return <WelcomePoll />;
}
```

Profile: in `src/app/app/profile/actions.ts` add `openPortalAction()` (requireUser → `getActiveProvider`/Stripe → `openPortal` → `ActionResult<{url}>`, map `ProviderUnavailableError` to the not-configured message), and in the subscription box of `src/app/app/profile/page.tsx` a client button „Управлявай абонамента" shown when the subscription provider is `stripe`, which calls it and `window.location.assign(url)`. Show „Абонаментът ще приключи на <дата>" when `cancel_at_period_end` is true (select the new column).

- [ ] **Step 4: Verify**

`pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint`, `pnpm build` → 0. Without Stripe env: `/app/plan` shows the picker with the disabled „Плащането се включва скоро"; `curl -X POST localhost:3120/api/pay/stripe/webhook` → 503. With a dummy `STRIPE_SECRET_KEY=sk_test_dummy` and `STRIPE_WEBHOOK_SECRET=whsec_dummy` in `.env.local` (remove afterwards): a webhook signed by a small node script with `Stripe.webhooks.generateTestHeaderString` for a fixture subscription event of a real local user (metadata.user_id) → 200 and the user gets access (`/app` unlocks); the same request again → 200 "duplicate"; a forged signature → 400. `/app/welcome` shows "Потвърждаваме…" then redirects once access exists. Real Checkout needs real Stripe test keys — skip it here and say so.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(payments): Stripe checkout, portal, webhook route, welcome page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Admin — Stripe price id per plan, price lock, manual grant via RPC, provider choice

**Files:**
- Modify: `src/server/admin/settings.ts` (`planInputSchema` + `stripePriceId`; `savePlan` locks price/interval once a price id exists), `src/app/admin/(panel)/settings/{forms.tsx,actions.ts}`, `src/server/admin/clients.ts` (`grantManualAccess` → RPC `admin_grant_manual`), `src/app/admin/(panel)/clients/[id]/page.tsx` (subscription box: provider, status, cancel at period end, period end, grace; grant form shown unless a paid subscription is live), `supabase/tests/admin-settings.test.ts`, `supabase/tests/admin-clients.test.ts`

**Interfaces:**
- Produces:
  - `planInputSchema` gains `stripePriceId: z.union([z.literal(""), z.string().regex(/^price_[A-Za-z0-9]+$/)])`
  - `savePlan(db, id, raw)`: when the stored plan already has `provider_price_ids.stripe`, a change of `priceCents` or `interval` throws `AppError("CONFLICT", "Цената е свързана със Stripe — за нова цена създай нов план.")`; the price id itself may be set when empty, and cleared only if no subscription references the plan.
  - `grantManualAccess(db, userId, days)` → calls `admin_grant_manual`, maps `23P01` → `AppError("CONFLICT", "Клиентката има активен платен абонамент.")`, `22023` → `AppError("INVALID", "Дните трябва да са между 1 и 365.")`, `P0002` → NOT_FOUND; returns the new end ISO.

- [ ] **Step 1: Failing DB tests**

Add to `supabase/tests/admin-settings.test.ts`:

```ts
it("locks price and interval once a Stripe price id is set", async () => {
  const name = `Stripe план ${Date.now()}`;
  await savePlan(boss, null, { name, interval: "month", priceCents: 1990, active: false, sort: 50, stripePriceId: "" });
  const plan = (await listPlans(boss)).find((p) => p.name === name)!;
  await savePlan(boss, plan.id, { name, interval: "month", priceCents: 1990, active: false, sort: 50, stripePriceId: "price_ABC123" });
  await expect(savePlan(boss, plan.id, { name, interval: "month", priceCents: 2490, active: false, sort: 50, stripePriceId: "price_ABC123" })).rejects.toMatchObject({ code: "CONFLICT" });
  await savePlan(boss, plan.id, { name: `${name} (нов надпис)`, interval: "month", priceCents: 1990, active: false, sort: 50, stripePriceId: "price_ABC123" });
  const { data } = await boss.from("plans").select("name, provider_price_ids").eq("id", plan.id).single();
  expect(data).toMatchObject({ provider_price_ids: { stripe: "price_ABC123" } });
});

it("rejects a malformed Stripe price id", async () => {
  await expect(savePlan(boss, null, { name: "x", interval: "month", priceCents: 100, active: false, sort: 1, stripePriceId: "prod_123" })).rejects.toThrow();
});
```

Update `supabase/tests/admin-clients.test.ts`: the paid-subscription refusal now expects code CONFLICT from the RPC path; add "former customer (canceled, period over) can be granted" and "grant returns the new end".

Run → FAIL.

- [ ] **Step 2: Implement**

`savePlan` (replace the body):

```ts
export async function savePlan(db: TypedClient, id: string | null, raw: unknown): Promise<void> {
  const p = planInputSchema.parse(raw);
  if (id) {
    const { data: current, error: loadError } = await db.from("plans").select("price_cents, interval, provider_price_ids").eq("id", id).maybeSingle();
    if (loadError) throw new Error(`load plan failed: ${loadError.message}`);
    if (!current) throw new AppError("NOT_FOUND", "Планът не е намерен.");
    const ids = (current.provider_price_ids ?? {}) as Record<string, string>;
    if (ids.stripe && (current.price_cents !== p.priceCents || current.interval !== p.interval)) {
      throw new AppError("CONFLICT", "Цената е свързана със Stripe — за нова цена създай нов план.");
    }
    if (ids.stripe && p.stripePriceId !== ids.stripe) {
      const { count, error: countError } = await db.from("subscriptions").select("user_id", { count: "exact", head: true }).eq("plan_id", id);
      if (countError) throw new Error(`count subscribers failed: ${countError.message}`);
      if ((count ?? 0) > 0) throw new AppError("CONFLICT", "Планът има абонати — Stripe цената не може да се смени.");
    }
    const provider_price_ids = { ...ids, ...(p.stripePriceId ? { stripe: p.stripePriceId } : {}) };
    if (!p.stripePriceId) delete provider_price_ids.stripe;
    const { data, error } = await db
      .from("plans")
      .update({ name: p.name, interval: p.interval, price_cents: p.priceCents, active: p.active, sort: p.sort, provider_price_ids })
      .eq("id", id)
      .select("id");
    if (error) throw new Error(`save plan failed: ${error.message}`);
    if (data.length === 0) throw new AppError("NOT_FOUND", "Планът не е намерен.");
    return;
  }
  const { error } = await db.from("plans").insert({
    name: p.name, interval: p.interval, price_cents: p.priceCents, active: p.active, sort: p.sort,
    provider_price_ids: p.stripePriceId ? { stripe: p.stripePriceId } : {},
  });
  if (error) throw new Error(`save plan failed: ${error.message}`);
}
```

`grantManualAccess`:

```ts
export async function grantManualAccess(db: TypedClient, userId: string, days: number): Promise<string> {
  const d = daysSchema.parse(days);
  const { data, error } = await db.rpc("admin_grant_manual", { p_user_id: userId, p_days: d });
  if (error?.code === "23P01") throw new AppError("CONFLICT", "Клиентката има активен платен абонамент.");
  if (error?.code === "22023") throw new AppError("INVALID", "Дните трябва да са между 1 и 365.");
  if (error?.code === "P0002") throw new AppError("NOT_FOUND", "Клиентката не е намерена.");
  if (error) throw new Error(`grant access failed: ${error.message}`);
  return data as string;
}
```

Plan form (`forms.tsx`): add a „Stripe Price ID" input (placeholder `price_…`); when the plan has one, render price and interval inputs `readOnly`/`disabled` with the hint „Цената идва от Stripe". `savePlanAction` reads `stripePriceId`. Payment provider select: Revolut option `disabled` with label „Revolut (скоро)". Client page subscription box shows provider, status, `cancel_at_period_end` („ще приключи на …"), period end and grace; the grant form is hidden only while a paid subscription is live (use `has_access && sub_provider !== 'manual'` from the detail or a small check), otherwise shown.

Run: `pnpm test:db` → PASS.

- [ ] **Step 3: Verify and commit**

`pnpm typecheck && pnpm lint && pnpm build`; browser (aal2 admin): set a Stripe price id on the monthly plan → price fields lock; try changing the price via a crafted request is refused (unit-tested); grant a former customer access. Then:

```bash
git add -A && git commit -m "feat(admin): Stripe price ids with price lock, RPC-based manual grants, payment status on client page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Account deletion cancels the paid subscription first

**Files:**
- Modify: `src/server/profile/profile.ts` (`deleteAccount` gains `cancelPaid` dependency), `src/app/app/profile/actions.ts`, `supabase/tests/profile.test.ts`

**Interfaces:**
- Produces: `deleteAccount(admin: TypedClient, userId: string, cancelPaid: (sub: { provider: string; subscriptionId: string }) => Promise<void> = async () => {}): Promise<void>` — when the user has a live non-manual subscription with a `provider_sub_id`, calls `cancelPaid` first; if it throws, throws `AppError("CONFLICT", "Не успяхме да спрем абонамента. Профилът не е изтрит — опитай пак или ни пиши.")` and deletes nothing.

- [ ] **Step 1: Failing tests** (append to `supabase/tests/profile.test.ts`):

```ts
it("cancels a live paid subscription before deleting the account", async () => {
  const user = await createUser(admin, "del-paid");
  await admin.from("subscriptions").insert({ user_id: user.id, provider: "stripe", status: "active", provider_sub_id: "sub_del" });
  const cancel = vi.fn(async () => {});
  await deleteAccount(admin, user.id, cancel);
  expect(cancel).toHaveBeenCalledWith({ provider: "stripe", subscriptionId: "sub_del" });
  const { data } = await admin.from("profiles").select("id").eq("id", user.id);
  expect(data).toEqual([]);
});

it("keeps the account when cancelling the paid subscription fails", async () => {
  const user = await createUser(admin, "del-fail");
  await admin.from("subscriptions").insert({ user_id: user.id, provider: "stripe", status: "active", provider_sub_id: "sub_fail" });
  await expect(deleteAccount(admin, user.id, async () => { throw new Error("stripe down"); })).rejects.toMatchObject({ code: "CONFLICT" });
  const { data } = await admin.from("profiles").select("id").eq("id", user.id);
  expect(data).toHaveLength(1);
});

it("does not call the provider for manual or ended subscriptions", async () => {
  const user = await createUser(admin, "del-manual");
  await grantAccess(admin, user.id);
  const cancel = vi.fn(async () => {});
  await deleteAccount(admin, user.id, cancel);
  expect(cancel).not.toHaveBeenCalled();
});
```

(import `vi` and `grantAccess`.) Run → FAIL.

- [ ] **Step 2: Implement**

At the start of `deleteAccount`:

```ts
  const { data: sub, error: subError } = await admin
    .from("subscriptions")
    .select("provider, provider_sub_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (subError) throw new Error(`load subscription failed: ${subError.message}`);
  const { data: live, error: liveError } = await admin.rpc("has_active_access", { uid: userId });
  if (liveError) throw new Error(`load access failed: ${liveError.message}`);
  if (sub && sub.provider !== "manual" && sub.provider_sub_id && live) {
    try {
      await cancelPaid({ provider: sub.provider, subscriptionId: sub.provider_sub_id });
    } catch (error) {
      console.error("cancel before delete failed", userId, error instanceof Error ? error.message : "unknown");
      throw new AppError("CONFLICT", "Не успяхме да спрем абонамента. Профилът не е изтрит — опитай пак или ни пиши.");
    }
  }
```

In `deleteMyAccount` pass a canceller: `async ({ provider, subscriptionId }) => { if (provider !== "stripe") throw new Error("unsupported provider"); await createStripeProvider({ secretKey: serverEnv.STRIPE_SECRET_KEY, webhookSecret: serverEnv.STRIPE_WEBHOOK_SECRET }).cancelNow(subscriptionId); }`. (If Stripe is not configured, `cancelNow` throws `ProviderUnavailableError` → deletion refused with the message — correct: we cannot leave a paying card behind.)

Run: `pnpm test:db supabase/tests/profile.test.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(payments): cancel the paid subscription before deleting an account

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: README payments setup, follow-ups, full verification

**Files:**
- Modify: `README.md` (Payments section), `docs/superpowers/plans/2026-10-14-fit-platform-1a-followups.md`

- [ ] **Step 1: README „Payments (Stripe)"**

```markdown
## Payments (Stripe)

1. Stripe dashboard (test mode first): create a Product „Абонамент" with two recurring Prices (monthly, yearly) in EUR.
2. Settings → Payment methods: enable Cards, Apple Pay, Google Pay (Apple Pay needs the domain verified in Stripe once the site has its own domain).
3. Settings → Customer portal: allow cancel (at period end), update payment method, view invoices; set the return URL to `<APP_URL>/app/profile`.
4. Developers → Webhooks: endpoint `<APP_URL>/api/pay/stripe/webhook`, events
   `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the signing secret.
5. Env: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…` (Vercel → Project → Environment Variables; never commit them).
6. Admin → Настройки → Планове: paste each Stripe Price ID (`price_…`) into its plan. After that the plan's price is locked; a new price = a new plan.
7. Test card: 4242 4242 4242 4242, any future date, any CVC. Failed renewal test: 4000 0000 0000 0341.
8. Switching to live: repeat 1–6 with live keys and live prices.

Revolut: the provider slot exists (`src/server/payments/revolut-provider.ts`) but is not implemented — it needs a Revolut Business merchant sandbox to verify the Merchant API subscription flow first.
```

- [ ] **Step 2: Follow-ups** — tick the 1C items done (payment_events without FK, cancel on deletion, rateWorkout result if done — else leave, plan price snapshot, canceled_at semantics, former-customer manual grant RPC, public provider read path, admin price drift) and add: Revolut adapter (needs sandbox), `invoice.payment_failed` email to the client (stage 4), tracking purchase events from `applySubscriptionEvent` (1D), Apple Pay domain verification at go-live.

- [ ] **Step 3: Full verification**

```bash
export PATH="$HOME/.npm-global/bin:$PATH" DOCKER_CONFIG=/tmp/dockercfg
pnpm typecheck && pnpm lint && pnpm test && pnpm db:reset && pnpm test:db && pnpm build
```

Browser walkthrough (mobile 375 + desktop): no-access client → `/app/plan` picker (disabled without keys); with dummy keys + a signed fixture webhook (as in Task 5) → access opens, `/app/welcome` redirects, profile shows „Управлявай абонамента" (portal call fails without real keys — show the error message, not a crash); admin client page shows the Stripe subscription; deletion of that client with dummy keys is refused with the CONFLICT message (cancelNow fails against the fake key) and the account stays. Remove dummy keys from `.env.local` afterwards; `pnpm db:reset`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: Stripe setup guide and 1C follow-ups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
