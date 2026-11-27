import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/rbac";
import { getOptionSet } from "@/lib/option-sets";
import { fetchAll, pageHref, parsePage, readPage } from "@/lib/list-pagination";
import { PageHeader } from "@/components/page-header";
import { ExpenseTable } from "@/components/finance/expense-table";
import { FinanceTabs } from "../finance-tabs";
import { FinanceFilterBar } from "../finance-filter-bar";
import { parseFinanceFilters } from "../finance-filters";

export default async function FinanceExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { from, to, product, category } = parseFinanceFilters(sp);
  const page = parsePage(sp.page);

  const t = await getTranslations();
  const profile = await requireProfile();
  const supabase = await createClient();

  // The page and the category sums must always share one set of filters.
  const filtered = <Q extends { gte(c: string, v: string): Q; lte(c: string, v: string): Q; eq(c: string, v: string): Q }>(query: Q): Q => {
    let q = query.eq("workspace_id", profile.workspaceId);
    if (from) q = q.gte("spent_on", from);
    if (to) q = q.lte("spent_on", to);
    if (product) q = q.eq("product_id", product);
    if (category) q = q.eq("category", category);
    return q;
  };

  const [list, amounts, productsRead, suppliersRead, usdRate, eurRate, subcategories, accountsRead] = await Promise.all([
    readPage(page, (start, end) =>
      filtered(supabase.from("expenses").select("*", { count: "exact" }))
        .order("spent_on", { ascending: false })
        .order("id")
        .range(start, end),
    ),
    fetchAll((start, end) =>
      filtered(supabase.from("expenses").select("category, amount_dzd")).order("id").range(start, end),
    ),
    supabase.from("products").select("id, name, images, status").order("name"),
    supabase.from("contacts").select("id, name").order("name"),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "USD" }),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
    getOptionSet(profile.workspaceId, "expense_subcategory"),
    supabase.from("accounts").select("id, name, is_active").eq("workspace_id", profile.workspaceId).eq("is_active", true).order("name"),
  ]);
  if (list.goTo) redirect(pageHref("/app/money/expenses", sp, "page", list.goTo));
  const failed = [productsRead, suppliersRead, usdRate, eurRate, accountsRead].find((r) => r.error)?.error;
  if (failed) throw new Error(failed.message);
  const [products, suppliers, accounts] = [productsRead.data, suppliersRead.data, accountsRead.data];

  const categoryTotals: Record<string, number> = {};
  for (const e of amounts) categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + (e.amount_dzd ?? 0);
  const rates = { USD: usdRate.data ?? 1, EUR: eurRate.data ?? 1 };
  const productOpts = (products ?? []).map((p) => ({ id: p.id, name: p.name, image: p.images?.[0] ?? null, status: p.status }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("expenses.title")} subtitle={t("expenses.subtitle")}
        related={[{ href: "/app/money/ad-spend", label: t("nav.adSpend") }, { href: "/app/money/accounts", label: t("nav.accounts") }]}
      />
      <FinanceTabs active="expenses" />
      <FinanceFilterBar products={productOpts.map((p) => ({ value: p.id, label: p.name }))} showCategory />
      <ExpenseTable expenses={list.rows} total={list.total} categoryTotals={categoryTotals} products={productOpts} suppliers={suppliers ?? []} subcategories={subcategories} accounts={accounts ?? []} rates={rates} />
    </div>
  );
}
