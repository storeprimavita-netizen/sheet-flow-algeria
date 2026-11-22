import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { deleteLeakedWorkspaces, deleteWorkspaces } from "@/lib/test-cleanup";
import { DB_CONTAINER } from "@/lib/test-db";

const url = process.env.LOCAL_SUPABASE_URL;
// Published local Supabase demo credentials.
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const day = "2026-06-01";
const password = crypto.randomUUID();
const client = (key: string) => createClient<Database>(url!, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
type Client = ReturnType<typeof client>;
type AccountKind = "zr" | "dzd" | "usdt";
type Preview = {
  account_id: string;
  balance: number | null;
  proposed_kind: AccountKind;
  previous_mapping_id: string | null;
  sources: { source_key: string; target_amount: number | null; amount: number }[];
};

function psql(sql: string) {
  return execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

describe.skipIf(!url)("MONEY-1 accounts and ledger (live)", () => {
  let service: Client;
  let admin: Client;
  let otherAdmin: Client;
  let agent: Client;
  let actor: string;
  let workspace: string;
  let otherWorkspace: string;
  const workspaces: string[] = [];
  const users: string[] = [];

  async function makeWorkspace() {
    const { data, error } = await service.from("workspaces")
      .insert({ name: `money-ledger-test-${crypto.randomUUID()}` }).select("id").single();
    expect(error).toBeNull();
    workspaces.push(data!.id);
    return data!.id;
  }

  async function member(workspaceId: string, role: "admin" | "confirmation_agent") {
    const email = `ledger-${crypto.randomUUID()}@test.mnw`;
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const id = created.data.user!.id;
    users.push(id);
    const { error } = await service.from("profiles").update({ workspace_id: workspaceId, role, is_active: true }).eq("user_id", id);
    expect(error).toBeNull();
    const session = client(anonKey);
    expect((await session.auth.signInWithPassword({ email, password })).error).toBeNull();
    return { session, id };
  }

  async function account(session: Client, kind: AccountKind) {
    const { data, error } = await session.from("accounts").select("id").eq("kind", kind).single();
    expect(error).toBeNull();
    return data!.id;
  }

  async function balance(session: Client, id: string) {
    const { data, error } = await session.from("account_balances").select("balance").eq("account_id", id).single();
    expect(error).toBeNull();
    return data!.balance!;
  }

  async function preview(session: Client) {
    const { data, error } = await session.rpc("preview_legacy_accounts");
    expect(error).toBeNull();
    return data as unknown as Preview[];
  }

  beforeAll(async () => {
    service = client(serviceKey);
    await deleteLeakedWorkspaces(service, "money-ledger-test-");
    workspace = await makeWorkspace();
    otherWorkspace = await makeWorkspace();
    const owner = await member(workspace, "admin");
    admin = owner.session;
    actor = owner.id;
    otherAdmin = (await member(otherWorkspace, "admin")).session;
    agent = (await member(workspace, "confirmation_agent")).session;
  }, 30_000);

  afterAll(async () => {
    if (!service) return;
    if (workspaces.length) expect((await deleteWorkspaces(service, workspaces)).error).toBeNull();
    for (const id of users) expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
  });

  test("seeds exactly three system accounts and denies structural writes", async () => {
    const { data, error } = await admin.from("accounts").select("kind,currency,workspace_id").order("kind");
    expect(error).toBeNull();
    expect(data).toEqual([
      { kind: "dzd", currency: "DZD", workspace_id: workspace },
      { kind: "usdt", currency: "USDT", workspace_id: workspace },
      { kind: "zr", currency: "DZD", workspace_id: workspace },
    ]);
    const id = await account(admin, "dzd");
    expect((await admin.from("accounts").insert({ workspace_id: workspace, name: "Fourth" })).error?.code).toBe("42501");
    expect((await admin.from("accounts").delete().eq("id", id)).error?.code).toBe("42501");
    expect((await admin.from("accounts").update({ opening_balance: 1 }).eq("id", id)).error?.code).toBe("42501");
    expect((await admin.from("accounts").update({ currency: "USD" }).eq("id", id)).error?.code).toBe("42501");
    expect((await admin.from("account_topups").insert({ workspace_id: workspace, account_id: id, amount: 10 })).error?.code).toBe("42501");
    expect((await admin.from("accounts").update({ low_balance_threshold: 25 }).eq("id", id)).error).toBeNull();

    const rate = await admin.from("exchange_rates").insert({ workspace_id: workspace, currency: "USDT", rate_dzd: 240 })
      .select("currency,rate_dzd").single();
    expect(rate.error).toBeNull();
    expect(rate.data).toEqual({ currency: "USDT", rate_dzd: 240 });
    expect((await admin.rpc("current_fx_rate", { p_ws: workspace, p_currency: "USDT" })).data).toBe(240);
  });

  test("agents, anon and other workspaces cannot read the ledger or invoke its RPCs for these accounts", async () => {
    const id = await account(admin, "dzd");
    const movement = { p_account_id: id, p_amount: 10, p_direction: "in", p_occurred_on: day };
    expect((await admin.rpc("append_account_entry", movement)).error).toBeNull();
    expect((await agent.from("account_entries").select("id")).data).toEqual([]);
    expect((await agent.from("account_entry_requests").select("id")).data).toEqual([]);
    expect((await agent.from("account_legacy_mappings").select("id")).data).toEqual([]);
    expect((await agent.from("option_sets").select("id").eq("key", "money_category")).data).toEqual([]);
    const categorySet = await admin.from("option_sets").select("id").eq("key", "money_category").single();
    expect(categorySet.error).toBeNull();
    expect((await agent.from("options").insert({
      workspace_id: workspace, set_id: categorySet.data!.id, label: "Unauthorized category",
    })).error?.code).toBe("42501");
    expect((await client(anonKey).from("account_entries").select("id")).error).not.toBeNull();
    expect((await otherAdmin.from("account_entries").select("id").eq("account_id", id)).data).toEqual([]);
    expect((await agent.rpc("append_account_entry", movement)).error?.code).toBe("42501");
    expect((await agent.rpc("preview_legacy_accounts")).error?.code).toBe("42501");
    expect((await client(anonKey).rpc("append_account_entry", movement)).error).not.toBeNull();
    expect((await otherAdmin.rpc("append_account_entry", movement)).error).not.toBeNull();
  });

  test("top-up adds a dated attributed audited entry exactly once and reversal appends", async () => {
    const id = await account(admin, "dzd");
    const start = await balance(admin, id);
    const args = { p_account_id: id, p_occurred_on: day, p_direction: "in", p_amount: 12.25,
      p_request_key: crypto.randomUUID(), p_note: "  cash top-up  " };
    const result = await admin.rpc("append_account_entry", args);
    expect(result.error).toBeNull();
    expect((await admin.rpc("append_account_entry", { ...args, p_note: "cash top-up" })).data).toBe(result.data);
    expect((await admin.rpc("append_account_entry", { ...args, p_amount: 20 })).error?.code).toBe("22023");
    const { data } = await admin.from("account_entries")
      .select("created_by,occurred_on,amount,note").eq("id", result.data!).single();
    expect(data).toEqual({ created_by: actor, occurred_on: day, amount: 12.25, note: "cash top-up" });
    expect((await admin.from("audit_log").select("actor").eq("table_name", "account_entries").eq("row_id", result.data!).single()).data?.actor).toBe(actor);
    expect(await balance(admin, id)).toBe(start + 12.25);
    expect((await admin.from("account_entries").update({ amount: 5 }).eq("id", result.data!)).error?.code).toBe("42501");
    expect((await admin.from("account_entries").delete().eq("id", result.data!)).error?.code).toBe("42501");

    const reversal = { p_entry_id: result.data!, p_occurred_on: day, p_request_key: crypto.randomUUID() };
    const reversed = await admin.rpc("reverse_account_entry", reversal);
    expect(reversed.error).toBeNull();
    expect((await admin.rpc("reverse_account_entry", reversal)).data).toBe(reversed.data);
    expect((await admin.rpc("reverse_account_entry", { ...reversal, p_request_key: crypto.randomUUID() })).error).not.toBeNull();
    expect(await balance(admin, id)).toBe(start);
  });

  test("concurrent payout creates one pair, isolates request keys and reverses both legs", async () => {
    const zr = await account(admin, "zr");
    const dzd = await account(admin, "dzd");
    const startZR = await balance(admin, zr);
    const startDZD = await balance(admin, dzd);
    const args = { p_from_account_id: zr, p_to_account_id: dzd, p_occurred_on: day,
      p_amount_out: 250, p_amount_in: 250, p_request_key: crypto.randomUUID() };
    const results = await Promise.all(Array.from({ length: 4 }, () => admin.rpc("transfer_account_funds", args)));
    const id = results[0].data;
    expect(id).toBeTruthy();
    expect(results.map(({ data, error }) => ({ data, error }))).toEqual(Array(4).fill({ data: id, error: null }));
    const other = await otherAdmin.rpc("transfer_account_funds", { ...args,
      p_from_account_id: await account(otherAdmin, "zr"), p_to_account_id: await account(otherAdmin, "dzd") });
    expect(other.error).toBeNull();
    expect(other.data).not.toBe(id);

    const entries = (await admin.from("account_entries").select("id,direction")
      .eq("transfer_id", id!).order("direction")).data!;
    expect(entries.map((entry) => entry.direction)).toEqual(["in", "out"]);
    expect(await balance(admin, zr)).toBe(startZR - 250);
    expect(await balance(admin, dzd)).toBe(startDZD + 250);
    const reversed = await admin.rpc("reverse_account_entry", {
      p_entry_id: entries[1].id, p_occurred_on: day, p_request_key: crypto.randomUUID(),
    });
    expect(reversed.error).toBeNull();
    expect((await admin.from("account_entries").select("reverses_entry_id")
      .eq("transfer_id", reversed.data!)).data?.map((entry) => entry.reverses_entry_id).sort())
      .toEqual(entries.map((entry) => entry.id).sort());
    expect(await balance(admin, zr)).toBe(startZR);
    expect(await balance(admin, dzd)).toBe(startDZD);
  });

  test("DZD/USDT requires a consistent rate, and bad amounts or accounts leave balances unchanged", async () => {
    const dzd = await account(admin, "dzd");
    const usdt = await account(admin, "usdt");
    const startDZD = await balance(admin, dzd);
    const startUSDT = await balance(admin, usdt);
    const args = { p_from_account_id: dzd, p_to_account_id: usdt, p_occurred_on: day,
      p_amount_out: 480, p_amount_in: 2, p_rate_dzd: 240, p_request_key: crypto.randomUUID() };
    expect((await admin.rpc("transfer_account_funds", { ...args, p_rate_dzd: 241 })).error).not.toBeNull();
    expect((await admin.rpc("transfer_account_funds", { ...args, p_amount_in: -2 })).error).not.toBeNull();
    expect((await admin.rpc("transfer_account_funds", { ...args, p_to_account_id: await account(otherAdmin, "usdt") })).error).not.toBeNull();
    expect(await balance(admin, dzd)).toBe(startDZD);
    expect(await balance(admin, usdt)).toBe(startUSDT);
    const result = await admin.rpc("transfer_account_funds", args);
    expect(result.error).toBeNull();
    const { data } = await admin.from("account_entries").select("amount,fx_rate").eq("transfer_id", result.data!).order("amount");
    expect(data).toEqual([{ amount: 2, fx_rate: 240 }, { amount: 480, fx_rate: 240 }]);
    expect(await balance(admin, dzd)).toBe(startDZD - 480);
    expect(await balance(admin, usdt)).toBe(startUSDT + 2);
  });

  test("compatible debits count once and linked sources cannot be duplicated or changed", async () => {
    const dzd = await account(admin, "dzd");
    const usdt = await account(admin, "usdt");
    const start = await balance(admin, dzd);
    const expense = { workspace_id: workspace, amount: 8, currency: "USD" as const, fx_rate: 200,
      spent_on: day, category: "other" as const };
    expect((await admin.from("expenses").insert({ ...expense, account_id: usdt })).error?.code).toBe("23514");
    const created = await admin.from("expenses").insert({ ...expense, account_id: dzd }).select("id").single();
    expect(created.error).toBeNull();
    expect(await balance(admin, dzd)).toBe(start - 1600);

    const args = { p_account_id: dzd, p_amount: 1600, p_direction: "out", p_occurred_on: day,
      p_expense_id: created.data!.id };
    expect((await admin.rpc("append_account_entry", { ...args, p_amount: 8 })).error).not.toBeNull();
    expect((await admin.rpc("append_account_entry", args)).error).toBeNull();
    expect((await admin.rpc("append_account_entry", args)).error?.code).toBe("23505");
    expect(await balance(admin, dzd)).toBe(start - 1600);
    expect((await admin.from("expenses").update({ amount: 9 }).eq("id", created.data!.id)).error?.code).toBe("23514");
    expect((await admin.from("expenses").delete().eq("id", created.data!.id)).error?.code).toBe("23503");
    expect((await admin.from("expenses").update({ note: "Receipt kept" }).eq("id", created.data!.id)).error).toBeNull();
  });

  test("legacy preview, atomic posting and remapping preserve sources, balances and P&L", async () => {
    const exactWorkspace = await makeWorkspace();
    const reviewWorkspace = await makeWorkspace();
    const exact = (await member(exactWorkspace, "admin")).session;
    const review = (await member(reviewWorkspace, "admin")).session;
    const cash = await service.from("accounts").insert({
      workspace_id: exactWorkspace, name: "DZD Cash", currency: "DZD", opening_balance: 100,
    }).select("id").single();
    const courier = await service.from("accounts").insert({
      workspace_id: reviewWorkspace, name: "Courier", currency: "DZD", opening_balance: 20,
    }).select("id").single();
    const cryptoCash = await service.from("accounts").insert({
      workspace_id: reviewWorkspace, name: "Binance", currency: "USD", opening_balance: 50,
    }).select("id").single();
    for (const response of [cash, courier, cryptoCash]) expect(response.error).toBeNull();
    const cashId = cash.data!.id;
    const cryptoId = cryptoCash.data!.id;
    const topup = await service.from("account_topups").insert({
      workspace_id: exactWorkspace, account_id: cashId, amount: 25, occurred_on: day,
    }).select("id").single();
    expect(topup.error).toBeNull();

    const source = { spent_on: day, category: "other" as const };
    const expense = await exact.from("expenses")
      .insert({ ...source, workspace_id: exactWorkspace, account_id: cashId, amount: 10 }).select("id").single();
    expect(expense.error).toBeNull();
    const cryptoDebit = await review.from("expenses").insert({
      ...source, workspace_id: reviewWorkspace, account_id: cryptoId, amount: 10, currency: "USD", fx_rate: 200,
    }).select("id").single();
    expect(cryptoDebit.error).toBeNull();
    const product = await service.from("products").insert({ workspace_id: exactWorkspace, name: "Ad product" }).select("id").single();
    expect(product.error).toBeNull();
    const adRow = { workspace_id: exactWorkspace, product_id: product.data!.id,
      spent_on: day, amount: 15, currency: "DZD" as const };
    expect((await exact.from("ad_spend_daily").insert({
      ...adRow, account_id: await account(exact, "usdt"),
    })).error?.code).toBe("23514");
    const adSpend = await exact.from("ad_spend_daily").insert({ ...adRow, account_id: cashId }).select("id").single();
    expect(adSpend.error).toBeNull();

    const exactPreview = (await preview(exact)).find((row) => row.account_id === cashId)!;
    const reviewPreview = (await preview(review)).find((row) => row.account_id === cryptoId)!;
    expect(exactPreview.balance).toBe(100);
    expect(reviewPreview.balance).toBe(40);
    expect(reviewPreview.proposed_kind).toBe("usdt");
    expect(reviewPreview.sources.map((row) => row.target_amount)).toEqual([null, null]);

    // The standalone query only uses columns available before MONEY-1.
    const preflight = readFileSync("scripts/money-legacy-preflight.sql", "utf8");
    const query = preflight.slice(preflight.indexOf("with proposed"), preflight.lastIndexOf("rollback;")).trim().replace(/;$/, "");
    expect(psql(`select proposed_kind || ':' || status from (${query}) as preview
      where legacy_account_id = '${cryptoId}' and source_type = 'opening';`))
      .toBe("usdt:source or conversion needs review");

    const period = { p_from: day, p_to: day };
    const beforePnl = await exact.rpc("pnl_summary", period);
    expect(beforePnl.error).toBeNull();
    expect(psql(`select cardinality(private.post_legacy_workspace('${exactWorkspace}', '{}', true));`)).toBe("1");
    expect(psql(`select cardinality(private.post_legacy_workspace('${reviewWorkspace}', '{}', true));`)).toBe("0");
    const dzd = await account(exact, "dzd");
    expect(await balance(exact, dzd)).toBe(100);
    expect((await exact.from("expenses").select("account_id,amount").eq("id", expense.data!.id).single()).data)
      .toEqual({ account_id: dzd, amount: 10 });
    expect((await exact.from("ad_spend_daily").select("account_id,amount").eq("id", adSpend.data!.id).single()).data)
      .toEqual({ account_id: dzd, amount: 15 });
    expect((await exact.from("account_topups").select("account_id,amount").eq("id", topup.data!.id).single()).data)
      .toEqual({ account_id: cashId, amount: 25 });
    expect((await exact.rpc("pnl_summary", period)).data).toEqual(beforePnl.data);
    expect((await review.rpc("post_legacy_accounts")).error).not.toBeNull();
    expect(await balance(review, courier.data!.id)).toBe(20);
    expect(await balance(review, cryptoId)).toBe(40);

    const converted = await review.rpc("post_legacy_accounts", { p_mappings: {
      [cryptoId]: { kind: "usdt", conversions: {
        [`opening:${cryptoId}`]: { amount: 49.5, evidence: "Archived exchange statement" },
        [`expense:${cryptoDebit.data!.id}`]: { amount: 9.8, evidence: "Archived debit receipt" },
      } },
    } });
    expect(converted.error).toBeNull();
    expect(converted.data).toHaveLength(2);
    const usdt = await account(review, "usdt");
    expect(await balance(review, usdt)).toBe(39.7);
    expect((await review.rpc("post_legacy_accounts")).data).toEqual([]);
    expect((await review.from("expenses").select("amount,currency,account_id").eq("id", cryptoDebit.data!.id).single()).data)
      .toEqual({ amount: 10, currency: "USD", account_id: usdt });

    const previous = (await preview(review)).find((row) => row.account_id === cryptoId)!.previous_mapping_id!;
    const remapped = await review.rpc("remap_legacy_account", {
      p_legacy_account_id: cryptoId, p_expected_mapping_id: previous, p_kind: "dzd",
      p_conversions: { [`opening:${cryptoId}`]: { amount: 10000, evidence: "Bank statement" } },
    });
    expect(remapped.error).toBeNull();
    expect(await balance(review, usdt)).toBe(0);
    expect(await balance(review, await account(review, "dzd"))).toBe(8000);
    const evidence = await review.from("account_legacy_mappings").select("previous_mapping_id,evidence")
      .eq("id", remapped.data!).single();
    expect(evidence.data?.previous_mapping_id).toBe(previous);
    expect((evidence.data?.evidence as unknown as Preview["sources"]).find((row) => row.source_key === `opening:${cryptoId}`)?.amount)
      .toBe(50);
  });
});
