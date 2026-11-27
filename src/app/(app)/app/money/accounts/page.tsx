import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/rbac";
import { getOptionSet } from "@/lib/option-sets";
import { formatAccountAmount, formatDate, formatInt } from "@/lib/format";
import { ACCOUNT_KINDS, canReverse, dzdTotal, legacyPreviewSchema, type AccountKind } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { ButtonLink } from "@/components/button-link";
import { AccountCards, type AccountCard } from "@/components/finance/account-cards";
import { LedgerQuickAdd } from "@/components/finance/ledger-quick-add";
import { LedgerTable, type LedgerFlag, type LedgerRow } from "@/components/finance/ledger-table";
import { PayoutDialog, TransferDialog } from "@/components/finance/transfer-dialog";
import { LegacyMapping } from "@/components/finance/legacy-mapping";
import { FinanceTabs } from "../finance-tabs";

const PAGE_SIZE = 50;

const searchSchema = z.object({
  account: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
});

/** A failed read must reach error.tsx, never render as an empty ledger. */
function must<T extends { error: { message: string } | null }>(response: T): T {
  if (response.error) throw new Error(response.error.message);
  return response;
}

const href = (account: string | undefined, page = 1) => {
  const params = new URLSearchParams();
  if (account) params.set("account", account);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/app/money/accounts${qs ? `?${qs}` : ""}#ledger`;
};

export default async function FinanceAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { account, page } = searchSchema.parse(await searchParams);
  const t = await getTranslations("accounts");
  const tNav = await getTranslations("nav");
  const { workspaceId } = await requireProfile();
  const supabase = await createClient();

  let entryQuery = supabase.from("account_entries").select("*", { count: "exact" }).eq("workspace_id", workspaceId);
  let expenseQuery = supabase.from("expenses")
    .select("id, account_id, amount, amount_dzd, currency, spent_on, account_entries(id)", { count: "exact" })
    .eq("workspace_id", workspaceId).not("account_id", "is", null).is("account_entries", null);
  let adQuery = supabase.from("ad_spend_daily")
    .select("id, account_id, amount, amount_dzd, currency, spent_on, account_entries(id)", { count: "exact" })
    .eq("workspace_id", workspaceId).not("account_id", "is", null).is("account_entries", null);
  if (account) {
    entryQuery = entryQuery.eq("account_id", account);
    expenseQuery = expenseQuery.eq("account_id", account);
    adQuery = adQuery.eq("account_id", account);
  }

  const [accountsRes, balancesRes, entriesRes, expensesRes, adRes, rateRes, previewRes, categories] = await Promise.all([
    supabase.from("accounts").select("*").eq("workspace_id", workspaceId).order("created_at"),
    supabase.from("account_balances").select("account_id, balance").eq("workspace_id", workspaceId),
    entryQuery.order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    expenseQuery.order("spent_on", { ascending: false }).limit(PAGE_SIZE),
    adQuery.order("spent_on", { ascending: false }).limit(PAGE_SIZE),
    // Same order as current_fx_rate(), plus the date it applies from.
    supabase.from("exchange_rates").select("rate_dzd, valid_from").eq("workspace_id", workspaceId).eq("currency", "USDT")
      .order("valid_from", { ascending: false }).order("created_at", { ascending: false }).limit(1),
    supabase.rpc("preview_legacy_accounts"),
    getOptionSet(workspaceId, "money_category"),
  ]);
  // A page past the end is an empty page, not a failure.
  if (entriesRes.error && entriesRes.error.code !== "PGRST103") throw new Error(entriesRes.error.message);

  const accounts = must(accountsRes).data ?? [];
  const balances = new Map((must(balancesRes).data ?? []).map((b) => [b.account_id, b.balance ?? 0]));
  const entries = entriesRes.data ?? [];
  const legacy = legacyPreviewSchema.parse(must(previewRes).data);
  const latest = must(rateRes).data?.[0];
  const rate = latest ? { value: latest.rate_dzd, since: latest.valid_from } : null;

  const system = ACCOUNT_KINDS.flatMap((kind) => accounts.filter((a) => a.kind === kind));
  const pending = accounts.filter((a) => a.kind === null && !a.legacy_posted);
  const shown = [...system, ...pending];

  const ids = entries.map((e) => e.id);
  const [reversedRes, ...lastRes] = await Promise.all([
    ids.length
      ? supabase.from("account_entries").select("reverses_entry_id").eq("workspace_id", workspaceId).in("reverses_entry_id", ids)
      : Promise.resolve({ data: [] as { reverses_entry_id: string | null }[], error: null }),
    ...shown.map((a) =>
      supabase.from("account_entries").select("occurred_on").eq("workspace_id", workspaceId).eq("account_id", a.id)
        .order("occurred_on", { ascending: false }).limit(1)),
  ]);
  const reversed = new Set((must(reversedRes).data ?? []).flatMap((r) => r.reverses_entry_id ?? []));

  const cards: AccountCard[] = shown.map((a, i) => ({
    id: a.id,
    kind: a.kind as AccountKind | null,
    name: a.name,
    currency: a.currency,
    balance: balances.get(a.id) ?? a.opening_balance,
    low_balance_threshold: a.low_balance_threshold,
    is_active: a.is_active,
    lastMovement: must(lastRes[i]).data?.[0]?.occurred_on ?? null,
  }));
  const byKind = new Map(cards.filter((c) => c.kind).map((c) => [c.kind!, c]));
  const zr = byKind.get("zr")?.balance ?? 0;
  const total = dzdTotal({ zr, dzd: byKind.get("dzd")?.balance ?? 0, usdt: byKind.get("usdt")?.balance ?? 0 }, rate?.value ?? null);

  // Posted legacy accounts are only readable through the preview.
  const info = new Map<string, { name: string; currency: string }>([
    ...legacy.map((l) => [l.account_id, l] as const),
    ...accounts.map((a) => [a.id, a] as const),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, { label: c.label, token: c.color_token, emoji: c.emoji }]));
  const reversibleAccounts = new Set(shown.map((a) => a.id));

  const rows: LedgerRow[] = entries.map((e) => {
    const flags: LedgerFlag[] = [];
    if (e.transfer_id) flags.push("transfer");
    if (e.reverses_entry_id) flags.push("reversal");
    if (reversed.has(e.id)) flags.push("reversed");
    if (e.legacy_mapping_id) flags.push("legacy");
    if (e.expense_id) flags.push("expense");
    if (e.ad_spend_id) flags.push("adSpend");
    return {
      id: e.id,
      date: e.occurred_on,
      account: info.get(e.account_id)?.name ?? "—",
      currency: info.get(e.account_id)?.currency ?? "DZD",
      direction: e.direction === "in" ? "in" : "out",
      amount: e.amount,
      category: e.category_id ? (categoryById.get(e.category_id) ?? null) : null,
      note: e.note,
      flags,
      reversible: reversibleAccounts.has(e.account_id) && canReverse(e, reversed),
    };
  });

  // Expenses and ad spend with no ledger row still lower the balance (view 00084).
  const systemIds = new Set(system.map((a) => a.id));
  const charges = [
    ...(must(expensesRes).data ?? []).map((c) => ({ ...c, source: "expense" as const, path: "/app/money/expenses" })),
    ...(must(adRes).data ?? []).map((c) => ({ ...c, source: "adSpend" as const, path: "/app/money/ad-spend" })),
  ]
    .sort((a, b) => b.spent_on.localeCompare(a.spent_on))
    .slice(0, PAGE_SIZE)
    .map((c) => {
      const target = info.get(c.account_id!);
      // An old account (no kind) is debited the raw amount in its own currency.
      const system = systemIds.has(c.account_id!);
      const converted = system && target?.currency === "DZD" && c.currency !== "DZD";
      const currency = converted ? "DZD" : system ? c.currency : (target?.currency ?? c.currency);
      return { ...c, name: target?.name ?? "—", debit: formatAccountAmount(converted ? c.amount_dzd : c.amount, currency) };
    });
  const chargeCount = (expensesRes.count ?? 0) + (adRes.count ?? 0);

  const total_entries = entriesRes.count ?? 0;
  const pages = Math.max(1, Math.ceil(total_entries / PAGE_SIZE));
  const filters = [...info].map(([id, a]) => ({ id, name: a.name }));
  const names = Object.fromEntries(ACCOUNT_KINDS.map((k) => [k, byKind.get(k)?.name ?? k.toUpperCase()])) as Record<AccountKind, string>;
  const pill = (active: boolean) =>
    cn("shrink-0 rounded-full border border-border px-3 py-1 text-xs", active ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:text-foreground");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")}
        related={[{ href: "/app/money/expenses", label: tNav("expenses") }, { href: "/app/money/ad-spend", label: tNav("adSpend") }]}
      />
      <FinanceTabs active="accounts" />

      <AccountCards accounts={cards} total={total} rate={rate} />

      <div className="flex flex-wrap items-center gap-3">
        <TransferDialog rate={rate?.value ?? null} />
        <PayoutDialog balance={zr} />
      </div>

      <LedgerQuickAdd
        initialAccountId={account}
        accounts={cards.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name, currency: c.currency }))}
        categories={categories.map((c) => ({ value: c.id, label: c.label, token: c.color_token, emoji: c.emoji, archived: c.archived_at !== null }))}
      />

      <section id="ledger" tabIndex={-1} className="card-surface scroll-mt-20 space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("ledger.title")}</h2>
        <nav aria-label={t("ledger.filter")} className="flex gap-2 overflow-x-auto">
          <Link href={href(undefined)} aria-current={account ? undefined : "page"} className={pill(!account)}>{t("ledger.all")}</Link>
          {filters.map((f) => (
            <Link key={f.id} href={href(f.id)} aria-current={account === f.id ? "page" : undefined} className={pill(account === f.id)}>
              <bdi>{f.name}</bdi>
            </Link>
          ))}
        </nav>
        {rows.length ? (
          <LedgerTable rows={rows} />
        ) : (
          <Empty>
            <p>{t("ledger.empty")}</p>
            <ButtonLink href={page > 1 ? href(account) : "#quick-add"} variant="outline" size="sm" className="mt-3">
              {page > 1 ? t("ledger.firstPage") : t("ledger.emptyAction")}
            </ButtonLink>
          </Empty>
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            {page > 1 ? <Link href={href(account, page - 1)} className="underline underline-offset-2">{t("ledger.prev")}</Link> : <span />}
            <span className="num text-muted-foreground">{t("ledger.page", { page: formatInt(page), pages: formatInt(pages) })}</span>
            {page < pages ? <Link href={href(account, page + 1)} className="underline underline-offset-2">{t("ledger.next")}</Link> : <span />}
          </div>
        ) : null}
      </section>

      {charges.length ? (
        <section className="card-surface space-y-3 rounded-xl p-5">
          <div>
            <h2 className="text-sm font-semibold">{t("charges.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("charges.hint")}</p>
          </div>
          <ul className="divide-y divide-border text-sm">
            {charges.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <span className="num text-muted-foreground">{formatDate(c.spent_on)}</span>{" "}
                  <Link href={c.path} className="underline underline-offset-2">{t(`charges.${c.source}`)}</Link>{" "}
                  · <bdi>{c.name}</bdi>
                </span>
                <span className="num">{c.debit}</span>
              </li>
            ))}
          </ul>
          {chargeCount > charges.length ? (
            <p className="text-xs text-muted-foreground">{t("charges.more", { shown: charges.length, count: chargeCount })}</p>
          ) : null}
        </section>
      ) : null}

      {legacy.length ? <LegacyMapping accounts={legacy} names={names} /> : null}
    </div>
  );
}
