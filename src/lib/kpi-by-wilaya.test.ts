import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { deleteWorkspaces } from "@/lib/test-cleanup";

/** Live STATS-2 checks (migration 00058, D64): admin-only per-wilaya / per-commune rates. */
const URL = process.env.LOCAL_SUPABASE_URL;
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SEED_PASSWORD = "SeedDev!2026";

const psql = (sql: string) =>
  execFileSync("docker", ["exec", "-i", "supabase_db_mnw-erp", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

const client = (key: string) => createClient(URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(email: string) {
  const c = client(ANON_KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return c;
}

type Metric = { num: number; den: number; value: number | null; matured: boolean };
type Rates = { confirmation: Metric; delivery: Metric; return: Metric; counts: { received: number } };
type Extras = {
  shipped: number; home_count: number; stopdesk_count: number;
  avg_days_to_deliver: number | null; avg_days_sample: number;
};
type WRow = { wilaya_code: number; rates: Rates; extras: Extras };
type CRow = { commune_key: string | null; commune: string | null; rates: Rates; extras: Extras };

const DAY = "2026-03-10";
const NOON = `${DAY}T12:00:00Z`;

describe.skipIf(!URL)("kpi_by_wilaya / kpi_by_commune (live DB, 00058)", () => {
  let svc: SupabaseClient;
  let admin: SupabaseClient;
  let confAgent: SupabaseClient;
  let delAgent: SupabaseClient;
  let ws2Admin: SupabaseClient;
  let ws: string;
  let ws2: string;
  const users: string[] = [];
  const tag = () => `bw-${crypto.randomUUID()}`;

  async function userIn(workspace: string, role: "admin" | "confirmation_agent" | "delivery_agent") {
    const email = `bw-${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const up = await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    return signIn(email);
  }
  async function product(workspace = ws) {
    const { data, error } = await svc.from("products").insert({ workspace_id: workspace, name: tag() }).select("id").single();
    expect(error).toBeNull();
    return data!.id as string;
  }
  async function order(p: string, over: Record<string, unknown> = {}, workspace = ws) {
    const { data, error } = await svc
      .from("orders")
      .insert({
        workspace_id: workspace, product_id: p, quantity: 1, sale_price: 1000, placed_at: NOON,
        confirmation_status: "confirmed", wilaya_code: 16, commune: "Bab Ezzouar", ...over,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }
  async function byWilaya(p: string, c = admin) {
    const { data, error } = await c.rpc("kpi_by_wilaya", { p_from: DAY, p_to: DAY, p_product: [p] });
    expect(error).toBeNull();
    return (data ?? []) as unknown as WRow[];
  }
  async function byCommune(p: string, wilaya: number | null, c = admin) {
    const { data, error } = await c.rpc("kpi_by_commune", { p_wilaya: wilaya as number, p_from: DAY, p_to: DAY, p_product: [p] });
    expect(error).toBeNull();
    return (data ?? []) as unknown as CRow[];
  }

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    ws = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    ws2 = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    admin = await userIn(ws, "admin");
    confAgent = await userIn(ws, "confirmation_agent");
    delAgent = await userIn(ws, "delivery_agent");
    ws2Admin = await userIn(ws2, "admin");
  });
  afterAll(async () => {
    if (!svc) return;
    const wss = [ws, ws2].filter(Boolean);
    await svc.from("zr_shipments").delete().in("workspace_id", wss);
    expect((await deleteWorkspaces(svc, wss)).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  test("admin wilaya row equals kpi_rates over the same wilaya ids", async () => {
    const p = await product();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push(await order(p));
    ids.push(await order(p, { confirmation_status: "cancelled" }));
    await order(p, { wilaya_code: 31 });
    const rows = await byWilaya(p);
    expect(rows.map((r) => r.wilaya_code).sort()).toEqual([16, 31]);
    const { data: direct } = await admin.rpc("kpi_rates", { p_order_ids: ids });
    expect(rows.find((r) => r.wilaya_code === 16)!.rates).toEqual(direct);
    expect(rows.find((r) => r.wilaya_code === 16)!.rates.counts.received).toBe(4);
  });

  test("agents get zero rows from both functions; anon cannot execute; other workspace and NULL wilaya return nothing", async () => {
    const p = await product();
    await order(p);
    expect((await byWilaya(p)).length).toBe(1);
    for (const a of [confAgent, delAgent]) {
      expect(await byWilaya(p, a)).toEqual([]);
      expect(await byCommune(p, 16, a)).toEqual([]);
    }
    expect(await byWilaya(p, ws2Admin)).toEqual([]);
    expect(await byCommune(p, 16, ws2Admin)).toEqual([]);
    expect(await byCommune(p, null)).toEqual([]);
    const anon = client(ANON_KEY);
    expect((await anon.rpc("kpi_by_wilaya", { p_from: DAY, p_to: DAY })).error).not.toBeNull();
    expect((await anon.rpc("kpi_by_commune", { p_wilaya: 16 })).error).not.toBeNull();
  });

  test("commune grouping: '', whitespace/case variants and NULL; communes sum to the wilaya row", async () => {
    const p = await product();
    await order(p, { commune: "Alger" });
    await order(p, { commune: "  alger " });
    await order(p, { commune: "Alger" });
    await order(p, { commune: "" });
    await order(p, { commune: null });
    const cs = await byCommune(p, 16);
    expect(cs.length).toBe(2);
    const known = cs.find((c) => c.commune_key === "alger")!;
    expect(known.commune).toBe("Alger");
    expect(known.rates.counts.received).toBe(3);
    const unknown = cs.find((c) => c.commune_key === null)!;
    expect(unknown.rates.counts.received).toBe(2);
    const w = (await byWilaya(p))[0];
    expect(cs.reduce((n, c) => n + c.rates.counts.received, 0)).toBe(w.rates.counts.received);
  });

  test("excluded orders and unconfirmed duplicates are absent; 23:30 UTC lands on the Algiers day", async () => {
    const p = await product();
    await order(p);
    await order(p, { excluded_reason: "test" });
    await order(p, { confirmation_status: "wait_for_confirmation", is_duplicate_suspect: true });
    await order(p, { placed_at: "2026-03-09T23:30:00Z" }); // = 2026-03-10 00:30 in Algiers
    await order(p, { placed_at: "2026-03-10T23:30:00Z" }); // = 2026-03-11 in Algiers: out
    const [w] = await byWilaya(p);
    expect(w.rates.counts.received).toBe(2);
  });

  test("swapped original counts as a return (D47); no shipped parcels gives null shares", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "delivered" });
    const b = await order(p, { delivery_status: "returning" });
    const sw = await admin.rpc("swap_order", {
      p_order_id: b, p_customer_id: null as unknown as string, p_customer_name: "Swap Client", p_customer_phone: "0555000111",
      p_wilaya_code: 16, p_commune: "x", p_address: "y",
    });
    expect(sw.error).toBeNull();
    const [w] = await byWilaya(p);
    expect(w.rates.return.num).toBe(1);
    expect(w.rates.delivery.den).toBe(w.extras.shipped);
    expect(a).toBeTruthy();

    const p2 = await product();
    await order(p2);
    const [w2] = await byWilaya(p2);
    expect(w2.extras.shipped).toBe(0);
    expect(w2.rates.delivery.value).toBeNull();
    expect(w2.extras.avg_days_to_deliver).toBeNull();
  });

  test("unresolved above 20% is not matured even with 10+ shipped; home/stopdesk over shipped", async () => {
    const p = await product();
    for (let i = 0; i < 6; i++) await order(p, { delivery_status: "delivered", delivery_type: "home" });
    for (let i = 0; i < 6; i++) await order(p, { delivery_status: "delivered", delivery_type: "stopdesk" });
    for (let i = 0; i < 6; i++) await order(p, { delivery_status: "wait_for_deposit" });
    const [w] = await byWilaya(p);
    expect(w.rates.delivery.den).toBe(12);
    expect(w.rates.delivery.matured).toBe(false);
    expect(w.extras.shipped).toBe(12);
    expect(w.extras.home_count).toBe(6);
    expect(w.extras.stopdesk_count).toBe(6);
  });

  test("avg_days_to_deliver counts delivered non-swapped orders only", async () => {
    const p = await product();
    const d = await order(p, { delivery_status: "delivered" });
    await order(p, { delivery_status: "in_transit" });
    psql(
      `update order_status_history set created_at = '${DAY}T12:00:00Z'::timestamptz + interval '3 days' ` +
        `where order_id = '${d}' and stage = 'delivery' and to_status = 'delivered';`,
    );
    const [w] = await byWilaya(p);
    expect(w.extras.avg_days_sample).toBe(1);
    expect(w.extras.avg_days_to_deliver).toBe(3);
  });
});
