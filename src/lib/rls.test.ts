import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

/**
 * Live RLS verification against a local Supabase stack seeded by
 * `scripts/seed-dev.ts` (run that first). Opt-in via LOCAL_SUPABASE_URL so
 * `npm test` stays green with no local stack running (fresh clone, CI):
 *
 *   LOCAL_SUPABASE_URL=http://localhost:54321 npm test
 *
 * Tests real signed-in clients against the actual policies — this is the
 * "zero financial data reachable by agents" quality bar (docs/SPEC.md §10),
 * exercised at the wall (Postgres), not the UI.
 */
const LOCAL_URL = process.env.LOCAL_SUPABASE_URL;
// Supabase's published self-hosting demo keys (docker-compose.yml default) —
// not a secret of this project, just the standard local-stack credential.
// Override via env if a stack was configured with different ones.
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SEED_PASSWORD = "SeedDev!2026";

// Every financial table with an ALL-type `_adm`/`_all` policy (admin write,
// no agent access at all). audit_log/webhook_events are select-only for
// EVERYONE via the session client (only the service role writes them), so
// their insert-rejection isn't agent-specific — checked separately below.
const FINANCIAL_TABLES = [
  "product_costs", "expenses", "ad_spend_daily", "fixed_fees", "exchange_rates",
  "cash_collections", "product_scenarios", "settings", "contacts",
] as const;

function sign(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(url: string, email: string): Promise<SupabaseClient> {
  const client = sign(url, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return client;
}

describe.skipIf(!LOCAL_URL)("RLS: agents are financially blind", () => {
  let admin: SupabaseClient; // service role — setup/teardown only
  let adminUser: SupabaseClient; // signed in as seed admin
  let confAgent: SupabaseClient; // signed in as seed confirmation_agent
  let delivAgent: SupabaseClient; // signed in as seed delivery_agent
  let workspaceId: string;
  let productId: string;
  let ws2Id: string;

  beforeAll(async () => {
    admin = sign(LOCAL_URL!, SERVICE_KEY);
    adminUser = await signIn(LOCAL_URL!, "admin@seed.mnw");
    confAgent = await signIn(LOCAL_URL!, "confirmation@seed.mnw");
    delivAgent = await signIn(LOCAL_URL!, "delivery@seed.mnw");

    const { data: userRes } = await adminUser.auth.getUser();
    const { data: profile } = await admin
      .from("profiles")
      .select("workspace_id")
      .eq("user_id", userRes.user!.id)
      .single();
    workspaceId = profile!.workspace_id!;

    const { data: product } = await admin
      .from("products")
      .select("id")
      .eq("workspace_id", workspaceId)
      .limit(1)
      .single();
    productId = product!.id;

    // second workspace + admin, for cross-workspace isolation
    const { data: existingWs2 } = await admin.from("workspaces").select("id").eq("name", "RLS Test WS2").maybeSingle();
    if (existingWs2) {
      ws2Id = existingWs2.id;
    } else {
      const { data: ws2 } = await admin.from("workspaces").insert({ name: "RLS Test WS2" }).select("id").single();
      ws2Id = ws2!.id;
    }
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    let ws2UserId = list.users.find((u) => u.email === "ws2-admin@seed.mnw")?.id;
    if (!ws2UserId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: "ws2-admin@seed.mnw",
        password: SEED_PASSWORD,
        email_confirm: true,
      });
      if (error || !created.user) throw new Error(`create ws2 admin: ${error?.message}`);
      ws2UserId = created.user.id;
    }
    await admin
      .from("profiles")
      .upsert(
        { user_id: ws2UserId, workspace_id: ws2Id, role: "admin", is_active: true },
        { onConflict: "user_id" },
      );
    const { data: existingWs2Product } = await admin
      .from("products")
      .select("id")
      .eq("workspace_id", ws2Id)
      .eq("name", "WS2-only product")
      .maybeSingle();
    if (!existingWs2Product) {
      await admin.from("products").insert({ workspace_id: ws2Id, name: "WS2-only product" });
    }
  });

  afterAll(async () => {
    await adminUser.auth.signOut();
    await confAgent.auth.signOut();
    await delivAgent.auth.signOut();
  });

  test.each(FINANCIAL_TABLES)("agent select on %s returns 0 rows", async (table) => {
    const { data, error } = await confAgent.from(table).select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test.each(FINANCIAL_TABLES)("admin select on %s sees the seeded rows (RLS isn't hiding from everyone)", async (table) => {
    const { data, error } = await adminUser.from(table).select("*").eq("workspace_id", workspaceId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  const MINIMAL_INSERT: Record<(typeof FINANCIAL_TABLES)[number], () => Record<string, unknown>> = {
    product_costs: () => ({ product_id: productId, workspace_id: workspaceId, sourcing_cost: 100 }),
    expenses: () => ({ workspace_id: workspaceId, category: "other", amount: 100 }),
    ad_spend_daily: () => ({ workspace_id: workspaceId, product_id: productId, amount: 10 }),
    fixed_fees: () => ({ workspace_id: workspaceId, label: "rls-test", amount: 10 }),
    exchange_rates: () => ({ workspace_id: workspaceId, currency: "EUR", rate_dzd: 260 }),
    cash_collections: () => ({ workspace_id: workspaceId, amount_dzd: 100 }),
    product_scenarios: () => ({ workspace_id: workspaceId, product_id: productId, slug: "best", inputs: {} }),
    settings: () => ({ workspace_id: workspaceId, key: "rls_test_key", value: {} }),
    contacts: () => ({ workspace_id: workspaceId, type: "other", name: "rls-test" }),
  };

  test.each(FINANCIAL_TABLES)("agent insert on %s is rejected", async (table) => {
    const { error } = await confAgent.from(table).insert(MINIMAL_INSERT[table]());
    expect(error).not.toBeNull();
  });

  test("agent select on audit_log returns 0 rows", async () => {
    const { data, error } = await confAgent.from("audit_log").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("agent select on webhook_events returns 0 rows", async () => {
    const { data, error } = await confAgent.from("webhook_events").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("admin (session client, not service role) cannot insert into audit_log — no INSERT policy at all", async () => {
    const { error } = await adminUser
      .from("audit_log")
      .insert({ workspace_id: workspaceId, table_name: "x", action: "INSERT" });
    expect(error).not.toBeNull();
  });

  // 00021: the view ran as its owner and leaked every workspace's balances.
  test("anon cannot read account_balances; agents see 0 rows; admin sees own", async () => {
    const { data: anonRows } = await sign(LOCAL_URL!, ANON_KEY).from("account_balances").select("account_id");
    expect(anonRows ?? []).toHaveLength(0);
    const { data: agentRows } = await confAgent.from("account_balances").select("account_id");
    expect(agentRows ?? []).toHaveLength(0);
    const { error } = await adminUser.from("account_balances").select("account_id").eq("workspace_id", workspaceId);
    expect(error).toBeNull();
  });

  // 00022: one money model — every surface reads the same P&L lines.
  test("pnl: dashboard net === pnl_summary net === Σ per-product nets; agents get null", async () => {
    const [{ data: dash }, { data: pnl }, { data: perProduct }] = await Promise.all([
      adminUser.rpc("dashboard_stats", {}),
      adminUser.rpc("pnl_summary", {}),
      adminUser.rpc("pnl_by_product", {}),
    ]);
    const net = (pnl as { net_profit: number }).net_profit;
    expect((dash as { kpis: { net_profit_dzd: number } }).kpis.net_profit_dzd).toBeCloseTo(net, 2);
    const sum = ((perProduct ?? []) as { pnl: unknown }[]).reduce((s: number, r) => s + ((r.pnl as { net_profit: number } | null)?.net_profit ?? 0), 0);
    expect(sum).toBeCloseTo(net, 0);
    const { data: agentPnl } = await confAgent.rpc("pnl_summary", {});
    expect(agentPnl).toBeNull();
  });

  describe("orders: role-scoped visibility + cross-stage guard", () => {
    test("confirmation agent sees all workspace orders (14a: visibility is role-blind, writes are role-scoped)", async () => {
      const { count, error } = await confAgent
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      expect(error).toBeNull();
      const { count: allTotal } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      expect(count).toBe(allTotal);
      expect(count).toBeGreaterThan(0);
    });

    test("delivery agent sees all workspace orders", async () => {
      const { count, error } = await delivAgent
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      expect(error).toBeNull();
      const { count: allTotal } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      expect(count).toBe(allTotal);
      expect(count).toBeGreaterThan(0);
    });

    test("confirmation agent CAN legitimately confirm an order (transition_order_status RPC)", async () => {
      // Regression: a plain `.update({ confirmation_status: "confirmed" })` moves
      // the row out of confirmation_agent's own o_sel visibility bucket, and
      // Postgres rejects the whole UPDATE unless the post-update row still
      // satisfies a SELECT policy for the role — even though o_upd's WITH CHECK
      // passes. See supabase/migrations/00009_order_transitions.sql.
      const { data: target } = await admin
        .from("orders")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("confirmation_status", "wait_for_confirmation")
        .limit(1)
        .single();
      const { error } = await confAgent.rpc("transition_order_status", {
        p_order_id: target!.id,
        p_confirmation_status: "confirmed",
      });
      expect(error).toBeNull();
      const { data: after } = await admin.from("orders").select("confirmation_status").eq("id", target!.id).single();
      expect(after?.confirmation_status).toBe("confirmed");
      // revert via the service-role client so re-running this suite doesn't
      // deplete the seed's fixed pool of wait_for_confirmation orders
      await admin.from("orders").update({ confirmation_status: "wait_for_confirmation" }).eq("id", target!.id);
    });

    test("delivery agent cannot confirm an order via the RPC either (authorization re-checked server-side)", async () => {
      const { data: target } = await admin
        .from("orders")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("confirmation_status", "wait_for_confirmation")
        .limit(1)
        .single();
      const { error } = await delivAgent.rpc("transition_order_status", {
        p_order_id: target!.id,
        p_confirmation_status: "confirmed",
      });
      expect(error).not.toBeNull();
    });

    test("confirmation agent cannot change delivery_status (guard_order_fields)", async () => {
      const { data: target } = await admin
        .from("orders")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("confirmation_status", "wait_for_confirmation")
        .limit(1)
        .single();
      const { error } = await confAgent.from("orders").update({ delivery_status: "delivered" }).eq("id", target!.id);
      expect(error).not.toBeNull();
    });

    test("delivery agent cannot change confirmation fields (guard_order_fields)", async () => {
      const { data: target } = await admin
        .from("orders")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("confirmation_status", "confirmed")
        .limit(1)
        .single();
      const { error } = await delivAgent
        .from("orders")
        .update({ confirmation_status: "cancelled" })
        .eq("id", target!.id);
      expect(error).not.toBeNull();
    });
  });

  describe("cross-workspace isolation", () => {
    test("workspace 1 admin never sees workspace 2's product", async () => {
      const { data } = await adminUser.from("products").select("name");
      expect((data ?? []).some((p) => p.name === "WS2-only product")).toBe(false);
    });

    test("workspace 1 agent never sees workspace 2's orders", async () => {
      const { data } = await confAgent.from("orders").select("workspace_id");
      expect((data ?? []).every((o) => o.workspace_id === workspaceId)).toBe(true);
    });
  });
});
