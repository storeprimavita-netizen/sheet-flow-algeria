import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
    await svc.from("integration_configs").delete().eq("workspace_id", ws);
    await svc.from("workspaces").delete().eq("id", ws);
    await svc.auth.admin.deleteUser(userId);
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
});
