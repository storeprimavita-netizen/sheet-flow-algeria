import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { applyQueueSlice, CONFIRMED_EVENT_SELECT } from "@/app/(app)/app/sell/orders/_lib/order-query";
import { ACTIONABLE_CONFIRMATION } from "@/lib/statuses";
import { deleteWorkspaces } from "@/lib/test-cleanup";

/** Live CONF-4 checks: callback writes across workspaces, attempt history and the two queue slices. */
const URL = process.env.LOCAL_SUPABASE_URL;
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "SeedDev!2026";

const client = (key: string) => createClient(URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!URL)("order callbacks (live DB)", () => {
  let svc: SupabaseClient;
  let admin: SupabaseClient;
  let agent: SupabaseClient;
  let outsider: SupabaseClient;
  let ws: string;
  let ws2: string;
  let otherAgentId: string;
  const users: string[] = [];
  const future = new Date(Date.now() + 86_400_000).toISOString();

  async function userIn(workspace: string, role: "admin" | "confirmation_agent") {
    const email = `cb-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    expect((await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id)).error).toBeNull();
    const c = client(ANON_KEY);
    expect((await c.auth.signInWithPassword({ email, password: PASSWORD })).error).toBeNull();
    return { client: c, id: data.user.id };
  }

  async function order(over: Record<string, unknown> = {}) {
    const { data, error } = await svc.from("orders").insert({
      workspace_id: ws, source: "manual", customer_name: "Callback fixture", customer_phone: "0550000091",
      sale_price: 1000, quantity: 1, wilaya_code: 16, ...over,
    }).select("id").single();
    if (error) throw error;
    return data.id as string;
  }
  const schedule = (c: SupabaseClient, id: string, at: string | null = future) =>
    c.rpc("set_order_callback", { p_order_id: id, p_callback_at: at });
  const callbackOf = async (id: string) => (await svc.from("orders").select("callback_at").eq("id", id).single()).data!.callback_at;
  const ship = async (id: string) =>
    expect((await svc.from("zr_shipments").insert({ order_id: id, workspace_id: ws, parcel_id: crypto.randomUUID() })).error).toBeNull();

  /** Same shape as the Confirmation page query. */
  async function slice(c: SupabaseClient, name: "callbacks_due" | "confirmed_today", now: Date) {
    const columns = "id, zr:zr_shipments(order_id)";
    let query = c.from("orders")
      .select((name === "confirmed_today" ? `${columns}${CONFIRMED_EVENT_SELECT}` : columns) as typeof columns);
    if (name === "callbacks_due") {
      query = query.order("callback_at", { ascending: true }).order("id", { ascending: true })
        .in("confirmation_status", ACTIONABLE_CONFIRMATION);
    }
    const { data, error } = await applyQueueSlice(query, name, now);
    expect(error).toBeNull();
    return (data ?? []).map((row) => (row as { id: string }).id);
  }

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    ws = (await svc.from("workspaces").insert({ name: `cb-${crypto.randomUUID()}` }).select("id").single()).data!.id;
    ws2 = (await svc.from("workspaces").insert({ name: `cb-${crypto.randomUUID()}` }).select("id").single()).data!.id;
    admin = (await userIn(ws, "admin")).client;
    agent = (await userIn(ws, "confirmation_agent")).client;
    otherAgentId = (await userIn(ws, "confirmation_agent")).id;
    outsider = (await userIn(ws2, "admin")).client;
  });
  afterAll(async () => {
    if (!svc) return;
    await svc.from("orders").delete().in("workspace_id", [ws, ws2]);
    expect((await deleteWorkspaces(svc, [ws, ws2].filter(Boolean))).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  test("another workspace is refused; another agent's visible callback is editable; a parcel locks it", async () => {
    const id = await order({ assigned_confirmation_agent: otherAgentId });
    expect((await schedule(outsider, id)).error?.code).toBe("42501");
    expect((await schedule(agent, id)).error).toBeNull();
    expect(Date.parse(await callbackOf(id))).toBe(Date.parse(future));
    await ship(id);
    for (const c of [agent, admin]) expect((await schedule(c, id, null)).error?.code).toBe("55000");
  });

  test("history keeps real outcomes only: no initial row, no repeat on a no-op, actor or system", async () => {
    const id = await order({ confirmation_status: "no_answer" });
    const attempts = async () => (await agent.from("order_status_history").select("to_status, actor")
      .eq("order_id", id).eq("stage", "confirmation").not("from_status", "is", null)
      .in("to_status", ["no_answer", "closed_phone"]).order("created_at").order("id")).data!;
    expect(await attempts()).toEqual([]);
    const move = (status: string) => agent.rpc("transition_order_status", { p_order_id: id, p_confirmation_status: status });
    expect((await move("closed_phone")).error).toBeNull();
    expect((await move("closed_phone")).error).toBeNull();
    expect((await svc.from("orders").update({ confirmation_status: "no_answer" }).eq("id", id)).error).toBeNull();
    const rows = await attempts();
    expect(rows.map((r) => r.to_status)).toEqual(["closed_phone", "no_answer"]);
    expect(rows[0].actor).not.toBeNull();
    expect(rows[1].actor).toBeNull();
  });

  test("Due: before, at and after one instant, ties by id, without shipped or null rows", async () => {
    const [a, b, shipped, empty] = [await order(), await order(), await order(), await order()];
    const at = new Date(Date.now() + 172_800_000);
    for (const id of [a, b, shipped]) expect((await schedule(admin, id, at.toISOString())).error).toBeNull();
    await ship(shipped);
    const mine = async (now: Date) => (await slice(agent, "callbacks_due", now)).filter((id) => [a, b, shipped, empty].includes(id));
    expect(await mine(new Date(at.getTime() - 1))).toEqual([]);
    expect(await mine(at)).toEqual([a, b].sort());
    expect(await mine(new Date(at.getTime() + 1))).toEqual([a, b].sort());
    expect(await slice(outsider, "callbacks_due", new Date(at.getTime() + 1))).toEqual([]);
    expect((await svc.from("orders").update({ confirmation_status: "confirmed" }).eq("id", a)).error).toBeNull();
    expect(await mine(at)).toEqual([b]);
  });

  test("Today confirmed follows the Algiers day, once per order, and skips orders created confirmed", async () => {
    const now = new Date("2026-03-10T12:00:00Z"); // Algiers day: 09 Mar 23:00Z to 10 Mar 23:00Z
    const confirmedAt = async (...instants: string[]) => {
      const id = await order({ confirmation_status: "confirmed" });
      for (const created_at of instants) {
        expect((await svc.from("order_status_history").insert({
          order_id: id, stage: "confirmation", from_status: "no_answer", to_status: "confirmed", created_at,
        })).error).toBeNull();
      }
      return id;
    };
    const initial = await order({ confirmation_status: "confirmed" });
    const first = await confirmedAt("2026-03-09T23:00:00Z", "2026-03-10T08:00:00Z");
    const last = await confirmedAt("2026-03-10T22:59:59Z");
    const before = await confirmedAt("2026-03-09T22:59:59Z");
    const after = await confirmedAt("2026-03-10T23:00:00Z");
    const seen = await slice(admin, "confirmed_today", now);
    expect(seen.sort()).toEqual([first, last].sort());
    for (const id of [initial, before, after]) expect(seen).not.toContain(id);
    expect(await slice(outsider, "confirmed_today", now)).toEqual([]);
  });
});
