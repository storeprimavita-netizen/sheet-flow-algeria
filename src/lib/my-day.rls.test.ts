import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { getMyDay } from "@/lib/my-day";
import type { Database } from "@/lib/supabase/database.types";
import { deleteLeakedWorkspaces, deleteWorkspaces } from "@/lib/test-cleanup";

const URL = process.env.LOCAL_SUPABASE_URL;
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SEED_PASSWORD = "SeedDev!2026";

// The placeholder only lets a skipped suite be collected when there is no local database.
const client = (key: string) => createClient(URL ?? "http://skipped.invalid", key,{ auth: { persistSession: false, autoRefreshToken: false } });
type Role = "admin" | "confirmation_agent" | "delivery_agent";
type Who = { c: SupabaseClient; id: string };

describe.skipIf(!URL)("my day numbers (live DB, D86)", () => {
  const prefix = "myd-";
  const svc = client(SERVICE_KEY);
  const users: string[] = [];
  let ws = "";
  let ws2 = "";
  let admin: Who, a1: Who, a2: Who, courier: Who, courier2: Who, other: Who;

  const mk = async (workspace: string, role: Role): Promise<Who> => {
    const email = `${prefix}${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const up = await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    const c = client(ANON_KEY);
    const s = await c.auth.signInWithPassword({ email, password: SEED_PASSWORD });
    if (s.error) throw s.error;
    return { c, id: data.user.id };
  };
  const newOrder = async () => {
    const r = await svc.from("orders").insert({ workspace_id: ws, customer_name: "Test", customer_phone: "0555000000", sale_price: 1000 }).select("id").single();
    if (r.error) throw r.error;
    return r.data.id as string;
  };
  const change = async (who: Who, id: string, status: Database["public"]["Enums"]["confirmation_status"]) => {
    const r = await who.c.rpc("transition_order_status", { p_order_id: id, p_confirmation_status: status });
    expect(r.error).toBeNull();
  };
  const day = (who: Who, role: "confirmation_agent" | "delivery_agent") => getMyDay(who.c as unknown as SupabaseClient<Database>, who.id, role);

  beforeAll(async () => {
    await deleteLeakedWorkspaces(svc, prefix);
    ws = (await svc.from("workspaces").insert({ name: `${prefix}${crypto.randomUUID()}` }).select("id").single()).data!.id;
    ws2 = (await svc.from("workspaces").insert({ name: `${prefix}${crypto.randomUUID()}` }).select("id").single()).data!.id;
    admin = await mk(ws, "admin");
    a1 = await mk(ws, "confirmation_agent");
    a2 = await mk(ws, "confirmation_agent");
    courier = await mk(ws, "delivery_agent");
    courier2 = await mk(ws, "delivery_agent");
    other = await mk(ws2, "confirmation_agent");
  }, 60000);
  afterAll(async () => {
    if (!ws) return;
    await svc.from("orders").delete().in("workspace_id", [ws, ws2]);
    expect((await deleteWorkspaces(svc, [ws, ws2])).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  test("agent confirms unassigned order -> confirmed +1", async () => {
    await change(a1, await newOrder(), "confirmed");
    const d = await day(a1, "confirmation_agent");
    expect(d.kind === "confirmation" && d.numbers).toMatchObject({ confirmed: 1, handled: 1 });
  });

  test("second change same order same day adds no second order", async () => {
    const id = await newOrder();
    await change(a2, id, "no_answer");
    await change(a2, id, "confirmed");
    const d = await day(a2, "confirmation_agent");
    expect(d.kind === "confirmation" && d.numbers).toEqual({ confirmed: 1, cancelled: 0, callAgain: 0, handled: 1 });
  });

  test("admin change adds one to call again", async () => {
    const before = await day(a1, "confirmation_agent");
    const id = await newOrder();
    await change(a1, id, "no_answer"); // assigns to a1
    await change(admin, id, "cancelled");
    const after = await day(a1, "confirmation_agent");
    // the agent's own change is theirs; the admin's is not: this order counts as "to call again", not cancelled
    if (before.kind !== "confirmation" || after.kind !== "confirmation") throw new Error("kind");
    expect(after.numbers.cancelled).toBe(before.numbers.cancelled);
    expect(after.numbers.callAgain).toBe(before.numbers.callAgain + 1);
  });

  test("order agent confirmed then admin assigned elsewhere not counted (limit pinned)", async () => {
    const id = await newOrder();
    await change(a1, id, "confirmed");
    const before = await day(a1, "confirmation_agent");
    await svc.from("orders").update({ assigned_confirmation_agent: a2.id }).eq("id", id);
    const after = await day(a1, "confirmation_agent");
    expect(before.kind === "confirmation" && after.kind === "confirmation" && after.numbers.confirmed).toBe(
      before.kind === "confirmation" ? before.numbers.confirmed - 1 : -1,
    );
  });

  test("delivery counts use today's history, not updated_at; other workspace sees no queue", async () => {
    // a waiting order in ws: visible to a1, invisible to another workspace (this is what RLS proves)
    await newOrder();
    const a = await day(a1, "confirmation_agent");
    expect(a.queue).toBeGreaterThanOrEqual(1);
    const o = await day(other, "confirmation_agent");
    expect(o.kind === "confirmation" && o.numbers).toEqual({ confirmed: 0, cancelled: 0, callAgain: 0, handled: 0 });
    expect(o.queue).toBe(0);

    // delivered today by the courier
    const today = await newOrder();
    await svc.from("orders").update({ confirmation_status: "confirmed", assigned_delivery_agent: courier.id, delivery_status: "delivered" }).eq("id", today);
    // delivered yesterday, then touched today (updated_at is today): must not count
    const old = await newOrder();
    await svc.from("orders").update({ confirmation_status: "confirmed", assigned_delivery_agent: courier.id, delivery_status: "delivered" }).eq("id", old);
    const yesterday = new Date(Date.now() - 36 * 3_600_000).toISOString();
    expect((await svc.from("order_status_history").update({ created_at: yesterday }).eq("order_id", old).eq("stage", "delivery")).error).toBeNull();
    expect((await svc.from("orders").update({ customer_name: "Touched" }).eq("id", old)).error).toBeNull();

    const c = await day(courier, "delivery_agent");
    expect(c.kind === "delivery" && c.numbers).toEqual({ delivered: 1, returned: 0 });
    for (const d of [c, o, a]) expect(JSON.stringify(d)).not.toMatch(/price|cost|amount|dzd|fee|profit/i);
  });

  test("second courier's order delivered today is not counted for me", async () => {
    const before = await day(courier, "delivery_agent");
    const id = await newOrder();
    await svc.from("orders").update({ confirmation_status: "confirmed", assigned_delivery_agent: courier2.id, delivery_status: "delivered" }).eq("id", id);
    const mine = await day(courier, "delivery_agent");
    const theirs = await day(courier2, "delivery_agent");
    expect(mine.kind === "delivery" && before.kind === "delivery" && mine.numbers).toEqual(before.kind === "delivery" ? before.numbers : null);
    expect(theirs.kind === "delivery" && theirs.numbers.delivered).toBe(1);
  });
});
