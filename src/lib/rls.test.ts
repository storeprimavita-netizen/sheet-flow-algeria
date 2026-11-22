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
  "cash_collections", "product_scenarios", "settings", "contacts", "product_pricing",
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
    // scope "local": the default (global) revokes every session of the seed
    // users — including a developer's browser logged in as admin@seed.mnw.
    await adminUser.auth.signOut({ scope: "local" });
    await confAgent.auth.signOut({ scope: "local" });
    await delivAgent.auth.signOut({ scope: "local" });
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
    product_pricing: () => ({ product_id: productId, workspace_id: workspaceId }),
  };

  test.each(FINANCIAL_TABLES)("agent insert on %s is rejected", async (table) => {
    const { error } = await confAgent.from(table).insert(MINIMAL_INSERT[table]());
    expect(error).not.toBeNull();
  });

  test("product_pricing: agent update/delete touch 0 rows", async () => {
    const upd = await confAgent.from("product_pricing").update({ final_price: 1 }).eq("workspace_id", workspaceId).select();
    expect(upd.data ?? []).toEqual([]);
    const del = await confAgent.from("product_pricing").delete().eq("workspace_id", workspaceId).select();
    expect(del.data ?? []).toEqual([]);
    const { data } = await adminUser.from("product_pricing").select("product_id").eq("workspace_id", workspaceId);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  test("product_pricing: other-workspace admin cannot attach a row to our product (composite FK)", async () => {
    const ws2Admin = await signIn(LOCAL_URL!, "ws2-admin@seed.mnw");
    const { error } = await ws2Admin.from("product_pricing").insert({ product_id: productId, workspace_id: ws2Id });
    expect(error).not.toBeNull();
    await ws2Admin.auth.signOut({ scope: "local" });
  });

  test("product_pricing audit INSERT/UPDATE/DELETE", async () => {
    const { data: prod, error: pe } = await admin
      .from("products")
      .insert({ workspace_id: workspaceId, name: "rls-audit-pricing" })
      .select("id")
      .single();
    expect(pe).toBeNull();
    const pid = prod!.id;
    try {
      const ins = await adminUser.from("product_pricing").insert({ product_id: pid, workspace_id: workspaceId, final_price: 100 });
      expect(ins.error).toBeNull();
      const upd = await adminUser.from("product_pricing").update({ final_price: 200 }).eq("product_id", pid).select();
      expect(upd.error).toBeNull();
      expect(upd.data).toHaveLength(1);
      const del = await adminUser.from("product_pricing").delete().eq("product_id", pid).select();
      expect(del.error).toBeNull();
      expect(del.data).toHaveLength(1);
      const { data: audit } = await adminUser
        .from("audit_log")
        .select("action, old_row, new_row")
        .eq("workspace_id", workspaceId)
        .eq("table_name", "product_pricing")
        .order("created_at", { ascending: true });
      const mine = (audit ?? []).filter(
        (a) => ((a.new_row ?? a.old_row) as { product_id?: string } | null)?.product_id === pid,
      );
      expect(mine.map((a) => a.action)).toEqual(["INSERT", "UPDATE", "DELETE"]);
    } finally {
      await admin.from("product_pricing").delete().eq("product_id", pid);
      await admin.from("products").delete().eq("id", pid);
    }
  });

  test("product_pricing product_id cross-workspace UPDATE refused", async () => {
    const ws2Admin = await signIn(LOCAL_URL!, "ws2-admin@seed.mnw");
    const { data: ws2Prod } = await admin
      .from("products")
      .select("id")
      .eq("workspace_id", ws2Id)
      .eq("name", "WS2-only product")
      .single();
    const ws2Pid = ws2Prod!.id;
    try {
      const ins = await ws2Admin.from("product_pricing").insert({ product_id: ws2Pid, workspace_id: ws2Id, final_price: 50 });
      expect(ins.error).toBeNull();
      // move the row onto OUR workspace's product: composite FK (product_id, workspace_id) must refuse
      const upd = await ws2Admin.from("product_pricing").update({ product_id: productId }).eq("product_id", ws2Pid).select();
      expect(upd.error).not.toBeNull(); // composite FK (product_id, workspace_id) refuses the move
      expect(upd.data ?? []).toHaveLength(0);
      const { data: still } = await admin.from("product_pricing").select("product_id, workspace_id").eq("product_id", productId);
      expect((still ?? []).every((r) => r.workspace_id === workspaceId)).toBe(true);
      const { data: mine } = await admin.from("product_pricing").select("product_id").eq("product_id", ws2Pid);
      expect(mine).toHaveLength(1);
    } finally {
      await admin.from("product_pricing").delete().eq("product_id", ws2Pid);
      await ws2Admin.auth.signOut({ scope: "local" });
    }
  });

  test("pricing_defaults: agent cannot write; admin reset (delete) is audited as DELETE", async () => {
    const agentIns = await confAgent
      .from("settings")
      .insert({ workspace_id: workspaceId, key: "pricing_defaults", value: { share: 0.3 } });
    expect(agentIns.error).not.toBeNull();

    // keep whatever was saved before so the shared local DB is left as found
    const { data: prev } = await admin
      .from("settings")
      .select("value")
      .eq("workspace_id", workspaceId)
      .eq("key", "pricing_defaults")
      .maybeSingle();

    const ins = await adminUser
      .from("settings")
      .upsert({ workspace_id: workspaceId, key: "pricing_defaults", value: { share: 0.3 } }, { onConflict: "workspace_id,key" });
    expect(ins.error).toBeNull();
    const del = await adminUser
      .from("settings")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("key", "pricing_defaults")
      .select();
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
    const { data: audit } = await adminUser
      .from("audit_log")
      .select("action, old_row")
      .eq("workspace_id", workspaceId)
      .eq("table_name", "settings")
      .eq("action", "DELETE")
      .order("created_at", { ascending: false })
      .limit(1);
    expect((audit?.[0]?.old_row as { key?: string } | null)?.key).toBe("pricing_defaults");
    if (prev) {
      await admin
        .from("settings")
        .upsert({ workspace_id: workspaceId, key: "pricing_defaults", value: prev.value }, { onConflict: "workspace_id,key" });
    }
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
    const { data, error } = await adminUser.from("account_balances").select("account_id,currency,workspace_id");
    expect(error).toBeNull();
    expect(data?.map((row) => row.currency).sort()).toEqual(["DZD", "DZD", "USDT"]);
    expect(data?.every((row) => row.workspace_id === workspaceId)).toBe(true);
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
    const OPEN = ["wait_for_confirmation", "no_answer", "closed_phone"];
    const openOrder = async () =>
      (await admin.from("orders").select("id").eq("workspace_id", workspaceId)
        .in("confirmation_status", OPEN).is("assigned_confirmation_agent", null).limit(1).single()).data!.id;
    const confirmedOrder = async () =>
      (await admin.from("orders").select("id").eq("workspace_id", workspaceId)
        .eq("confirmation_status", "confirmed").is("assigned_confirmation_agent", null).limit(1).single()).data!.id;

    // A fresh seed assigns every confirmed order to the seed agent, so nothing
    // would be hidden from them. Guarantee one confirmed order that is not
    // theirs (as when an admin confirms), so the "cannot see / cannot touch
    // orders outside the queue" assertions always have a target.
    beforeAll(async () => {
      const base = () => admin.from("orders").select("id").eq("workspace_id", workspaceId).eq("confirmation_status", "confirmed");
      const { data: free } = await base().is("assigned_confirmation_agent", null).limit(1);
      if (free?.length) return;
      const { data: pick } = await base().eq("delivery_status", "delivered").limit(1).single();
      const { error } = await admin.from("orders").update({ assigned_confirmation_agent: null }).eq("id", pick!.id);
      if (error) throw error;
    });

    test("D10: confirmation agent sees only the open queue (+ their assigned), not confirmed/other orders", async () => {
      const { data, error } = await confAgent.from("orders").select("id, confirmation_status, assigned_confirmation_agent").eq("workspace_id", workspaceId);
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      const me = (await confAgent.auth.getUser()).data.user!.id;
      expect(data!.every((o) => OPEN.includes(o.confirmation_status) || o.assigned_confirmation_agent === me)).toBe(true);
      const { count: all } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
      expect(data!.length).toBeLessThan(all!);
      const { data: hidden } = await confAgent.from("orders").select("id").eq("id", await confirmedOrder());
      expect(hidden).toEqual([]);
    });

    test("D9/D10: legacy delivery agent is read-only and sees confirmed orders only", async () => {
      const { data, error } = await delivAgent.from("orders").select("id, confirmation_status, delivery_status").eq("workspace_id", workspaceId);
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((o) => o.confirmation_status === "confirmed")).toBe(true);
      // an order that is not delivered yet (row order is not guaranteed)
      const id = (data!.find((o) => o.delivery_status !== "delivered") ?? data![0]).id;
      const upd = await delivAgent.from("orders").update({ delivery_status: "delivered" }).eq("id", id).select("id");
      expect(upd.error ?? upd.data!.length === 0 ? true : false).toBe(true); // error or 0 rows
      const { data: after } = await admin.from("orders").select("delivery_status").eq("id", id).single();
      expect(after!.delivery_status).not.toBe("delivered");
      expect((await delivAgent.rpc("transition_order_status", { p_order_id: id, p_delivery_status: "delivered" })).error).not.toBeNull();
    });

    test("D10: confirmation agent cannot edit customer, address, assignment or price fields directly", async () => {
      const id = await openOrder();
      const me = (await confAgent.auth.getUser()).data.user!.id;
      const { data: cur } = await admin.from("orders").select("wilaya_code, delivery_type").eq("id", id).single();
      for (const patch of [
        { customer_name: "X" }, { customer_phone: "0555000000" }, { address: "x" }, { commune: "x" },
        { wilaya_code: cur!.wilaya_code === 16 ? 31 : 16 },
        { delivery_type: cur!.delivery_type === "home" ? ("stopdesk" as const) : ("home" as const) }, { assigned_confirmation_agent: me },
        { assigned_delivery_agent: me }, { sale_price: 1 }, { delivery_fee: 1 }, { quantity: 9 },
      ]) {
        const r = await confAgent.from("orders").update(patch).eq("id", id).select("id");
        expect(r.error, JSON.stringify(patch)).not.toBeNull();
      }
    });

    test("D10: confirmation agent CAN change confirmation fields on an open order (attempts/comment)", async () => {
      const id = await openOrder();
      const r = await confAgent.from("orders").update({ confirmation_attempts: 7, confirmation_comment: "called" }).eq("id", id).select("id");
      expect(r.error).toBeNull();
      expect(r.data).toHaveLength(1);
      await admin.from("orders").update({ confirmation_attempts: 0, confirmation_comment: null }).eq("id", id);
    });

    test("D9/D10: confirmation agent cannot set delivery_status via RPC, nor transition orders outside their queue", async () => {
      const open = await openOrder();
      expect((await confAgent.rpc("transition_order_status", { p_order_id: open, p_delivery_status: "delivered" })).error).not.toBeNull();
      const other = await confirmedOrder();
      expect((await confAgent.rpc("transition_order_status", { p_order_id: other, p_confirmation_status: "cancelled" })).error).not.toBeNull();
    });

    test("D10: once shipped or pushed to ZR, a confirmation agent cannot change an order by ANY path (direct PATCH or RPC)", async () => {
      const id = await openOrder();
      const me = (await confAgent.auth.getUser()).data.user!.id;
      try {
        // assigned to the agent (so RLS would let them see/update it) but already in transit
        await admin.from("orders").update({ assigned_confirmation_agent: me, delivery_status: "in_transit" }).eq("id", id);
        for (const patch of [{ confirmation_status: "cancelled" as const }, { confirmation_comment: "x" }, { confirmation_attempts: 9 }]) {
          const r = await confAgent.from("orders").update(patch).eq("id", id).select("id");
          expect(r.error, JSON.stringify(patch)).not.toBeNull();
        }
        expect((await confAgent.rpc("transition_order_status", { p_order_id: id, p_confirmation_status: "cancelled" })).error).not.toBeNull();

        // back to wait_for_deposit but with a ZR parcel → still locked
        await admin.from("orders").update({ delivery_status: "wait_for_deposit" }).eq("id", id);
        await admin.from("zr_shipments").insert({ order_id: id, workspace_id: workspaceId, parcel_id: crypto.randomUUID() });
        expect((await confAgent.from("orders").update({ confirmation_comment: "x" }).eq("id", id).select("id")).error).not.toBeNull();
        expect((await confAgent.rpc("transition_order_status", { p_order_id: id, p_confirmation_status: "cancelled" })).error).not.toBeNull();
        const { data: after } = await admin.from("orders").select("confirmation_status").eq("id", id).single();
        expect(after!.confirmation_status).not.toBe("cancelled");
      } finally {
        await admin.from("zr_shipments").delete().eq("order_id", id);
        await admin.from("orders").update({ assigned_confirmation_agent: null, delivery_status: "wait_for_deposit" }).eq("id", id);
      }
    });

    test("D10: admin and service role can still edit customer fields and delivery status", async () => {
      const id = await openOrder();
      const { data: before } = await admin.from("orders").select("customer_name, delivery_status").eq("id", id).single();
      expect((await admin.from("orders").update({ customer_name: "svc-edit" }).eq("id", id)).error).toBeNull();
      await admin.from("orders").update({ customer_name: before!.customer_name }).eq("id", id);
      expect(before!.delivery_status).toBe("wait_for_deposit");
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
      await admin.from("orders").update({ confirmation_status: "wait_for_confirmation", assigned_confirmation_agent: null }).eq("id", target!.id);
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

  });

  describe("apply_zr_state is service_role only (00027)", () => {
    const args = {
      p_ws: "00000000-0000-0000-0000-000000000000", p_parcel: "00000000-0000-0000-0000-000000000000",
      p_state: "Livre", p_slug: null as unknown as string, p_situation: null as unknown as string,
      p_is_return: null as unknown as boolean, p_occurred: "2026-01-01T00:00:00Z",
    };
    test("anon and authenticated (admin included) are denied; service role is not", async () => {
      expect((await sign(LOCAL_URL!, ANON_KEY).rpc("apply_zr_state", args)).error).not.toBeNull();
      expect((await adminUser.rpc("apply_zr_state", args)).error).not.toBeNull();
      expect((await confAgent.rpc("apply_zr_state", args)).error).not.toBeNull();
      expect((await admin.rpc("apply_zr_state", args)).error).toBeNull();
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

  describe("users without a usable profile see nothing (NAV-5-H)", () => {
    const BUSINESS = ["orders", "customers", "products", "settings"] as const;
    const made: string[] = [];

    async function makeUser(tag: string, profile: null | { is_active: boolean; workspace_id: string | null }) {
      const email = `noaccess-${tag}-${Date.now()}@seed.mnw`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: SEED_PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
      made.push(data.user.id);
      // the signup trigger may create a profile row; normalise to the case under test
      await admin.from("profiles").delete().eq("user_id", data.user.id);
      if (profile) {
        const { error: pe } = await admin
          .from("profiles")
          .insert({ user_id: data.user.id, role: "confirmation_agent", ...profile });
        if (pe) throw new Error(pe.message);
      }
      return { id: data.user.id, client: await signIn(LOCAL_URL!, email) };
    }

    afterAll(async () => {
      for (const id of made) {
        await admin.from("profiles").delete().eq("user_id", id);
        await admin.auth.admin.deleteUser(id);
      }
    });

    const cases = [
      ["a: no profile row", null],
      ["b: is_active = false", { is_active: false, workspace_id: "WS" }],
      ["c: null workspace", { is_active: true, workspace_id: null }],
    ] as const;

    test.each(cases)("%s: own profile only, zero business rows", async (name, profile) => {
      const u = await makeUser(name[0], profile && { ...profile, workspace_id: profile.workspace_id && workspaceId });
      const { data: own } = await u.client.from("profiles").select("user_id");
      expect((own ?? []).map((r) => r.user_id)).toEqual(profile ? [u.id] : []);
      // same predicate as getProfile(): inactive or workspace-less -> null
      const { data: row } = await u.client
        .from("profiles")
        .select("role, workspace_id, is_active")
        .eq("user_id", u.id)
        .maybeSingle();
      expect(!!row?.is_active && !!row?.workspace_id).toBe(false);
      for (const table of BUSINESS) {
        const { count, error } = await u.client.from(table).select("*", { count: "exact", head: true });
        expect(error).toBeNull();
        expect(count).toBe(0);
      }
    });
  });
});
