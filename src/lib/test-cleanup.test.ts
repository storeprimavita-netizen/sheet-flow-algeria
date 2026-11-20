import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, test } from "vitest";

import { AUDITED_WORKSPACE_TABLES, deleteWorkspaces } from "@/lib/test-cleanup";

/** Live: the shared workspace teardown covers every audited table and leaves other workspaces alone. */
const URL = process.env.LOCAL_SUPABASE_URL;
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const psql = (sql: string) =>
  execFileSync("docker", ["exec", "-i", "supabase_db_mnw-erp", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

describe.skipIf(!URL)("test-cleanup (live)", () => {
  const svc = createClient(URL ?? "http://localhost", SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const made: string[] = [];
  const mk = async () => {
    const id = (await svc.from("workspaces").insert({ name: `tc-${Math.random().toString(36).slice(2, 8)}` }).select("id").single()).data!.id as string;
    made.push(id);
    return id;
  };
  afterAll(async () => {
    if (made.length) await deleteWorkspaces(svc, made);
  });

  test("the helper lists every table that has an audit_row() trigger", () => {
    const out = psql(
      `select c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid
       where p.proname = 'audit_row' and not t.tgisinternal and c.relnamespace = 'public'::regnamespace order by 1`,
    );
    const audited = out.split("\n").map((s) => s.trim()).filter(Boolean);
    expect([...AUDITED_WORKSPACE_TABLES].sort()).toEqual(audited);
  });

  test("deletes a seeded workspace without error and leaves a concurrent one untouched", async () => {
    const a = await mk();
    const b = await mk();
    psql(`select public.seed_workspace('${a}'); select public.seed_workspace('${b}');`);
    const count = async (ws: string) => (await svc.from("seasons").select("id", { count: "exact", head: true }).eq("workspace_id", ws)).count;
    expect(await count(a)).toBeGreaterThan(0);
    const before = await count(b);
    expect((await deleteWorkspaces(svc, [a])).error).toBeNull();
    expect(await count(a)).toBe(0);
    expect(await count(b)).toBe(before);
  });
});
