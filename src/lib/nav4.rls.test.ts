import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { deleteLeakedWorkspaces, deleteWorkspaces } from "@/lib/test-cleanup";

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

/** Two workspaces, an admin and a confirmation agent in the first, an admin in the second. */
async function setup(prefix: string) {
  const svc = client(SERVICE_KEY);
  await deleteLeakedWorkspaces(svc, prefix);
  const users: string[] = [];
  const mk = async (workspace: string, role: "admin" | "confirmation_agent") => {
    const email = `${prefix}${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    const c = client(ANON_KEY);
    const s = await c.auth.signInWithPassword({ email, password: SEED_PASSWORD });
    if (s.error) throw s.error;
    return c;
  };
  const ws = (await svc.from("workspaces").insert({ name: `${prefix}${crypto.randomUUID()}` }).select("id").single()).data!.id as string;
  const ws2 = (await svc.from("workspaces").insert({ name: `${prefix}${crypto.randomUUID()}` }).select("id").single()).data!.id as string;
  return { svc, users, ws, ws2, admin: await mk(ws, "admin"), agent: await mk(ws, "confirmation_agent"), admin2: await mk(ws2, "admin") };
}

describe.skipIf(!URL)("options.emoji (live DB, 00073)", () => {
  let s: Awaited<ReturnType<typeof setup>>;
  let setId: string;
  beforeAll(async () => {
    s = await setup("emj-");
    psql(`select public.seed_workspace('${s.ws}');`);
    setId = (await s.svc.from("option_sets").select("id").eq("workspace_id", s.ws).eq("key", "order_tag").single()).data!.id;
  }, 30000);
  afterAll(async () => {
    if (!s) return;
    for (const t of ["options", "option_sets", "settings", "wilaya_fees"]) await s.svc.from(t).delete().in("workspace_id", [s.ws, s.ws2]);
    expect((await deleteWorkspaces(s.svc, [s.ws, s.ws2])).error).toBeNull();
    for (const id of s.users) await s.svc.auth.admin.deleteUser(id);
  });
  const row = (over: Record<string, unknown>) => ({ workspace_id: s.ws, set_id: setId, label: `o-${crypto.randomUUID()}`, ...over });

  test("agent may add an option but not with an emoji, and cannot update one", async () => {
    expect((await s.agent.from("options").insert(row({}))).error).toBeNull();
    expect((await s.agent.from("options").insert(row({ emoji: "🔥" }))).error).not.toBeNull();
    const mine = (await s.admin.from("options").insert(row({ emoji: "🔥" })).select("id").single()).data!.id as string;
    await s.agent.from("options").update({ emoji: "💧" }).eq("id", mine);
    expect((await s.admin.from("options").select("emoji").eq("id", mine).single()).data!.emoji).toBe("🔥");
  });

  test("admin sets and clears an emoji", async () => {
    const id = (await s.admin.from("options").insert(row({})).select("id").single()).data!.id as string;
    expect((await s.admin.from("options").update({ emoji: "👗" }).eq("id", id)).error).toBeNull();
    expect((await s.admin.from("options").select("emoji").eq("id", id).single()).data!.emoji).toBe("👗");
    expect((await s.admin.from("options").update({ emoji: null }).eq("id", id)).error).toBeNull();
  });

  test("bidi, control and over-long emoji are rejected even for admin", async () => {
    const id = (await s.admin.from("options").insert(row({})).select("id").single()).data!.id as string;
    for (const bad of ["‮🔥", "🔥​", "a\u0007", "⁦x", "x".repeat(17), ""]) {
      expect((await s.admin.from("options").update({ emoji: bad }).eq("id", id)).error, JSON.stringify(bad)).not.toBeNull();
    }
  });
});

describe.skipIf(!URL)("status_label_overrides (live DB, 00073)", () => {
  let s: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    s = await setup("slo-");
  }, 30000);
  afterAll(async () => {
    if (!s) return;
    expect((await deleteWorkspaces(s.svc, [s.ws, s.ws2])).error).toBeNull();
    for (const id of s.users) await s.svc.auth.admin.deleteUser(id);
  });
  const upsert = (c: SupabaseClient, ws: string, over: Record<string, unknown> = {}) =>
    c.from("status_label_overrides").upsert(
      { workspace_id: ws, kind: "confirmation", status_key: "confirmed", label_en: "OK", ...over },
      { onConflict: "workspace_id,kind,status_key" },
    );

  test("admin writes; agent reads own workspace only and cannot write; other workspace sees nothing", async () => {
    expect((await upsert(s.admin, s.ws)).error).toBeNull();
    expect((await upsert(s.admin2, s.ws2, { label_en: "Other" })).error).toBeNull();
    const seen = (await s.agent.from("status_label_overrides").select("workspace_id,label_en")).data!;
    expect(seen).toEqual([{ workspace_id: s.ws, label_en: "OK" }]);
    expect((await upsert(s.agent, s.ws, { label_en: "Hack" })).error).not.toBeNull();
    expect((await s.agent.from("status_label_overrides").update({ label_en: "Hack" }).eq("workspace_id", s.ws)).data ?? []).toEqual([]);
    await s.agent.from("status_label_overrides").delete().eq("workspace_id", s.ws);
    expect((await s.admin.from("status_label_overrides").select("label_en").eq("workspace_id", s.ws)).data).toEqual([{ label_en: "OK" }]);
    expect((await upsert(s.admin, s.ws2)).error).not.toBeNull(); // cross-workspace write
  });

  test("bad kind, key, empty and forbidden-char labels are rejected for admin", async () => {
    for (const over of [
      { kind: "nope" }, { status_key: "Bad Key" }, { status_key: "x".repeat(41) }, { status_key: "__proto__x1" },
      { label_en: null, label_ar: null }, { label_en: "   ", label_ar: null }, { label_en: "x".repeat(41) },
      { label_en: "a‮b" }, { label_ar: "a​b", label_en: null }, { label_en: "a\nb" },
    ]) {
      expect((await upsert(s.admin, s.ws, over)).error, JSON.stringify(over)).not.toBeNull();
    }
  });

  test("grants: anon none, no TRUNCATE/TRIGGER/REFERENCES for authenticated", () => {
    const g = psql(
      `select grantee||':'||privilege_type from information_schema.role_table_grants where table_name='status_label_overrides' and grantee in ('anon','authenticated') order by 1;`,
    ).trim().split("\n");
    expect(g.filter((x) => x.startsWith("anon:"))).toEqual([]);
    expect(g.filter((x) => /TRUNCATE|TRIGGER|REFERENCES/.test(x))).toEqual([]);
  });

  test("audit rows on upsert and delete", async () => {
    expect((await upsert(s.admin, s.ws, { status_key: "pending", label_en: "Wait" })).error).toBeNull();
    expect((await upsert(s.admin, s.ws, { status_key: "pending", label_en: "Wait2" })).error).toBeNull();
    expect((await s.admin.from("status_label_overrides").delete().eq("status_key", "pending")).error).toBeNull();
    const n = psql(`select string_agg(action, ',' order by created_at) from public.audit_log where table_name='status_label_overrides' and workspace_id='${s.ws}';`);
    expect(n).toContain("INSERT");
    expect(n).toContain("UPDATE");
    expect(n).toContain("DELETE");
  });
});
