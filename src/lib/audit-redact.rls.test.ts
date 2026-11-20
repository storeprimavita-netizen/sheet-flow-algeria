import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { auditRedact } from "./audit-redact";
import { PARITY_CASES, MASKED_NAMES } from "./audit-redact.cases";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { deleteWorkspaces } from "./test-cleanup";
import { DB_CONTAINER, dbContainerUp } from "./test-db";

/** Live SEC-1: a secret written to integration_configs never reaches audit_log. */
const URL = process.env.LOCAL_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SEED_PASSWORD = "SeedDev!2026";
const SECRET = "whsec_TESTSEED" + crypto.randomUUID();

const client = (key: string) => createClient(URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!dbContainerUp)("audit_log redaction (live DB)", () => {
  let svc: SupabaseClient;
  let admin: SupabaseClient;
  let ws: string;
  let userId: string;
  let agent: SupabaseClient;
  let agentId: string;

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    ws = (await svc.from("workspaces").insert({ name: `sec1-${crypto.randomUUID()}` }).select("id").single()).data!.id;
    const email = `sec1-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
    await svc.from("profiles").update({ workspace_id: ws, role: "admin", is_active: true }).eq("user_id", userId);
    admin = client(ANON_KEY);
    const si = await admin.auth.signInWithPassword({ email, password: SEED_PASSWORD });
    if (si.error) throw si.error;
    const agentEmail = `sec1-agent-${crypto.randomUUID()}@test.mnw`;
    const ag = await svc.auth.admin.createUser({ email: agentEmail, password: SEED_PASSWORD, email_confirm: true });
    if (ag.error) throw ag.error;
    agentId = ag.data.user.id;
    await svc.from("profiles").update({ workspace_id: ws, role: "confirmation_agent", is_active: true }).eq("user_id", agentId);
    agent = client(ANON_KEY);
    const sa = await agent.auth.signInWithPassword({ email: agentEmail, password: SEED_PASSWORD });
    if (sa.error) throw sa.error;
  });
  afterAll(async () => {
    if (!svc) return;
    const steps = [
      await svc.from("integration_configs").delete().eq("workspace_id", ws),
      await svc.from("settings").delete().eq("workspace_id", ws),
      await svc.from("audit_log").delete().eq("workspace_id", ws),
    ];
    steps.forEach((r) => { if (r.error) throw r.error; });
    // Deleting audited children fires the audit trigger again; clear audit rows after the last audited delete.
    const w = await deleteWorkspaces(svc, [ws]);
    if (w.error) throw w.error;
    await svc.from("audit_log").delete().eq("workspace_id", ws);
    const u = await svc.auth.admin.deleteUser(userId);
    if (u.error) throw u.error;
    const ua = await svc.auth.admin.deleteUser(agentId);
    if (ua.error) throw ua.error;
  });

  test("secret is redacted in audit_log but intact in the table", async () => {
    const ins = await admin.from("integration_configs").insert({ workspace_id: ws, provider: "shopify", secret: "whsec_first" + SECRET });
    expect(ins.error).toBeNull();
    const up = await admin.from("integration_configs").update({ secret: SECRET }).eq("workspace_id", ws).eq("provider", "shopify");
    expect(up.error).toBeNull();

    const { data: logs } = await svc.from("audit_log").select("*").eq("workspace_id", ws).eq("table_name", "integration_configs").order("id", { ascending: false });
    expect(logs!.length).toBeGreaterThanOrEqual(2);
    const dump = JSON.stringify(logs);
    expect(dump).not.toContain("whsec_TESTSEED");
    expect(dump).toContain("[redacted:");
    const newest = logs![0];
    expect((newest.old_row as { secret: string }).secret).not.toBe((newest.new_row as { secret: string }).secret);

    // SQL/TS parity and non-string masking through the live function.
    const { data: fx } = await svc.rpc("audit_redact", { j: { secret: "abc", color_token: "rose", tokens: { a: "zz" } } });
    expect(fx).toMatchObject({ secret: "[redacted:ba7816bf]", color_token: "rose" });
    expect(JSON.stringify(fx)).not.toContain("zz");

    const { data: cfg } = await svc.from("integration_configs").select("secret").eq("workspace_id", ws).single();
    expect(cfg!.secret).toBe(SECRET);
  });

  test("key normalisation through the live function", async () => {
    const names = ["secret_token", "meta_access_token", "capi_token", "telegram_bot_token", "zr_api_key", "x-api-key", "apiSecret", "accessToken", "clientSecret", "credentials"];
    const j = Object.fromEntries(names.map((n) => [n, "PLAIN_" + n]));
    const { data } = await svc.rpc("audit_redact", { j: { ...j, color_token: "rose", tracking_token_id: "t1" } });
    expect(JSON.stringify(data)).not.toContain("PLAIN_");
    expect(data).toMatchObject({ color_token: "rose", tracking_token_id: "t1" });
    const { data: kv } = await svc.rpc("audit_redact", { j: { key: "telegram_bot_token", value: "1:AAxyz" } });
    expect(JSON.stringify(kv)).not.toContain("1:AAxyz");
  });

  test("D49 fail-closed names and allow-list through the live function", async () => {
    const names = ["secret_key", "client_key", "webhook_key", "XApiKey", "telegram.token", "passphrase"];
    const j = Object.fromEntries(names.map((n) => [n, "PLAIN_" + n]));
    const { data } = await svc.rpc("audit_redact", { j: { ...j, idempotency_key: "i1", sort_key: 2, cache_key: "c", color_token: "rose" } });
    expect(JSON.stringify(data)).not.toContain("PLAIN_");
    expect(data).toMatchObject({ idempotency_key: "i1", sort_key: 2, cache_key: "c", color_token: "rose" });
    const { data: kv } = await svc.rpc("audit_redact", { j: { key: "telegram.token", value: "S1" } });
    expect(JSON.stringify(kv)).not.toContain("S1");
  });

  test("settings row with a multi-word token name is masked in audit_log", async () => {
    await admin.from("settings").insert({ workspace_id: ws, key: "meta_access_token", value: "EAAB_LIVE_SECRET" });
    const { data: logs } = await svc.from("audit_log").select("*").eq("workspace_id", ws).eq("table_name", "settings");
    expect(logs!.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain("EAAB_LIVE_SECRET");
  });

  test("SQL and TS redaction agree on the shared case table", async () => {
    for (const j of PARITY_CASES) {
      const { data, error } = await svc.rpc("audit_redact", { j });
      expect(error).toBeNull();
      expect(data).toEqual(auditRedact(j));
    }
    const names = Object.fromEntries(MASKED_NAMES.map((n) => [n, "PLAIN_" + n]));
    const { data } = await svc.rpc("audit_redact", { j: names });
    expect(JSON.stringify(data)).not.toContain("PLAIN_");
  });

  test("parity cases: idempotent in SQL, and TS(SQL(x)) == SQL(x)", async () => {
    for (const j of PARITY_CASES) {
      const { data, error } = await svc.rpc("audit_redact", { j });
      const again = await svc.rpc("audit_redact", { j: data });
      expect(error).toBeNull();
      expect(again.error).toBeNull();
      expect(again.data).toEqual(data);
      expect(auditRedact(data)).toEqual(data);
    }
  });

  test("agent and anon sessions cannot execute the redactors (42501)", async () => {
    const anon = client(ANON_KEY);
    for (const c of [admin, agent, anon]) {
      const a = await c.rpc("audit_redact", { j: { secret: "x" }, depth: 0 });
      expect(a.error?.code).toBe("42501");
      const b = await c.rpc("audit_is_secret_key", { k: "secret" });
      expect(b.error?.code).toBe("42501");
    }
  });

  test("ZR save path leaves no trace; old_row masked on UPDATE and DELETE", async () => {
    const ins = await admin.from("integration_configs").insert({ workspace_id: ws, provider: "zrexpress", config: { tenant_id: "t1", api_key: "ZRKEY_LIVE" }, secret: "ZRSEC_1" });
    expect(ins.error).toBeNull();
    const up = await admin.from("integration_configs").update({ secret: "ZRSEC_2", config: { tenant_id: "t1", api_key: "ZRKEY_LIVE2" } }).eq("workspace_id", ws).eq("provider", "zrexpress");
    expect(up.error).toBeNull();
    const del = await admin.from("integration_configs").delete().eq("workspace_id", ws).eq("provider", "zrexpress");
    expect(del.error).toBeNull();
    const { data: logs } = await svc.from("audit_log").select("*").eq("workspace_id", ws).eq("table_name", "integration_configs");
    const dump = JSON.stringify(logs);
    expect(dump).not.toMatch(/ZRKEY_LIVE|ZRSEC_/);
    const del_row = logs!.find((l) => l.action === "DELETE" && (l.old_row as { provider?: string })?.provider === "zrexpress");
    expect(del_row).toBeDefined();
  });

  test("1-arg audit_redact(j) is not executable by agent or anon (42501)", async () => {
    for (const c of [agent, client(ANON_KEY)]) {
      const r = await c.rpc("audit_redact", { j: { secret: "x" } });
      expect(r.error?.code).toBe("42501");
    }
  });

  test.skipIf(!dbContainerUp)("00071 backfill UPDATE scrubs raw rows, leaves clean rows untouched (xmin), rolls back", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/00071_audit_redact_idempotent.sql"), "utf8");
    const update = sql.slice(sql.indexOf("update public.audit_log a"));
    expect(update).toContain("is distinct from");
    return (async () => {
      const mk = (n: string) => ({ workspace_id: ws, table_name: "x_backfill", row_id: crypto.randomUUID(), action: "INSERT" });
      const raw = await svc.from("audit_log").insert({ ...mk("a"), old_row: { XAPIKey: "RAW_a", "api/key": "RAW_slash", secretkeys: "RAW_plural" }, new_row: null }).select("id").single();
      const clean = await svc.from("audit_log").insert({ ...mk("b"), new_row: { name: "b" } }).select("id").single();
      expect(raw.error).toBeNull();
      expect(clean.error).toBeNull();
      const ids = [raw.data!.id, clean.data!.id];
      try {
        const psql = (script: string) =>
          execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: script, encoding: "utf8" });
        const probe = `select id || '|' || xmin::text || '|' || coalesce(old_row::text,'') || '|' || coalesce(new_row::text,'') from public.audit_log where id in (${ids.join(",")}) order by id;`;
        const parse = (o: string) => new Map(o.trim().split("\n").filter((l) => /^\d+\|/.test(l)).map((l) => { const [id, xmin, o2, n] = l.split("|"); return [Number(id), { xmin, o2, n }] as const; }));
        const before = parse(psql(probe));
        const out = parse(psql(`begin;\nset lock_timeout='5s';\n${update}\n${probe}\nrollback;`));
        const rawAfter = out.get(raw.data!.id)!;
        expect(rawAfter.o2).not.toMatch(/RAW_a|RAW_slash|RAW_plural/);
        expect(rawAfter.o2).toContain("[redacted:");
        expect(out.get(clean.data!.id)!.xmin).toBe(before.get(clean.data!.id)!.xmin);
        // rolled back: the raw row is still raw outside the transaction.
        expect(parse(psql(probe)).get(raw.data!.id)!.o2).toContain("RAW_a");
      } finally {
        const cleanup = await svc.from("audit_log").delete().in("id", ids);
        expect(cleanup.error).toBeNull();
      }
    })();
  }, 120_000);
});
