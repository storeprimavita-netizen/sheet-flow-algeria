import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { deleteWorkspaces } from "@/lib/test-cleanup";

/** Live CONF-1 checks: order_views RLS, immutability, constraints, seeds. */
const URL = process.env.LOCAL_SUPABASE_URL;
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SEED_PASSWORD = "SeedDev!2026";

const client = (key: string) => createClient(URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(email: string) {
  const c = client(ANON_KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return c;
}

describe.skipIf(!URL)("order_views (live DB)", () => {
  let svc: SupabaseClient;
  let admin: SupabaseClient;
  let admin2: SupabaseClient;
  let agent: SupabaseClient;
  let agent2: SupabaseClient;
  let ids: Record<string, string> = {};
  let ws: string;
  let ws2: string;
  const users: string[] = [];
  const tag = () => `ov-${crypto.randomUUID()}`;

  async function userIn(workspace: string, role: "admin" | "confirmation_agent", key: string) {
    const email = `ov-${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    ids[key] = data.user.id;
    const up = await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    return signIn(email);
  }
  const view = (owner_id: string | null, name: string, over: Record<string, unknown> = {}) => ({
    workspace_id: ws,
    owner_id,
    name,
    scope: "all",
    ...over,
  });

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    ws = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    ws2 = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    admin = await userIn(ws, "admin", "admin");
    admin2 = await userIn(ws2, "admin", "admin2");
    agent = await userIn(ws, "confirmation_agent", "agent");
    agent2 = await userIn(ws, "confirmation_agent", "agent2");
  });
  afterAll(async () => {
    if (!svc) return;
    expect((await deleteWorkspaces(svc, [ws, ws2].filter(Boolean))).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  test("anon reads nothing", async () => {
    const r = await client(ANON_KEY).from("order_views").select("id");
    expect(r.error?.code === "42501" || (r.data ?? []).length === 0).toBe(true);
  });

  test("seeds exist for a new workspace, are idempotent, and a deleted seed does not return", async () => {
    const seeds = async (w: string) =>
      (await svc.from("order_views").select("seed_key, scope, owner_id").eq("workspace_id", w).not("seed_key", "is", null)).data!;
    expect((await seeds(ws)).map((r) => r.seed_key).sort()).toEqual(["callbacks_due", "confirmed_today", "duplicates", "kanban_by_status", "new", "no_answer"]);
    expect((await seeds(ws)).every((r) => r.owner_id === null)).toBe(true);
    const del = await svc.from("order_views").delete().eq("workspace_id", ws).eq("seed_key", "new");
    expect(del.error).toBeNull();
    // other writes to the workspace do not re-seed
    await svc.from("workspaces").update({ name: tag() }).eq("id", ws);
    expect((await seeds(ws)).map((r) => r.seed_key).sort()).toEqual(["callbacks_due", "confirmed_today", "duplicates", "kanban_by_status", "no_answer"]);
  });

  test("authenticated cannot call order-view seed helpers", async () => {
    for (const c of [admin, agent]) {
      expect((await c.rpc("seed_order_views", { ws })).error).not.toBeNull();
      expect((await c.rpc("seed_confirmation_kanban", { ws })).error).not.toBeNull();
      expect((await c.rpc("seed_confirmation_callback_views", { ws })).error).not.toBeNull();
      expect((await c.rpc("order_views_seed_for_workspace")).error).not.toBeNull();
    }
  });

  test("Kanban seed backfill preserves old deletions and skips name clashes and full groups", async () => {
    const confirmationViews = () => svc.from("order_views").select("seed_key, layout, position")
      .eq("workspace_id", ws).eq("scope", "confirmation").is("owner_id", null).order("position");
    expect((await confirmationViews()).data).toContainEqual({
      seed_key: "kanban_by_status", layout: "kanban", position: 2,
    });

    const removed = await svc.from("order_views").delete().eq("workspace_id", ws)
      .in("seed_key", ["new", "kanban_by_status"]);
    expect(removed.error).toBeNull();
    const backfill = () => svc.rpc("seed_confirmation_kanban", { ws });

    const clash = await svc.from("order_views").insert(view(null, "KANBAN BY STATUS", { scope: "confirmation", position: 9 }))
      .select("id").single();
    expect(clash.error).toBeNull();
    expect((await backfill()).error).toBeNull();
    expect((await confirmationViews()).data?.some((row) => row.seed_key === "kanban_by_status")).toBe(false);
    expect((await svc.from("order_views").delete().eq("id", clash.data!.id)).error).toBeNull();

    const added = await svc.from("order_views").insert(Array.from({ length: 17 }, (_, index) =>
      view(null, `Board cap ${index}`, { scope: "confirmation", position: index + 2 }),
    )).select("id");
    expect(added.error).toBeNull();
    expect((await backfill()).error).toBeNull();
    expect((await confirmationViews()).data).toHaveLength(20);
    expect((await svc.from("order_views").delete().in("id", added.data!.map((row) => row.id))).error).toBeNull();
    expect((await backfill()).error).toBeNull();
    expect((await confirmationViews()).data).toEqual([
      { seed_key: "no_answer", layout: "table", position: 1 },
      { seed_key: "callbacks_due", layout: "table", position: 3 },
      { seed_key: "confirmed_today", layout: "table", position: 4 },
      { seed_key: "kanban_by_status", layout: "kanban", position: 5 },
    ]);
  });

  test("agent writes and reads own; cannot see another's private view", async () => {
    const mine = await agent.from("order_views").insert(view(ids.agent, "mine")).select("id").single();
    expect(mine.error).toBeNull();
    const own = await agent.from("order_views").update({ name: "mine2" }).eq("id", mine.data!.id).select("id");
    expect(own.data).toHaveLength(1);
    const other = await agent2.from("order_views").select("id").eq("id", mine.data!.id);
    expect(other.data).toEqual([]);
    const adminSees = await admin.from("order_views").select("id").eq("id", mine.data!.id);
    expect(adminSees.data).toEqual([]);
    const steal = await agent2.from("order_views").update({ name: "x" }).eq("id", mine.data!.id).select("id");
    expect(steal.data ?? []).toEqual([]);
    const stealDel = await agent2.from("order_views").delete().eq("id", mine.data!.id).select("id");
    expect(stealDel.data ?? []).toEqual([]);
  });

  test("agent cannot insert, update or delete a shared view; cannot null owner_id", async () => {
    const ins = await agent.from("order_views").insert(view(null, "shared-by-agent"));
    expect(ins.error).not.toBeNull();
    const shared = await admin.from("order_views").insert(view(null, "team")).select("id").single();
    expect(shared.error).toBeNull();
    const upd = await agent.from("order_views").update({ name: "hack" }).eq("id", shared.data!.id).select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await agent.from("order_views").delete().eq("id", shared.data!.id).select("id");
    expect(del.data ?? []).toEqual([]);
    expect(await agent.from("order_views").select("id").eq("id", shared.data!.id)).toMatchObject({ data: [{ id: shared.data!.id }] });
    const mine = await agent.from("order_views").insert(view(ids.agent, "to-null")).select("id").single();
    const nul = await agent.from("order_views").update({ owner_id: null }).eq("id", mine.data!.id).select("id");
    expect(nul.error !== null || (nul.data ?? []).length === 0).toBe(true);
  });

  test("admin owner flip is refused both ways and workspace change is refused", async () => {
    const shared = await admin.from("order_views").insert(view(null, "flip-shared")).select("id").single();
    const own = await admin.from("order_views").insert(view(ids.admin, "flip-own")).select("id").single();
    const a = await admin.from("order_views").update({ owner_id: ids.admin }).eq("id", shared.data!.id).select("id");
    expect(a.error).not.toBeNull();
    const b = await admin.from("order_views").update({ owner_id: null }).eq("id", own.data!.id).select("id");
    expect(b.error).not.toBeNull();
    const c = await admin.from("order_views").update({ workspace_id: ws2 }).eq("id", shared.data!.id).select("id");
    expect(c.error).not.toBeNull();
  });

  test("admin sees shared + own only; other workspace sees nothing of ws", async () => {
    const rows = (await admin.from("order_views").select("owner_id")).data!;
    expect(rows.every((r) => r.owner_id === null || r.owner_id === ids.admin)).toBe(true);
    expect((await admin2.from("order_views").select("id").eq("workspace_id", ws)).data).toEqual([]);
    const x = await admin2.from("order_views").insert(view(null, "cross"));
    expect(x.error).not.toBeNull();
  });

  test("bad scope, layout, oversize config and blank name are rejected", async () => {
    const bad = [
      { scope: "nope" },
      { layout: "grid" },
      { config: { pad: "x".repeat(5000) } },
      { name: "   " },
      { name: "x".repeat(61) },
      { emoji: "x".repeat(17) },
    ];
    for (const over of bad) {
      const r = await admin.from("order_views").insert(view(ids.admin, `bad-${crypto.randomUUID().slice(0, 8)}`, over));
      expect(r.error, JSON.stringify(over).slice(0, 40)).not.toBeNull();
    }
    expect((await admin.from("order_views").insert(view(ids.admin, "dup"))).error).toBeNull();
    expect((await admin.from("order_views").insert(view(ids.admin, "DUP"))).error?.code).toBe("23505");
  });

  test("backfill: a workspace that existed before seeding has the seeds", async () => {
    const { data } = await svc.from("workspaces").select("id").not("id", "in", `(${ws},${ws2})`).limit(1);
    if (!data?.length) return; // fresh stack without a pre-existing workspace
    const r = await svc.from("order_views").select("seed_key").eq("workspace_id", data[0].id).not("seed_key", "is", null);
    expect((r.data ?? []).map((x) => x.seed_key).sort()).toEqual(["callbacks_due", "confirmed_today", "duplicates", "kanban_by_status", "new", "no_answer"]);
  });

  test("seed_order_views called twice as service role stays at 4 rows", async () => {
    for (let i = 0; i < 2; i++) expect((await svc.rpc("seed_order_views" as never, { ws: ws2 } as never)).error).toBeNull();
    const r = await svc.from("order_views").select("id").eq("workspace_id", ws2).not("seed_key", "is", null);
    expect(r.data).toHaveLength(4);
  });

  test("padded names, seed_key on personal rows and negative positions are refused", async () => {
    const bad = [{ name: "x" + " ".repeat(50) }, { name: " lead" }, { seed_key: "zzz" }, { position: -5 }];
    for (const over of bad) {
      const r = await agent.from("order_views").insert(view(ids.agent, `pad-${crypto.randomUUID().slice(0, 8)}`, over));
      expect(r.error, JSON.stringify(over)).not.toBeNull();
    }
  });

  test("the cap of 20 views per group holds at the database", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => view(ids.agent2, `cap-${i}`, { scope: "shipping", position: i }));
    expect((await agent2.from("order_views").insert(rows)).error).toBeNull();
    const over = await agent2.from("order_views").insert(view(ids.agent2, "cap-21", { scope: "shipping" }));
    expect(over.error?.message).toMatch(/limit/);
  });
});
