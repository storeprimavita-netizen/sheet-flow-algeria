import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { deleteWorkspaces } from "@/lib/test-cleanup";

/** Live STORE-2 checks: stores and store_pages grants, RLS and integrity. */
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

describe.skipIf(!URL)("stores and store_pages (live DB)", () => {
  let svc: SupabaseClient;
  let anon: SupabaseClient;
  let adminA: SupabaseClient;
  let adminB: SupabaseClient;
  let agent: SupabaseClient;
  let ws: string;
  let ws2: string;
  const users: string[] = [];
  const tag = () => `s${crypto.randomUUID().slice(0, 8)}`;

  async function userIn(workspace: string, role: "admin" | "confirmation_agent") {
    const email = `st2-${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const up = await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    return signIn(email);
  }
  const store = (workspace = ws) =>
    svc.from("stores").insert({ workspace_id: workspace, slug: tag(), name: "Store" }).select("id, slug").single();
  const product = async (workspace = ws) =>
    (await svc.from("products").insert({ workspace_id: workspace, name: tag() }).select("id").single()).data!.id as string;

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
    await svc.from("store_pages").delete().in("workspace_id", wss);
    await svc.from("stores").delete().in("workspace_id", wss);
    for (const t of ["settings", "wilaya_fees", "fixed_fees", "exchange_rates", "expenses", "product_costs"] as const) {
      await svc.from(t).delete().in("workspace_id", wss);
    }
    expect((await deleteWorkspaces(svc, wss)).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  test("anon no grant on stores/store_pages", async () => {
    await store();
    for (const t of ["stores", "store_pages"] as const) {
      expect((await anon.from(t).select("*")).error).not.toBeNull();
    }
    const out = psql(`select count(*) from information_schema.role_table_grants
      where table_schema='public' and table_name in ('stores','store_pages')
      and (grantee='anon' or (grantee='authenticated' and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')))`);
    expect(out.trim()).toBe("0");
  });

  test("functions not executable by anon", () => {
    const out = psql(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'store_workspace_immutable'
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`);
    expect(out.trim()).toBe("");
  });

  test("agent cannot read store_pages / reads stores not write", async () => {
    const s = (await store()).data!;
    const p = await product();
    await svc.from("store_pages").insert({ workspace_id: ws, store_id: s.id, product_id: p, slug: "page-one", title: "T" });
    expect((await agent.from("store_pages").select("id")).data ?? []).toEqual([]);
    expect((await agent.from("stores").select("id").eq("id", s.id)).data).toHaveLength(1);
    expect((await agent.from("stores").insert({ workspace_id: ws, slug: tag(), name: "x" })).error).not.toBeNull();
    expect((await agent.from("stores").update({ name: "hack" }).eq("id", s.id).select("id")).data ?? []).toEqual([]);
    expect((await adminA.from("store_pages").select("id").eq("store_id", s.id)).data).toHaveLength(1);
    expect((await adminA.from("stores").update({ name: "ok" }).eq("id", s.id).select("id")).data).toHaveLength(1);
  });

  test("workspace B admin cannot read A", async () => {
    const s = (await store()).data!;
    expect((await adminB.from("stores").select("id").eq("id", s.id)).data ?? []).toEqual([]);
    expect((await adminB.from("stores").update({ name: "hack" }).eq("id", s.id).select("id")).data ?? []).toEqual([]);
  });

  test("cross-workspace store/product id insert rejected", async () => {
    const sa = (await store()).data!;
    const sb = (await store(ws2)).data!;
    const pb = await product(ws2);
    const pa = await product();
    expect((await svc.from("store_pages").insert({ workspace_id: ws, store_id: sb.id, slug: "xx", title: "T" })).error).not.toBeNull();
    expect((await svc.from("store_pages").insert({ workspace_id: ws, store_id: sa.id, product_id: pb, slug: "xy", title: "T" })).error).not.toBeNull();
    expect((await svc.from("store_pages").insert({ workspace_id: ws, store_id: sa.id, product_id: pa, slug: "xz", title: "T" })).error).toBeNull();
  });

  test("slug rules, reserved words, immutability, publish needs a product", async () => {
    for (const slug of ["A", "a", "app", "api", "login", "s", "auth", "bad_slug", "x".repeat(41)]) {
      expect((await svc.from("stores").insert({ workspace_id: ws, slug, name: "x" })).error, slug).not.toBeNull();
    }
    const s = (await store()).data!;
    expect((await svc.from("stores").insert({ workspace_id: ws2, slug: s.slug, name: "dup" })).error).not.toBeNull();
    expect((await svc.from("stores").update({ workspace_id: ws2 }).eq("id", s.id)).error).not.toBeNull();
    expect((await svc.from("store_pages").insert({ workspace_id: ws, store_id: s.id, slug: "nopr", title: "T", status: "published" })).error).not.toBeNull();
    expect((await svc.from("store_pages").insert({ workspace_id: ws, store_id: s.id, kind: "content", slug: "about", title: "T", status: "published" })).error).toBeNull();
  });

  test("store_pages cross-workspace: ws2 admin cannot read, insert with a ws1 store, or relink a ws1 product", async () => {
    const sa = (await store()).data!;
    const pa = await product();
    const pb = await product(ws2);
    const page = (await svc.from("store_pages").insert({ workspace_id: ws, store_id: sa.id, product_id: pa, slug: "rls-x", title: "T" }).select("id").single()).data!;
    expect((await adminB.from("store_pages").select("id").eq("id", page.id)).data ?? []).toEqual([]);
    expect((await adminB.from("store_pages").insert({ workspace_id: ws2, store_id: sa.id, slug: "rls-y", title: "T" })).error).not.toBeNull();
    expect((await adminB.from("store_pages").insert({ workspace_id: ws, store_id: sa.id, slug: "rls-z", title: "T" })).error).not.toBeNull();
    expect((await adminB.from("store_pages").update({ product_id: pb }).eq("id", page.id).select("id")).data ?? []).toEqual([]);
    // a ws1 admin cannot point its own page at a ws2 product either
    expect((await adminA.from("store_pages").update({ product_id: pb }).eq("id", page.id).select("id")).error).not.toBeNull();
    expect((await svc.from("store_pages").select("product_id").eq("id", page.id).single()).data?.product_id).toBe(pa);
  });
});
