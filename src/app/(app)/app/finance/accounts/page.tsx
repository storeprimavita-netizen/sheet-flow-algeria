import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { FinanceTabs } from "../finance-tabs";
import { AccountTable } from "@/components/finance/account-table";

type BalanceRow = {
  account_id: string;
  name: string;
  currency: string;
  opening_balance: number;
  low_balance_threshold: number;
  is_active: boolean;
  balance: number;
};

export default async function FinanceAccountsPage() {
  const t = await getTranslations();
  const profile = (await getProfile())!;
  const supabase = await createClient();

  const [{ data: accounts }, { data: balances }] = await Promise.all([
    supabase.from("accounts").select("*").eq("workspace_id", profile.workspaceId).order("created_at"),
    supabase.from("account_balances").select("*").eq("workspace_id", profile.workspaceId),
  ]);

  const balanceMap = new Map<string, number>((balances as BalanceRow[] ?? []).map((b) => [b.account_id, b.balance]));

  const rows = (accounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    opening_balance: a.opening_balance,
    low_balance_threshold: a.low_balance_threshold,
    is_active: a.is_active,
    balance: balanceMap.get(a.id) ?? a.opening_balance,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("accounts.title")} subtitle={t("accounts.subtitle")}
        related={[{ href: "/app/finance/expenses", label: t("nav.expenses") }, { href: "/app/finance/ad-spend", label: t("nav.adSpend") }]}
      />
      <FinanceTabs active="accounts" />
      <AccountTable accounts={rows} />
    </div>
  );
}
