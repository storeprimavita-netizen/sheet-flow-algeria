import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { PAGE_SIZE, fetchAll, lastPage, readPage } from "@/lib/list-pagination";
import type { Database } from "@/lib/supabase/database.types";
import { deleteLeakedWorkspaces, deleteWorkspaces } from "@/lib/test-cleanup";

const url = process.env.LOCAL_SUPABASE_URL;
// Published local Supabase demo credentials.
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const prefix = "list-pagination-test-";
const password = crypto.randomUUID();
const client = (key: string) => createClient<Database>(url!, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
type Client = ReturnType<typeof client>;

describe.skipIf(!url)("paged money lists (live)", () => {
  let service: Client;
  let admin: Client;
  let agent: Client;
  let otherAdmin: Client;
  let workspace: string;
  const workspaces: string[] = [];
  const users: string[] = [];
  const total = PAGE_SIZE * 2 + 3;

  async function makeWorkspace() {
    const { data, error } = await service.from("workspaces")
      .insert({ name: `${prefix}${crypto.randomUUID()}` }).select("id").single();
    expect(error).toBeNull();
    workspaces.push(data!.id);
    return data!.id;
  }

  async function member(workspaceId: string, role: "admin" | "confirmation_agent") {
    const email = `${prefix}${crypto.randomUUID()}@test.mnw`;
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const id = created.data.user!.id;
    users.push(id);
    const { error } = await service.from("profiles").update({ workspace_id: workspaceId, role, is_active: true }).eq("user_id", id);
    expect(error).toBeNull();
    const session = client(anonKey);
    expect((await session.auth.signInWithPassword({ email, password })).error).toBeNull();
    return session;
  }

  // Same shape as the courier cash "uncollected" read.
  const uncollected = (session: Client, page: number) =>
    readPage(page, (from, to) =>
      session.from("orders")
        .select("id, cash:cash_collections(id)", { count: "exact" })
        .eq("delivery_status", "delivered")
        .is("cash", null)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to));

  beforeAll(async () => {
    service = client(serviceKey);
    await deleteLeakedWorkspaces(service, prefix);
    workspace = await makeWorkspace();
    const otherWorkspace = await makeWorkspace();
    admin = await member(workspace, "admin");
    agent = await member(workspace, "confirmation_agent");
    otherAdmin = await member(otherWorkspace, "admin");

    const rows = Array.from({ length: total }, (_, i) => i);
    expect((await service.from("expenses").insert(rows.map(() => (
      { workspace_id: workspace, category: "other" as const, amount: 10, spent_on: "2026-06-01" }
    )))).error).toBeNull();
    expect((await service.from("contacts").insert({ workspace_id: workspace, name: "Supplier", type: "other" })).error).toBeNull();
    const product = await service.from("products").insert({ workspace_id: workspace, name: "Product" }).select("id").single();
    expect(product.error).toBeNull();
    expect((await service.from("ad_spend_daily").insert(
      { workspace_id: workspace, product_id: product.data!.id, amount: 5, spent_on: "2026-06-01" },
    )).error).toBeNull();
    const orders = await service.from("orders").insert(rows.map(() => (
      { workspace_id: workspace, customer_name: "Test", customer_phone: "0555000000", sale_price: 1000, delivery_status: "delivered" as const }
    ))).select("id");
    expect(orders.error).toBeNull();
    // Collect every other order, so collected rows are spread over all pages.
    expect((await service.from("cash_collections").insert(
      orders.data!.filter((_, i) => i % 2 === 0).map((o) => ({ workspace_id: workspace, order_id: o.id, amount_dzd: 1000 })),
    )).error).toBeNull();
  }, 60000);

  afterAll(async () => {
    if (!service) return;
    if (workspaces.length) expect((await deleteWorkspaces(service, workspaces)).error).toBeNull();
    for (const id of users) expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
  }, 60000);

  test("pages of equal-date expenses neither repeat nor skip a row", async () => {
    const read = (page: number) =>
      readPage(page, (from, to) =>
        admin.from("expenses").select("id", { count: "exact" })
          .order("spent_on", { ascending: false }).order("id").range(from, to));
    const ids: string[] = [];
    for (let page = 1; page <= lastPage(total); page++) {
      const result = await read(page);
      expect(result.total).toBe(total);
      ids.push(...result.rows.map((r) => r.id));
    }
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
    // Past the end the API errors; the helper turns that into the last page.
    expect((await read(99)).goTo).toBe(lastPage(total));
  });

  test("a collected order is absent from every uncollected page", async () => {
    const collected = await fetchAll((from, to) =>
      admin.from("cash_collections").select("order_id").order("id").range(from, to));
    const first = await uncollected(admin, 1);
    const ids = first.rows.map((r) => r.id);
    for (let page = 2; page <= lastPage(first.total); page++) {
      ids.push(...(await uncollected(admin, page)).rows.map((r) => r.id));
    }
    expect(first.total).toBe(total - collected.length);
    expect(ids).toHaveLength(first.total);
    expect(collected.filter((c) => ids.includes(c.order_id!))).toEqual([]);
  });

  test("an agent and another workspace get no suppliers, expenses, ad spend or cash rows", async () => {
    for (const session of [agent, otherAdmin]) {
      for (const table of ["contacts", "expenses", "ad_spend_daily", "cash_collections"] as const) {
        const { data, error } = await session.from(table).select("id").eq("workspace_id", workspace);
        expect(error).toBeNull();
        expect(data).toEqual([]);
      }
    }
    expect((await uncollected(otherAdmin, 1)).total).toBe(0);
  });
});
