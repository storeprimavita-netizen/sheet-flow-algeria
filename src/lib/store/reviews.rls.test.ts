import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { deleteWorkspaces } from "@/lib/test-cleanup";

/** Live STORE-7 checks: reviews grants, RLS and integrity. */
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

describe.skipIf(!URL)("reviews (live DB)", () => {
  let svc: SupabaseClient;
  let anon: SupabaseClient;
  let adminA: SupabaseClient;
  let adminB: SupabaseClient;
  let agent: SupabaseClient;
  let ws: string;
  let ws2: string;
  const users: string[] = [];
  const tag = () => `r${crypto.randomUUID().slice(0, 8)}`;

  async function userIn(workspace: string, role: "admin" | "confirmation_agent") {
    const email = `st7-${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const up = await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    return signIn(email);
  }
  const product = async (workspace = ws) =>
    (await svc.from("products").insert({ workspace_id: workspace, name: tag() }).select("id").single()).data!.id as string;
  const order = async (workspace: string, p: string) =>
    (await svc.from("orders").insert({ workspace_id: workspace, product_id: p, quantity: 1 }).select("id").single()).data!.id as string;

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    anon = client(ANON_KEY);
    ws = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    ws2 = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    adminA = await userIn(ws, "admin");
    adminB = await userIn(ws2, "admin");
    agent = await userIn(ws, "confirmation_agent");
  });
  afterAll(async () => {
    if (!svc) return;
    const wss = [ws, ws2].filter(Boolean);
    await svc.from("reviews").delete().in("workspace_id", wss);
    await svc.from("orders").delete().in("workspace_id", wss);
    expect((await deleteWorkspaces(svc, wss)).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  const row = (p: string, over: Record<string, unknown> = {}) => ({ workspace_id: ws, product_id: p, name: "Amina B.", rating: 5, body: "Great", ...over });

  test("anon has no grant; authenticated has no truncate/trigger/references", async () => {
    const p = await product();
    await svc.from("reviews").insert(row(p));
    expect((await anon.from("reviews").select("*")).error).not.toBeNull();
    const out = psql(`select count(*) from information_schema.role_table_grants
      where table_schema='public' and table_name='reviews'
      and (grantee='anon' or (grantee='authenticated' and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')))`);
    expect(out.trim()).toBe("0");
  });

  test("agent denied select and write; admin allowed", async () => {
    const p = await product();
    const r = (await svc.from("reviews").insert(row(p)).select("id").single()).data!;
    expect((await agent.from("reviews").select("id")).data ?? []).toEqual([]);
    expect((await agent.from("reviews").insert(row(p))).error).not.toBeNull();
    expect((await agent.from("reviews").update({ approved: true }).eq("id", r.id).select("id")).data ?? []).toEqual([]);
    expect((await agent.from("reviews").delete().eq("id", r.id).select("id")).data ?? []).toEqual([]);
    expect((await adminA.from("reviews").select("id").eq("id", r.id)).data).toHaveLength(1);
    expect((await adminA.from("reviews").update({ approved: true }).eq("id", r.id).select("id")).data).toHaveLength(1);
  });

  test("other-workspace admin sees and changes nothing", async () => {
    const p = await product();
    const r = (await svc.from("reviews").insert(row(p)).select("id").single()).data!;
    expect((await adminB.from("reviews").select("id").eq("id", r.id)).data ?? []).toEqual([]);
    expect((await adminB.from("reviews").update({ approved: true }).eq("id", r.id).select("id")).data ?? []).toEqual([]);
    expect((await adminB.from("reviews").insert(row(p))).error).not.toBeNull();
  });

  test("cross-workspace product/order refused by FK", async () => {
    const pa = await product();
    const pb = await product(ws2);
    const ob = await order(ws2, pb);
    expect((await svc.from("reviews").insert(row(pb))).error).not.toBeNull();
    expect((await svc.from("reviews").insert(row(pa, { order_id: ob }))).error).not.toBeNull();
    const oa = await order(ws, pa);
    expect((await svc.from("reviews").insert(row(pa, { order_id: oa }))).error).toBeNull();
  });

  test("checks: rating, blank, lengths; workspace immutable", async () => {
    const p = await product();
    for (const over of [{ rating: 0 }, { rating: 6 }, { body: "  " }, { name: " " }, { name: "x".repeat(81) }, { body: "x".repeat(1001) }]) {
      expect((await svc.from("reviews").insert(row(p, over))).error, JSON.stringify(over).slice(0, 40)).not.toBeNull();
    }
    const r = (await svc.from("reviews").insert(row(p)).select("id").single()).data!;
    expect((await svc.from("reviews").update({ workspace_id: ws2 }).eq("id", r.id)).error).not.toBeNull();
  });
});
