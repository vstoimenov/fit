import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/env";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { createStripeProvider } from "@/server/payments/stripe-provider";
import { handleWebhook } from "@/server/payments/webhook";

const MAX_BODY = 512_000;

/**
 * Stripe → us. The raw body is required for the signature check. This route stays bound to
 * Stripe whichever provider is active, so renewals of existing Stripe subscribers keep working
 * if the owner switches providers later.
 */
export async function POST(request: NextRequest) {
  const provider = createStripeProvider({
    secretKey: serverEnv.STRIPE_SECRET_KEY,
    webhookSecret: serverEnv.STRIPE_WEBHOOK_SECRET,
  });
  if (!provider.ready) return new NextResponse("payments not configured", { status: 503 });
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BODY) return new NextResponse("too large", { status: 413 });
  const body = await request.text();
  if (body.length > MAX_BODY) return new NextResponse("too large", { status: 413 });
  const result = await handleWebhook(provider, body, request.headers, createAdminSupabaseClient());
  return new NextResponse(result.body, { status: result.status });
}
