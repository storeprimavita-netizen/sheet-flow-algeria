import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { deleteWorkspaces } from "@/lib/test-cleanup";

/** Live P1-7 checks: delivery prices apply RPC, communes RLS, availability. */
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

describe.skipIf(!URL)("delivery prices (live DB)", () => {
  let svc: SupabaseClient;
  let admin: SupabaseClient;
  let admin2: SupabaseClient;
  let agent: SupabaseClient;
  let ws: string;
  let ws2: string;
  const users: string[] = [];
  const tag = () => `dp-${crypto.randomUUID()}`;

  async function userIn(workspace: string, role: "admin" | "confirmation_agent") {
    const email = `p17-${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const up = await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    return signIn(email);
  }
  const fees = async (w: string, code: number) =>
    (await svc.from("wilaya_fees").select("*").eq("workspace_id", w).eq("wilaya_code", code).single()).data!;
  const payload = (over: Record<string, unknown> = {}) => ({
    wilayas: [
      { code: 1, priced: true, stopdesk_available: true, home_fee: 1400, stopdesk_fee: 970, communes: ["Adrar", "Bouda"], ...over },
      { code: 8, priced: true, stopdesk_available: false, home_fee: 700, stopdesk_fee: 0, communes: ["Bechar"] },
      { code: 33, priced: false, stopdesk_available: false, home_fee: 0, stopdesk_fee: 0, communes: [] },
    ],
  });

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    ws = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    ws2 = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    for (const w of [ws, ws2]) {
      const r = await svc.from("wilaya_fees").insert([1, 8, 33].map((c) => ({ workspace_id: w, wilaya_code: c, home_fee: 500, stopdesk_fee: 300 })));
      expect(r.error).toBeNull();
    }
    admin = await userIn(ws, "admin");
    admin2 = await userIn(ws2, "admin");
    agent = await userIn(ws, "confirmation_agent");
  });
  afterAll(async () => {
    if (!svc) return;
    const wss = [ws, ws2].filter(Boolean);
    for (const t of ["wilaya_communes", "wilaya_fees", "settings"] as const) await svc.from(t).delete().in("workspace_id", wss);
    expect((await deleteWorkspaces(svc, wss)).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  test("apply writes fees, flags and communes, keeps stop_shipping, is idempotent", async () => {
    await svc.from("wilaya_fees").update({ stop_shipping: true }).eq("workspace_id", ws).eq("wilaya_code", 33);
    expect((await admin.rpc("apply_delivery_prices", { p: payload() })).error).toBeNull();
    expect(await fees(ws, 1)).toMatchObject({ home_fee: 1400, stopdesk_fee: 970, priced: true, stopdesk_available: true });
    expect(await fees(ws, 8)).toMatchObject({ home_fee: 700, stopdesk_available: false, priced: true });
    expect(await fees(ws, 33)).toMatchObject({ priced: false, stop_shipping: true });
    const c1 = (await admin.from("wilaya_communes").select("name").eq("wilaya_code", 1)).data!.map((r) => r.name).sort();
    expect(c1).toEqual(["Adrar", "Bouda"]);
    // second run: same state, no new audit rows
    const before = (await svc.from("audit_log").select("id", { count: "exact", head: true }).eq("workspace_id", ws)).count;
    expect((await admin.rpc("apply_delivery_prices", { p: payload() })).error).toBeNull();
    const after = (await svc.from("audit_log").select("id", { count: "exact", head: true }).eq("workspace_id", ws)).count;
    expect(after).toBe(before);
    // commune set is replaced
    expect((await admin.rpc("apply_delivery_prices", { p: payload({ communes: ["Adrar"] }) })).error).toBeNull();
    expect((await admin.from("wilaya_communes").select("name").eq("wilaya_code", 1)).data!).toHaveLength(1);
  });

  test("delivery_fee_for returns null when unavailable", async () => {
    const f = async (code: number, type: string) => (await admin.rpc("delivery_fee_for", { p_ws: ws, p_wilaya: code, p_type: type })).data;
    expect(Number(await f(1, "stopdesk"))).toBe(970);
    expect(Number(await f(8, "home"))).toBe(700);
    expect(await f(8, "stopdesk")).toBeNull();
    expect(await f(33, "home")).toBeNull();
  });

  test("validation: bad code, negative fee, wrong shape", async () => {
    expect((await admin.rpc("apply_delivery_prices", { p: { wilayas: [{ code: 99 }] } })).error).not.toBeNull();
    expect((await admin.rpc("apply_delivery_prices", { p: payload({ home_fee: -1 }) })).error).not.toBeNull();
    expect((await admin.rpc("apply_delivery_prices", { p: { wilayas: "x" } })).error).not.toBeNull();
    expect((await admin.rpc("apply_delivery_prices", { p: {} })).error).not.toBeNull();
    expect((await admin.rpc("apply_delivery_prices", { p: payload({ home_fee: null }) })).error).not.toBeNull();
    expect((await admin.rpc("apply_delivery_prices", { p: payload({ stopdesk_fee: null }) })).error).not.toBeNull();
    expect((await admin.rpc("apply_delivery_prices", { p: { wilayas: [{ code: 1, home_fee: "NaN", stopdesk_fee: 1 }] } })).error).not.toBeNull();
  });

  test("swap_order refuses a stop-desk order into a home-only wilaya, allows home", async () => {
    expect((await admin.rpc("apply_delivery_prices", { p: payload() })).error).toBeNull();
    const prod = (await svc.from("products").insert({ workspace_id: ws, name: tag() }).select("id").single()).data!.id as string;
    const mk = async (type: "home" | "stopdesk") =>
      (await svc.from("orders").insert({ workspace_id: ws, product_id: prod, quantity: 1, wilaya_code: 1, delivery_type: type, confirmation_status: "confirmed", delivery_status: "returned" }).select("id").single()).data!.id as string;
    const swap = (id: string) => admin.rpc("swap_order", { p_order_id: id, p_customer_id: null, p_customer_name: "A", p_customer_phone: "0550000000", p_wilaya_code: 8, p_commune: "Bechar", p_address: "x" });
    const bad = await swap(await mk("stopdesk"));
    expect(bad.error?.message).toMatch(/not available/);
    const ok = await swap(await mk("home"));
    expect(ok.error).toBeNull();
    // the new order carries the destination wilaya's fee, not the old order's
    const b = (await svc.from("orders").select("delivery_fee").eq("id", ok.data as string).single()).data!;
    expect(Number(b.delivery_fee)).toBe(700);
    await svc.from("orders").delete().eq("workspace_id", ws);
    await svc.from("products").delete().eq("id", prod);
  });

  test("agent reads communes, cannot write or apply; other-workspace admin sees and changes nothing", async () => {
    expect((await agent.from("wilaya_communes").select("name").eq("wilaya_code", 1)).data!.length).toBeGreaterThan(0);
    expect((await agent.from("wilaya_communes").insert({ workspace_id: ws, wilaya_code: 1, name: "X" })).error).not.toBeNull();
    expect((await agent.rpc("apply_delivery_prices", { p: payload() })).error).not.toBeNull();
    expect((await admin2.from("wilaya_communes").select("name").eq("workspace_id", ws)).data).toEqual([]);
    expect((await admin2.rpc("apply_delivery_prices", { p: payload({ home_fee: 9999 }) })).error).toBeNull();
    expect(await fees(ws, 1)).toMatchObject({ home_fee: 1400 });
    expect(await fees(ws2, 1)).toMatchObject({ home_fee: 9999 });
    expect((await client(ANON_KEY).from("wilaya_communes").select("name")).error).not.toBeNull();
  });
});
