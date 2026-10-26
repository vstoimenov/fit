import { connection } from "next/server";
import { Suspense } from "react";
import { utcToZoned } from "@/lib/admin/time";
import { formatPrice } from "@/lib/format";
import { formatCode } from "@/lib/gift/code";
import { giftMonthsLabel } from "@/lib/site/gift";
import { requireAdmin } from "@/server/admin/require-admin";
import { listVouchers } from "@/server/gift/admin";
import { IssueVoucherForm } from "./form";

export const metadata = { title: "Ваучери" };

export default function VouchersPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Vouchers />
    </Suspense>
  );
}

async function Vouchers() {
  await connection();
  const { supabase } = await requireAdmin();
  const vouchers = await listVouchers(supabase);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold">Ваучери</h1>
      <section className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="mb-4 font-semibold">Издай безплатен ваучер</h2>
        <IssueVoucherForm />
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Всички ваучери ({vouchers.length})</h2>
        {vouchers.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-ink-soft ring-1 ring-line">
            Още няма ваучери.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
            <table className="w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-ink-soft uppercase">
                <tr>
                  <th className="px-3 py-2">Код</th>
                  <th className="px-3 py-2">Период</th>
                  <th className="px-3 py-2">Вид</th>
                  <th className="px-3 py-2">Купувач / бележка</th>
                  <th className="px-3 py-2">Създаден</th>
                  <th className="px-3 py-2">Състояние</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => {
                  const created = utcToZoned(v.created_at);
                  const expired = !v.redeemed_at && new Date(v.expires_at) < new Date();
                  return (
                    <tr key={v.id} className="border-t border-line">
                      <td className="px-3 py-2 font-semibold tracking-[0.06em]">
                        {formatCode(v.code)}
                      </td>
                      <td className="px-3 py-2">{giftMonthsLabel(v.months)}</td>
                      <td className="px-3 py-2 text-ink-soft">
                        {v.kind === "stripe" ? formatPrice(v.amount_cents, "EUR") : "безплатен"}
                      </td>
                      <td className="px-3 py-2 break-all text-ink-soft">
                        {v.buyer_email ?? v.note ?? "—"}
                        {v.recipient_name ? ` · за ${v.recipient_name}` : ""}
                      </td>
                      <td className="px-3 py-2 text-ink-soft tabular-nums">
                        {created.date} {created.time}
                      </td>
                      <td className="px-3 py-2">
                        {v.redeemed_at
                          ? `активиран ${utcToZoned(v.redeemed_at).date}`
                          : expired
                            ? "изтекъл"
                            : "неизползван"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
