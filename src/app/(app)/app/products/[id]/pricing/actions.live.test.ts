import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

/**
 * Live (unmocked) saveProductPricing against the local stack: a real signed-in
 * workspace-1 admin session, a product id that belongs to workspace 2. Opt-in
 * via LOCAL_SUPABASE_URL like src/lib/rls.test.ts (which creates the ws2 fixtures).
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

import { saveProductPricing } from "./actions";

describe.skipIf(!LOCAL_URL)("saveProductPricing (live)", () => {
  let admin: SupabaseClient;
  let ws2ProductId: string;
  let ownProductId: string;

  beforeAll(async () => {
    const opts = { auth: { persistSession: false, autoRefreshToken: false } };
    admin = createClient(LOCAL_URL!, SERVICE_KEY, opts);
    const session = createClient(LOCAL_URL!, ANON_KEY, opts);
    const { error } = await session.auth.signInWithPassword({ email: "admin@seed.mnw", password: "SeedDev!2026" });
    if (error) throw new Error(error.message);
    live.client = session;
    const { data: u } = await session.auth.getUser();
    const { data: profile } = await admin.from("profiles").select("workspace_id").eq("user_id", u.user!.id).single();
    live.workspaceId = profile!.workspace_id!;
    const { data: own } = await admin.from("products").select("id").eq("workspace_id", live.workspaceId).limit(1).single();
    ownProductId = own!.id;
    const { data: ws2 } = await admin.from("workspaces").select("id").eq("name", "RLS Test WS2").maybeSingle();
    if (!ws2) throw new Error("run src/lib/rls.test.ts first (creates the ws2 fixtures)");
    let { data: p } = await admin.from("products").select("id").eq("workspace_id", ws2.id).eq("name", "WS2-only product").maybeSingle();
    if (!p) ({ data: p } = await admin.from("products").insert({ workspace_id: ws2.id, name: "WS2-only product" }).select("id").single());
    ws2ProductId = p!.id;
  });

  afterAll(async () => {
    await admin.from("product_pricing").delete().eq("product_id", ws2ProductId);
    await (live.client as SupabaseClient).auth.signOut({ scope: "local" });
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
    const { data: before } = await admin.from("product_pricing").select("*").eq("product_id", ownProductId).maybeSingle();
    expect(await saveProductPricing(input(ownProductId))).toEqual({ ok: true });
    if (before) await admin.from("product_pricing").upsert(before, { onConflict: "product_id" });
    else await admin.from("product_pricing").delete().eq("product_id", ownProductId);
  });
});
