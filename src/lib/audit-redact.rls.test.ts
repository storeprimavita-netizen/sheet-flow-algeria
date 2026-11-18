import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { auditRedact } from "./audit-redact";
import { PARITY_CASES, MASKED_NAMES } from "./audit-redact.cases";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

/** Live SEC-1: a secret written to integration_configs never reaches audit_log. */
const URL = process.env.LOCAL_SUPABASE_URL;
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SEED_PASSWORD = "SeedDev!2026";
const SECRET = "whsec_TESTSEED" + crypto.randomUUID();

const client = (key: string) => createClient(URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!URL)("audit_log redaction (live DB)", () => {
  let svc: SupabaseClient;
  let admin: SupabaseClient;
  let ws: string;
  let userId: string;

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
    const w = await svc.from("workspaces").delete().eq("id", ws);
    if (w.error) throw w.error;
    await svc.from("audit_log").delete().eq("workspace_id", ws);
    const u = await svc.auth.admin.deleteUser(userId);
    if (u.error) throw u.error;
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

  test("agent session cannot execute audit_redact", async () => {
    const { error } = await admin.rpc("audit_redact", { j: { secret: "x" } });
    expect(error).not.toBeNull();
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

  test("backfill UPDATE scrubs raw rows and leaves clean rows untouched", async () => {
    const mk = (n: string) => ({ workspace_id: ws, table_name: "x_backfill", row_id: crypto.randomUUID(), action: "INSERT", new_row: { name: n, XAPIKey: "RAW_" + n } });
    const raw = await svc.from("audit_log").insert(mk("a")).select("id").single();
    expect(raw.error).toBeNull();
    const clean = await svc.from("audit_log").insert({ ...mk("b"), new_row: { name: "b" } }).select("id, new_row").single();
    expect(clean.error).toBeNull();
    const ids = [raw.data!.id, clean.data!.id];
    // Same rule as the backfill in 00036/00037 (rewrite only rows that change), limited to this test's rows.
    const { data: rows } = await svc.from("audit_log").select("id, old_row, new_row").in("id", ids);
    for (const r of rows!) {
      const { data: nr } = await svc.rpc("audit_redact", { j: r.new_row });
      if (JSON.stringify(nr) !== JSON.stringify(r.new_row)) {
        const up = await svc.from("audit_log").update({ new_row: nr }).eq("id", r.id);
        expect(up.error).toBeNull();
      }
    }
    const { data: after } = await svc.from("audit_log").select("id, new_row").in("id", ids);
    const byId = new Map(after!.map((r) => [r.id, r.new_row]));
    expect(JSON.stringify(byId.get(raw.data!.id))).not.toContain("RAW_");
    expect(byId.get(raw.data!.id)).toMatchObject({ name: "a" });
    expect(byId.get(clean.data!.id)).toEqual({ name: "b" });
    const cleanup = await svc.from("audit_log").delete().in("id", ids);
    expect(cleanup.error).toBeNull();
  });
});
