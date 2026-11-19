import { beforeEach, describe, expect, test, vi } from "vitest";

let admin = true;
let dbError: { code: string } | null;
let writes: { table: string; op: string; row: Record<string, unknown> }[];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rbac", () => ({
  requireAdminProfile: async () => {
    if (!admin) throw new Error("Forbidden");
    return { workspaceId: "ws-1" };
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.order = () => q;
      q.limit = () => q;
      q.maybeSingle = async () => ({ data: { sort: 5 }, error: null });
      q.eq = () => q;
      q.then = (ok: (v: unknown) => unknown) => ok({ error: dbError });
      q.insert = (row: Record<string, unknown>) => (writes.push({ table, op: "insert", row }), q);
      q.update = (row: Record<string, unknown>) => (writes.push({ table, op: "update", row }), q);
      return q;
    },
  }),
}));

import { createSeason, renameSeason, savePeriod } from "./actions";

const SEASON = "11111111-1111-4111-8111-111111111111";
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("seasons actions", () => {
  beforeEach(() => {
    admin = true;
    dbError = null;
    writes = [];
  });

  test("a non-admin is refused and nothing is written", async () => {
    admin = false;
    expect(await createSeason(undefined, form({ name: "Black Friday" }))).toEqual({ error: "errForbidden" });
    expect(await renameSeason(undefined, form({ id: SEASON, name: "x" }))).toEqual({ error: "errForbidden" });
    expect(await savePeriod(undefined, form({ season_id: SEASON, date_from: "2026-01-01", date_to: "2026-01-02" }))).toEqual({ error: "errForbidden" });
    expect(writes).toEqual([]);
  });

  test("a period derives its year from the first day", async () => {
    const res = await savePeriod(undefined, form({ season_id: SEASON, date_from: "2025-12-20", date_to: "2026-01-10" }));
    expect(res).toEqual({ ok: true });
    expect(writes[0].row).toMatchObject({ workspace_id: "ws-1", season_id: SEASON, year: 2025 });
  });

  test("a second period for the same year is refused with a translated key (no throw)", async () => {
    dbError = { code: "23505" };
    expect(await savePeriod(undefined, form({ season_id: SEASON, date_from: "2026-02-18", date_to: "2026-03-19" }))).toEqual({ error: "errDuplicateYear" });
  });

  test("bad input returns an error key and writes nothing", async () => {
    expect(await savePeriod(undefined, form({ season_id: SEASON, date_from: "2026-03-19", date_to: "2026-02-18" }))).toEqual({ error: "errRange" });
    expect(await savePeriod(undefined, form({ season_id: SEASON, date_from: "2026-02-30", date_to: "2026-03-19" }))).toEqual({ error: "errDates" });
    expect(await savePeriod(undefined, form({ season_id: "nope", date_from: "2026-02-18", date_to: "2026-03-19" }))).toEqual({ error: "errDates" });
    expect(await createSeason(undefined, form({ name: "   " }))).toEqual({ error: "errName" });
    expect(writes).toEqual([]);
  });

  test("rename clears the translated key; a duplicate name is refused", async () => {
    await renameSeason(undefined, form({ id: SEASON, name: "Ramadan 2" }));
    expect(writes[0].row).toEqual({ name: "Ramadan 2", name_key: null });
    dbError = { code: "23505" };
    expect(await createSeason(undefined, form({ name: "Winter" }))).toEqual({ error: "errDuplicateName" });
  });
});
