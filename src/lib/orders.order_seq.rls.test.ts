import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

/** Live ORD-1 (D57): per-workspace running order number. */
const URL = process.env.LOCAL_SUPABASE_URL;
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "SeedDev!2026";

const client = (key: string) => createClient(URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!URL)("orders.order_seq (live DB)", () => {
  let svc: SupabaseClient;
  const workspaces: string[] = [];
  const users: string[] = [];

  async function newWorkspace() {
    const { data, error } = await svc.from("workspaces").insert({ name: `ord1-${crypto.randomUUID()}` }).select("id").single();
    if (error) throw error;
    workspaces.push(data.id);
    return data.id as string;
  }
  async function newSession(ws: string, role: "admin" | "confirmation_agent") {
    const email = `ord1-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    await svc.from("profiles").update({ workspace_id: ws, role, is_active: true }).eq("user_id", data.user.id);
    const c = client(ANON_KEY);
    const si = await c.auth.signInWithPassword({ email, password: PASSWORD });
    if (si.error) throw si.error;
    return c;
  }
  const seqs = async (ws: string) =>
    ((await svc.from("orders").select("order_seq").eq("workspace_id", ws).order("order_seq")).data ?? []).map((r) => r.order_seq as number);
  const counter = async (ws: string) =>
    (await svc.from("order_counters").select("next_seq").eq("workspace_id", ws).single()).data?.next_seq as number;

  beforeAll(() => {
    svc = client(SERVICE_KEY);
  });
  afterAll(async () => {
    if (!svc) return;
    for (const ws of workspaces) {
      await svc.from("orders").delete().eq("workspace_id", ws);
      await svc.from("audit_log").delete().eq("workspace_id", ws);
      await svc.from("workspaces").delete().eq("id", ws);
    }
    for (const u of users) await svc.auth.admin.deleteUser(u);
  });

  test("new workspace starts at 1, sequential, independent per workspace, supplied value ignored", async () => {
    const a = await newWorkspace();
    const b = await newWorkspace();
    expect(await counter(a)).toBe(1);
    for (let i = 0; i < 3; i++) expect((await svc.from("orders").insert({ workspace_id: a }).select("order_seq").single()).error).toBeNull();
    const forced = await svc.from("orders").insert({ workspace_id: b, order_seq: 99 }).select("order_seq").single();
    expect(forced.data?.order_seq).toBe(1);
    expect(await seqs(a)).toEqual([1, 2, 3]);
    expect(await seqs(b)).toEqual([1]);
  });

  test("20 concurrent inserts are unique and gapless, even with failures", async () => {
    const ws = await newWorkspace();
    const bad = "00000000-0000-0000-0000-000000000000";
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        svc.from("orders").insert(i % 5 === 0 ? { workspace_id: ws, customer_id: bad } : { workspace_id: ws }),
      ),
    );
    const ok = results.filter((r) => !r.error).length;
    expect(ok).toBe(16);
    expect(await seqs(ws)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(await counter(ws)).toBe(17);
  });

  test("RLS-rejected foreign insert leaves the counter unchanged", async () => {
    const mine = await newWorkspace();
    const other = await newWorkspace();
    const agent = await newSession(mine, "confirmation_agent");
    const before = await counter(other);
    const r = await agent.from("orders").insert({ workspace_id: other });
    expect(r.error).not.toBeNull();
    expect(await counter(other)).toBe(before);
  });

  test("order_seq and workspace_id are immutable; delete does not reuse", async () => {
    const ws = await newWorkspace();
    const other = await newWorkspace();
    const admin = await newSession(ws, "admin");
    const agent = await newSession(ws, "confirmation_agent");
    const o = await admin.from("orders").insert({ workspace_id: ws }).select("id, order_seq").single();
    expect(o.error).toBeNull();
    const id = o.data!.id;
    expect((await admin.from("orders").update({ order_seq: 50 }).eq("id", id).select()).error).not.toBeNull();
    expect((await svc.from("orders").update({ order_seq: 50 }).eq("id", id)).error).not.toBeNull();
    expect((await svc.from("orders").update({ workspace_id: other }).eq("id", id)).error).not.toBeNull();
    expect((await admin.from("orders").update({ workspace_id: other }).eq("id", id)).error).not.toBeNull();
    const ag = await agent.from("orders").update({ order_seq: 50 }).eq("id", id).select();
    expect(ag.error !== null || (ag.data ?? []).length === 0).toBe(true);
    expect(await seqs(ws)).toEqual([1]);
    await svc.from("orders").delete().eq("id", id);
    const next = await svc.from("orders").insert({ workspace_id: ws }).select("order_seq").single();
    expect(next.data?.order_seq).toBe(2);
  });

  test("order_counters is closed to clients", async () => {
    const ws = await newWorkspace();
    const admin = await newSession(ws, "admin");
    expect((await admin.from("order_counters").select("*")).error).not.toBeNull();
    expect((await admin.from("order_counters").update({ next_seq: 1 }).eq("workspace_id", ws)).error).not.toBeNull();
    expect((await admin.from("order_counters").insert({ workspace_id: ws, next_seq: 5 })).error).not.toBeNull();
    // admin PATCH through the parent row cannot reach the counter either
    expect((await admin.from("workspaces").update({ next_seq: 1 } as never).eq("id", ws)).error).not.toBeNull();
    expect(await counter(ws)).toBe(1);
  });
});
