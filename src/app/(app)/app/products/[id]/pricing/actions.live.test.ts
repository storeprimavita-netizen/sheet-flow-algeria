import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

/**
 * Live (unmocked) saveProductPricing against the local stack: a real signed-in
 * workspace-1 admin session, a product id that belongs to workspace 2. Opt-in
 * via LOCAL_SUPABASE_URL like src/lib/rls.test.ts .
 */
const LOCAL_URL = process.env.LOCAL_SUPABASE_URL;
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const live = vi.hoisted(() => ({ client: null as unknown, workspaceId: "" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => live.client }));
vi.mock("@/lib/rbac", () => ({
  requireAdminProfile: async () => ({ workspaceId: live.workspaceId, role: "admin" }),
}));

import { deleteWorkspaces, deleteLeakedWorkspaces } from "@/lib/test-cleanup";
import { saveProductPricing } from "./actions";

describe.skipIf(!LOCAL_URL)("saveProductPricing (live)", () => {
  let admin: SupabaseClient;
  const wsIds: string[] = [];
  const userIds: string[] = [];
  let ws2ProductId: string;
  let ownProductId: string;
  const tag = `pl-${crypto.randomUUID()}`;

  beforeAll(async () => {
    const opts = { auth: { persistSession: false, autoRefreshToken: false } };
    admin = createClient(LOCAL_URL!, SERVICE_KEY, opts);
    await deleteLeakedWorkspaces(admin, "pl-");
    const mk = async (name: string) => (await admin.from("workspaces").insert({ name }).select("id").single()).data!.id as string;
    live.workspaceId = await mk(`${tag}-1`);
    const ws2 = await mk(`${tag}-2`);
    wsIds.push(live.workspaceId, ws2);
    const email = `${tag}@test.mnw`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password: "SeedDev!2026", email_confirm: true });
    if (cErr) throw new Error(cErr.message);
    userIds.push(created.user.id);
    const up = await admin.from("profiles").update({ workspace_id: live.workspaceId, role: "admin", is_active: true }).eq("user_id", created.user.id);
    if (up.error) throw new Error(up.error.message);
    const session = createClient(LOCAL_URL!, ANON_KEY, opts);
    const { error } = await session.auth.signInWithPassword({ email, password: "SeedDev!2026" });
    if (error) throw new Error(error.message);
    live.client = session;
    const prod = async (workspace: string, name: string) =>
      (await admin.from("products").insert({ workspace_id: workspace, name }).select("id").single()).data!.id as string;
    ownProductId = await prod(live.workspaceId, `${tag}-own`);
    ws2ProductId = await prod(ws2, `${tag}-ws2`);
  }, 30000);

  afterAll(async () => {
    if (!admin) return;
    await (live.client as SupabaseClient | null)?.auth.signOut({ scope: "local" });
    // only rows this suite created (its own two workspaces)
    await admin.from("product_pricing").delete().in("workspace_id", wsIds);
    await admin.from("products").delete().in("workspace_id", wsIds);
    await deleteWorkspaces(admin, wsIds);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  const input = (productId: string) => ({
    productId,
    overrides: {},
    adBestUsd: null,
    adMediumUsd: 2.2,
    adWorstUsd: null,
    finalPrice: null,
  });

  test("saveProductPricing refuses ws2 product", async () => {
    expect(await saveProductPricing(input(ws2ProductId))).toEqual({ ok: false, error: "notFound" });
    const { data } = await admin.from("product_pricing").select("product_id").eq("product_id", ws2ProductId);
    expect(data).toEqual([]);
  });

  test("saveProductPricing saves an own product", async () => {
    expect(await saveProductPricing(input(ownProductId))).toEqual({ ok: true });
    const { data } = await admin.from("product_pricing").select("product_id").eq("product_id", ownProductId);
    expect(data).toHaveLength(1);
  });
});
