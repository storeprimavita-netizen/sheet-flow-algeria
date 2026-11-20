import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/rbac";
import { getOptionSet } from "@/lib/option-sets";
import { PageHeader } from "@/components/page-header";
import { ExpenseTable } from "@/components/finance/expense-table";
import { FinanceTabs } from "../finance-tabs";
import { FinanceFilterBar } from "../finance-filter-bar";

export default async function FinanceExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { from, to, product, category } = sp;

  const t = await getTranslations();
  const profile = await requireProfile();
  const supabase = await createClient();

  let query = supabase
    .from("expenses")
    .select("*")
    .eq("workspace_id", profile.workspaceId)
    .order("spent_on", { ascending: false });
  if (from) query = query.gte("spent_on", from);
  if (to) query = query.lte("spent_on", to);
  if (product) query = query.eq("product_id", product);
  if (category) query = query.eq("category", category as never);

  const [{ data: expenses }, { data: products }, { data: suppliers }, usdRate, eurRate, subcategories, { data: accounts }] = await Promise.all([
    query,
    supabase.from("products").select("id, name, images, status").order("name"),
    supabase.from("contacts").select("id, name").order("name"),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "USD" }),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
    getOptionSet(profile.workspaceId, "expense_subcategory"),
    supabase.from("accounts").select("id, name, is_active").eq("workspace_id", profile.workspaceId).eq("is_active", true).order("name"),
  ]);
  const rates = { USD: usdRate.data ?? 1, EUR: eurRate.data ?? 1 };
  const productOpts = (products ?? []).map((p) => ({ id: p.id, name: p.name, image: p.images?.[0] ?? null, status: p.status }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("expenses.title")} subtitle={t("expenses.subtitle")}
        related={[{ href: "/app/money/ad-spend", label: t("nav.adSpend") }, { href: "/app/money/accounts", label: t("nav.accounts") }]}
      />
      <FinanceTabs active="expenses" />
      <FinanceFilterBar products={productOpts.map((p) => ({ value: p.id, label: p.name }))} showCategory />
      <ExpenseTable expenses={expenses ?? []} products={productOpts} suppliers={suppliers ?? []} subcategories={subcategories} accounts={accounts ?? []} rates={rates} />
    </div>
  );
}
