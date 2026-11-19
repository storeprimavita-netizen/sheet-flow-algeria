import { beforeEach, describe, expect, test, vi } from "vitest";

type Result = { data: unknown; error: { code?: string } | null; count?: number };
let role = "admin";
let updateResult: Result;
let insertResult: Result;
let countResult: Result;
const inserted: unknown[] = [];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ getProfile: async () => ({ role, workspaceId: "ws-1" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "order", "limit"]) q[m] = () => q;
      q.then = (res: (v: Result) => unknown) => res(countResult);
      q.update = () => ({ eq: () => ({ select: async () => updateResult }) });
      q.delete = () => ({ eq: () => ({ select: async () => updateResult }) });
      q.insert = (row: unknown) => {
        inserted.push(row);
        return { select: async () => insertResult };
      };
      return q;
    },
  }),
}));

import { createView, deleteView, renameView, saveView } from "./views-actions";

const ID = "11111111-1111-4111-8111-111111111111";
const input = (over: Record<string, unknown> = {}) => ({ name: "Mine", scope: "all", shared: false, config: { duplicates: "1", junk: 1 }, ...over });

beforeEach(() => {
  role = "admin";
  inserted.length = 0;
  countResult = { data: [], error: null, count: 0 };
  insertResult = { data: [{ id: ID }], error: null };
  updateResult = { data: [{ id: ID }], error: null };
});

describe("view actions", () => {
  test("create stores owner/workspace server-side and a sanitized config", async () => {
    expect(await createView(input())).toEqual({ ok: true, id: ID });
    expect(inserted[0]).toMatchObject({ workspace_id: "ws-1", owner_id: "u1", config: { duplicates: "1" } });
  });
  test("agent cannot create a shared view", async () => {
    role = "confirmation_agent";
    expect(await createView(input({ shared: true }))).toEqual({ ok: false, error: "forbidden" });
    expect(inserted).toHaveLength(0);
  });
  test("duplicate name maps to its message", async () => {
    insertResult = { data: null, error: { code: "23505" } };
    expect(await createView(input())).toEqual({ ok: false, error: "duplicateName" });
  });
  test("cap of 20 per group", async () => {
    countResult = { data: [{ position: 19 }], error: null, count: 20 };
    expect(await createView(input())).toEqual({ ok: false, error: "capReached" });
  });
  test("oversize name and emoji are rejected before the database", async () => {
    expect(await createView(input({ name: "x".repeat(61) }))).toEqual({ ok: false, error: "invalid" });
    expect(await createView(input({ emoji: "abc" }))).toEqual({ ok: false, error: "invalid" });
  });
  test("a 0-row update or delete (RLS) is reported, not success", async () => {
    updateResult = { data: [], error: null };
    expect(await saveView(ID, {})).toEqual({ ok: false, error: "notFound" });
    expect(await renameView(ID, { name: "x" })).toEqual({ ok: false, error: "notFound" });
    expect(await deleteView(ID)).toEqual({ ok: false, error: "notFound" });
  });
  test("non-uuid ids are invalid", async () => {
    expect(await deleteView("nope")).toEqual({ ok: false, error: "invalid" });
  });
});
