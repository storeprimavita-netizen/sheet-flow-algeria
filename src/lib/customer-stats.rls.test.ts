import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Database, Json } from "@/lib/supabase/database.types";
import { deleteLeakedWorkspaces, deleteWorkspaces } from "@/lib/test-cleanup";
import { DB_CONTAINER } from "@/lib/test-db";

const url = process.env.LOCAL_SUPABASE_URL;
// Published local Supabase demo credentials.
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const views = ["customer_stats", "customer_delivery_stats", "customer_product_stats"] as const;
const prefix = "customer-stats-test-";
const placedAt = "2026-03-12T10:00:00.000Z";
const client = (key: string) => createClient<Database>(url!, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Client = ReturnType<typeof client>;
type NewOrder = Database["public"]["Tables"]["orders"]["Insert"];
type Role = Database["public"]["Enums"]["app_role"];

function psql(sql: string) {
  return execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

describe.skipIf(!url)("STATS-1 customer analytics (live RLS)", () => {
  let service: Client;
  let admin: Client;
  let otherAdmin: Client;
  let confirmation: Client;
  let confirmationId: string;
  let delivery: Client;
  let workspace: string;
  let otherWorkspace: string;
  let product: string;
  let nextPhone = 551020000;
  const workspaces: string[] = [];
  const users: string[] = [];

  async function makeWorkspace() {
    const { data, error } = await service.from("workspaces")
      .insert({ name: `${prefix}${crypto.randomUUID()}` }).select("id").single();
    expect(error).toBeNull();
    workspaces.push(data!.id);
    return data!.id;
  }

  async function member(workspaceId: string, role: Role) {
    const email = `${prefix}${crypto.randomUUID()}@test.mnw`;
    const password = crypto.randomUUID();
    const result = await service.auth.admin.createUser({ email, password, email_confirm: true });
    expect(result.error).toBeNull();
    const id = result.data.user!.id;
    users.push(id);
    const profile = await service.from("profiles").update({ workspace_id: workspaceId, role, is_active: true }).eq("user_id", id);
    expect(profile.error).toBeNull();
    const session = client(anonKey);
    expect((await session.auth.signInWithPassword({ email, password })).error).toBeNull();
    return { session, id };
  }

  async function customer(workspaceId = workspace, phone = `0${nextPhone++}`) {
    const { data, error } = await service.from("customers")
      .insert({ workspace_id: workspaceId, name: "Customer stats fixture", phone }).select("id").single();
    expect(error).toBeNull();
    return data!.id;
  }

  async function orders(customerId: string, items: Partial<NewOrder>[]) {
    const { data, error } = await service.from("orders").insert(items.map((row) => ({
      workspace_id: workspace, customer_id: customerId, product_id: product,
      placed_at: placedAt, quantity: 2, sale_price: 1000, delivery_fee: 300, ...row,
    })), { defaultToNull: false }).select("id");
    expect(error).toBeNull();
    return data!.map(({ id }) => id);
  }

  async function history(customerId: string, session = admin) {
    const { data, error } = await session.from("customer_stats").select("*").eq("id", customerId).single();
    expect(error).toBeNull();
    return data!;
  }

  async function deliveryStats(customerId: string, session = admin) {
    const { data, error } = await session.from("customer_delivery_stats").select("*").eq("customer_id", customerId).single();
    expect(error).toBeNull();
    return data!;
  }

  async function weights(value: NonNullable<Json>) {
    const { error } = await admin.from("settings").upsert({ workspace_id: workspace, key: "risk_weights", value });
    expect(error).toBeNull();
  }

  beforeAll(async () => {
    service = client(serviceKey);
    await deleteLeakedWorkspaces(service, prefix);
    workspace = await makeWorkspace();
    otherWorkspace = await makeWorkspace();
    admin = (await member(workspace, "admin")).session;
    otherAdmin = (await member(otherWorkspace, "admin")).session;
    ({ session: confirmation, id: confirmationId } = await member(workspace, "confirmation_agent"));
    delivery = (await member(workspace, "delivery_agent")).session;
    const result = await service.from("products").insert({ workspace_id: workspace, name: "Customer stats product" })
      .select("id").single();
    expect(result.error).toBeNull();
    product = result.data!.id;
  }, 30_000);

  afterAll(async () => {
    if (!service) return;
    if (workspaces.length) expect((await deleteWorkspaces(service, workspaces)).error).toBeNull();
    for (const id of users) expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
  });

  test("keeps the existing risk formula and weighted reason counts", async () => {
    const id = await customer();
    await weights({});
    const [earlierId, laterId] = [crypto.randomUUID(), crypto.randomUUID()].sort();
    await orders(id, [
      { placed_at: null, created_at: "2026-03-10T09:00:00Z", confirmation_status: "confirmed", delivery_status: "returned" },
      { id: earlierId, confirmation_status: "cancelled", delivery_status: "cancelled" },
      { id: laterId, confirmation_status: "closed_phone" },
    ]);
    expect(await history(id)).toMatchObject({
      risk_score: 58, risk_state: "high", risk_reason: "returned", history_scope: "workspace",
      total_orders: 3, confirmed_orders: 1, delivered_orders: 0, returned_orders: 1,
      cancelled_orders: 1, no_answer_orders: 1,
      // Both latest candidates have the same timestamp. The larger UUID wins.
      last_confirmation_status: "closed_phone", last_delivery_status: "wait_for_deposit",
    });
    const dates = await history(id);
    expect(new Date(dates.first_order_at!).toISOString()).toBe("2026-03-10T09:00:00.000Z");
    expect(new Date(dates.last_order_at!).toISOString()).toBe(placedAt);
    const products = await admin.from("customer_product_stats").select("product_id,order_count").eq("customer_id", id);
    expect(products.error).toBeNull();
    expect(products.data).toEqual([{ product_id: product, order_count: 3 }]);

    await weights({ returned: 2, cancelled: 2, no_answer: 0.5 });
    expect(await history(id)).toMatchObject({ risk_score: 75, risk_reason: "returned" });
    await weights({ returned: 2, cancelled: 3, no_answer: 3 });
    expect(await history(id)).toMatchObject({ risk_score: 100, risk_reason: "cancelled" });
    await weights({ returned: "invalid", cancelled: -1, no_answer: null });
    expect(await history(id)).toMatchObject({ risk_score: 42, risk_reason: "returned" });
    await weights({ returned: -1 });
    expect(await history(id)).toMatchObject({ risk_score: null, risk_state: "unscored", risk_reason: "unscored" });

    const rounded = await customer();
    await orders(rounded, [{ confirmation_status: "no_answer" }]);
    await weights({ no_answer: 0.001 });
    expect(await history(rounded)).toMatchObject({ risk_score: 0, risk_state: "neutral", risk_reason: "no_answer" });
    await weights({ no_answer: -1 });
    expect(await history(rounded)).toMatchObject({ risk_score: 0, risk_state: "neutral", risk_reason: "no_adverse_signal" });

    const empty = await customer();
    expect(await history(empty)).toMatchObject({
      total_orders: 0, risk_score: null, risk_state: "new", risk_reason: "no_history",
      first_order_at: null, last_order_at: null, last_delivery_status: null, last_confirmation_status: null,
    });
  });

  test("uses the D4 delivery cohort and publishes a rate only when matured", async () => {
    const id = await customer();
    const replacement = crypto.randomUUID();
    const original = crypto.randomUUID();
    const afterPickup = crypto.randomUUID();
    const deliveredOrder = { confirmation_status: "confirmed", delivery_status: "delivered" } as const;
    const ids = await orders(id, [
      ...Array.from({ length: 6 }, () => deliveredOrder),
      { id: replacement, ...deliveredOrder, assigned_confirmation_agent: confirmationId },
      { id: original, confirmation_status: "cancelled", delivery_status: "returned" },
      { confirmation_status: "confirmed", delivery_status: "returned" },
      { id: afterPickup, confirmation_status: "confirmed", delivery_status: "cancelled" },
      { confirmation_status: "confirmed", delivery_status: "in_transit" },
      { ...deliveredOrder, excluded_reason: "test" },
      { confirmation_status: "no_answer", is_duplicate_suspect: true },
      {},
    ]);
    psql(`begin; set local mnw.swap_link = '1';
      update public.orders set swapped_to_order_id = '${replacement}' where id = '${original}';
      update public.orders set delivery_status = 'delivered' where id = '${original}'; commit;`);
    const pickup = await service.from("order_status_history").insert({
      order_id: afterPickup, stage: "delivery", to_status: "bureau_deposited",
    });
    expect(pickup.error).toBeNull();

    const kpiArgs = { p_order_ids: ids, p_from: "2026-03-12", p_to: "2026-03-12", p_product: [product], p_filtered: false };
    const result = await admin.rpc("kpi_lines", kpiArgs);
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ delivery: { num: 7, den: 10, value: 0.7, matured: true }, pnl: { revenue: 14_000 } });
    expect(await deliveryStats(id)).toMatchObject({
      delivery_numerator: 7, delivery_denominator: 10, delivery_value: 0.7, delivery_matured: true,
      lifetime_delivered_value_dzd: 14_000,
    });
    expect(await history(id)).toMatchObject({ total_orders: 14, delivered_orders: 9, no_answer_orders: 1 });

    // The confirmation agent can see the assigned replacement and two queue rows.
    // The swap original is outside this session's order scope.
    const scoped = await confirmation.rpc("kpi_lines", kpiArgs);
    expect(scoped.error).toBeNull();
    expect(scoped.data).toMatchObject({ counts: { received: 2, swapped: 0 }, delivery: { num: 1, den: 1, matured: false } });
    expect(await deliveryStats(id, confirmation)).toMatchObject({
      delivery_numerator: 1, delivery_denominator: 1, delivery_value: null, delivery_matured: false,
      lifetime_delivered_value_dzd: null,
    });
    expect(await deliveryStats(await customer())).toMatchObject({
      delivery_numerator: 0, delivery_denominator: 0, delivery_value: null, delivery_matured: false,
      lifetime_delivered_value_dzd: 0,
    });
  });

  test("identifies caller-visible history and keeps lifetime value admin-only", async () => {
    const phone = "0551020999";
    const id = await customer(workspace, phone);
    const otherId = await customer(otherWorkspace, phone);
    await orders(id, [
      { confirmation_status: "confirmed", delivery_status: "returned", placed_at: "2026-03-13T10:00:00Z" },
      { confirmation_status: "no_answer" },
      { confirmation_status: "confirmed", delivery_status: "delivered", assigned_confirmation_agent: confirmationId },
    ]);
    await weights({ returned: 3, no_answer: 3 });
    expect(await history(id)).toMatchObject({
      history_scope: "workspace", total_orders: 3, risk_score: 67, risk_reason: "returned", last_delivery_status: "returned",
    });
    expect(await history(id, confirmation)).toMatchObject({
      history_scope: "visible", total_orders: 2, returned_orders: 0, risk_score: 13, risk_state: "warning", risk_reason: "no_answer",
    });
    expect(await history(id, delivery)).toMatchObject({
      history_scope: "visible", total_orders: 2, returned_orders: 1, no_answer_orders: 0, risk_score: 50,
    });
    expect(await deliveryStats(id)).toMatchObject({ delivery_denominator: 2, lifetime_delivered_value_dzd: 2000 });
    expect(await deliveryStats(id, delivery)).toMatchObject({ delivery_denominator: 2, lifetime_delivered_value_dzd: null });
    const visibleProducts = await confirmation.from("customer_product_stats").select("order_count").eq("customer_id", id);
    expect(visibleProducts.error).toBeNull();
    expect(visibleProducts.data).toEqual([{ order_count: 2 }]);

    await weights({ returned: 0 });
    expect(await history(id)).toMatchObject({ risk_score: null, risk_state: "unscored" });
    expect(await history(id, confirmation)).toMatchObject({ risk_score: 13, risk_state: "warning" });
    const hidden = await customer();
    await orders(hidden, [{ confirmation_status: "confirmed", delivery_status: "returned" }]);
    expect(await history(hidden, confirmation)).toMatchObject({
      history_scope: "visible", total_orders: 0, risk_score: null, risk_state: "new", risk_reason: "no_history", last_order_at: null,
    });

    expect(await history(otherId, otherAdmin)).toMatchObject({ phone, total_orders: 0 });
    for (const view of views) {
      const result = await otherAdmin.from(view).select("workspace_id").eq("workspace_id", workspace);
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
      expect((await client(anonKey).from(view).select("workspace_id")).error?.code).toBe("42501");
    }
  });

  test("exposes the three invoker views with SELECT-only grants", () => {
    const grants = psql(`select c.relname, privilege
      from pg_class c
      cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege
      where c.oid in ('public.customer_stats'::regclass, 'public.customer_delivery_stats'::regclass,
                      'public.customer_product_stats'::regclass)
        and c.reloptions @> array['security_invoker=true']
        and has_table_privilege('authenticated', c.oid, privilege)
      order by c.relname, privilege;`);
    expect(grants.split("\n")).toEqual([...views].sort().map((view) => `${view}|SELECT`));
  });
});
