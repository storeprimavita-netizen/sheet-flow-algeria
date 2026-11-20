import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { deleteWorkspaces } from "@/lib/test-cleanup";

/** Live ORD-1 (D57): per-workspace running order number. */
const URL = process.env.LOCAL_SUPABASE_URL;
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "SeedDev!2026";

const psql = (sql: string) =>
  execFileSync("docker", ["exec", "-i", "supabase_db_mnw-erp", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

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
      await svc.from("customers").delete().eq("workspace_id", ws);
      await svc.from("audit_log").delete().eq("workspace_id", ws);
      await deleteWorkspaces(svc, [ws]);
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

  test("order_counters is closed to clients and to service_role writes", async () => {
    const ws = await newWorkspace();
    const admin = await newSession(ws, "admin");
    const anon = client(ANON_KEY);
    expect((await admin.from("order_counters").select("*")).error?.code).toBe("42501");
    expect((await admin.from("order_counters").update({ next_seq: 1 }).eq("workspace_id", ws)).error?.code).toBe("42501");
    expect((await admin.from("order_counters").insert({ workspace_id: ws, next_seq: 5 })).error?.code).toBe("42501");
    expect((await anon.from("order_counters").update({ next_seq: 1 }).eq("workspace_id", ws)).error?.code).toBe("42501");
    expect((await svc.from("order_counters").update({ next_seq: 1 }).eq("workspace_id", ws)).error?.code).toBe("42501");
    expect(await counter(ws)).toBe(1);
  });

  test("fallback: with the counter row gone, the next numbers are max+1, max+2 and the counter max+3", async () => {
    const ws = await newWorkspace();
    for (let i = 0; i < 3; i++) expect((await svc.from("orders").insert({ workspace_id: ws })).error).toBeNull();
    psql(`delete from public.order_counters where workspace_id = '${ws}';`);
    expect(await svc.from("order_counters").select("next_seq").eq("workspace_id", ws).maybeSingle().then((r) => r.data)).toBeNull();
    for (let i = 0; i < 2; i++) expect((await svc.from("orders").insert({ workspace_id: ws })).error).toBeNull();
    expect(await seqs(ws)).toEqual([1, 2, 3, 4, 5]);
    expect(await counter(ws)).toBe(6);
  });

  test("ON CONFLICT DO NOTHING burns a number (documented: do not upsert orders)", async () => {
    const ws = await newWorkspace();
    const row = { workspace_id: ws, source: "manual", external_id: "dup-1" };
    expect((await svc.from("orders").insert(row)).error).toBeNull();
    const up = await svc.from("orders").upsert(row, { onConflict: "workspace_id,source,external_id", ignoreDuplicates: true });
    expect(up.error).toBeNull();
    expect(await seqs(ws)).toEqual([1]);
    expect(await counter(ws)).toBe(3);
  });

  test("swap_order: the replacement gets the next number, the original keeps its own", async () => {
    const ws = await newWorkspace();
    const admin = await newSession(ws, "admin");
    const p = await svc.from("products").insert({ workspace_id: ws, name: `ord1-${crypto.randomUUID()}` }).select("id").single();
    expect(p.error).toBeNull();
    const o = await svc
      .from("orders")
      .insert({ workspace_id: ws, product_id: p.data!.id, quantity: 1, confirmation_status: "confirmed", delivery_status: "returned" })
      .select("id, order_seq")
      .single();
    expect(o.error).toBeNull();
    expect(o.data!.order_seq).toBe(1);
    const r = await admin.rpc("swap_order", {
      p_order_id: o.data!.id, p_customer_id: null as unknown as string, p_customer_name: "Swap Client", p_customer_phone: "0555000111",
      p_wilaya_code: 16, p_commune: "x", p_address: "y",
    });
    expect(r.error).toBeNull();
    const b = await svc.from("orders").select("order_seq").eq("id", r.data as string).single();
    expect(b.data?.order_seq).toBe(2);
    expect((await svc.from("orders").select("order_seq").eq("id", o.data!.id).single()).data?.order_seq).toBe(1);
    expect(await counter(ws)).toBe(3);
    await svc.from("stock_movements").delete().eq("workspace_id", ws);
    await svc.from("orders").delete().eq("workspace_id", ws);
    await svc.from("products").delete().eq("id", p.data!.id);
  });

  test("manual order insert from an admin session (what createOrder does) gets its number", async () => {
    const ws = await newWorkspace();
    const admin = await newSession(ws, "admin");
    for (let i = 1; i <= 2; i++) {
      const r = await admin
        .from("orders")
        .insert({ workspace_id: ws, source: "manual", placed_at: new Date().toISOString(), quantity: 1 })
        .select("order_seq")
        .single();
      expect(r.error).toBeNull();
      expect(r.data?.order_seq).toBe(i);
    }
    expect(await counter(ws)).toBe(3);
  });

  test("webhook: replayEvent numbers a new order; replaying the same event keeps the number and the counter", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
    const { replayEvent } = await import("./webhook");
    const ws = await newWorkspace();
    const ext = `seq-${crypto.randomUUID()}`;
    const payload = {
      id: ext, order_number: 1, total_price: "4000", created_at: "2026-01-01T00:00:00Z",
      customer: { first_name: "A", last_name: "B", phone: "0555123456" },
      line_items: [{ quantity: 1, title: "no-such-product-zzz" }],
    };
    const ev = await svc.from("webhook_events").insert({ workspace_id: ws, provider: "shopify", payload, signature_ok: true }).select("id").single();
    expect(ev.error).toBeNull();
    try {
      expect((await replayEvent(ev.data!.id, ws)).ok).toBe(true);
      const sel = () => svc.from("orders").select("id, order_seq, customer_id").eq("workspace_id", ws).eq("external_id", ext).single();
      const first = (await sel()).data!;
      expect(first.order_seq).toBe(1);
      const after = await counter(ws);
      expect(after).toBe(2);
      expect((await replayEvent(ev.data!.id, ws)).ok).toBe(true);
      expect((await sel()).data!.order_seq).toBe(1);
      expect(await counter(ws)).toBe(after);
    } finally {
      await svc.from("orders").delete().eq("workspace_id", ws);
      await svc.from("customers").delete().eq("workspace_id", ws);
      await svc.from("webhook_events").delete().eq("workspace_id", ws);
    }
  });

  test("insert with an unknown workspace fails with the FK error", async () => {
    const r = await svc.from("orders").insert({ workspace_id: crypto.randomUUID() });
    expect(r.error?.code).toBe("23503");
  });
});
