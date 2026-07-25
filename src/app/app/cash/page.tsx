import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { CashManager, type CollectionRow, type UncollectedRow } from "./cash-manager";

export default async function CashPage() {
  await requireAdmin("/app/cash");
  const t = await getTranslations();
  const supabase = await createClient();

  const { data: summaryRaw } = await supabase.rpc("cash_summary");
  const summary = (summaryRaw as { outstanding: number; deposited_month: number; collected_month: number }) ?? {
    outstanding: 0,
    deposited_month: 0,
    collected_month: 0,
  };

  const [outstandingRes, depositsRes, deliveredRes, collectedRes] = await Promise.all([
    supabase
      .from("cash_collections")
      .select("id,order_id,amount,collected_by,collected_at,order:orders(order_number,total_amount,customer:contacts(name))")
      .eq("status", "held")
      .order("collected_at", { ascending: false }),
    supabase
      .from("cash_collections")
      .select("id,amount,deposit_reference,deposited_at,collected_by,order:orders(order_number)")
      .eq("status", "deposited")
      .order("deposited_at", { ascending: false })
      .limit(20),
    supabase
      .from("orders")
      .select("id,order_number,total_amount,customer:contacts(name)")
      .eq("delivery_status", "delivered")
      .order("placed_at", { ascending: false })
      .limit(50),
    supabase.from("cash_collections").select("order_id"),
  ]);

  const outstanding: CollectionRow[] = (outstandingRes.data ?? []).map((r: any) => ({
    id: r.id,
    order_id: r.order_id,
    amount: Number(r.amount ?? 0),
    collected_by: r.collected_by,
    collected_at: r.collected_at,
    order_number: r.order?.order_number ?? r.order_id.slice(0, 8),
    customer_name: r.order?.customer?.name ?? "—",
  }));

  const collectedIds = new Set((collectedRes.data ?? []).map((r) => r.order_id));
  const uncollected: UncollectedRow[] = (deliveredRes.data ?? [])
    .filter((o: any) => !collectedIds.has(o.id))
    .map((o: any) => ({
      id: o.id,
      order_number: o.order_number ?? o.id.slice(0, 8),
      total_amount: Number(o.total_amount ?? 0),
      customer_name: o.customer?.name ?? "—",
    }));

  const deposits = (depositsRes.data ?? []).map((r: any) => ({
    id: r.id,
    amount: Number(r.amount ?? 0),
    deposit_reference: r.deposit_reference,
    deposited_at: r.deposited_at,
    collected_by: r.collected_by,
    order_number: r.order?.order_number ?? "—",
  }));

  const cards = [
    { label: t("cash.outstanding"), value: formatCurrency(summary.outstanding), accent: true },
    { label: t("cash.collectedMonth"), value: formatCurrency(summary.collected_month), accent: false },
    { label: t("cash.depositedMonth"), value: formatCurrency(summary.deposited_month), accent: false },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={t("cash.title")} subtitle={t("cash.subtitle")} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-card rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className={`mt-1 text-2xl font-bold ${c.accent ? "text-gradient" : ""}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <CashManager uncollected={uncollected} outstanding={outstanding} deposits={deposits} />
    </div>
  );
}
