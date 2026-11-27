import { beforeEach, describe, expect, test, vi } from "vitest";

let admin = true;
let rpcError: { message: string } | null = null;
let calls: { fn: string; args: Record<string, unknown> }[] = [];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/lib/rbac", () => ({
  requireAdminProfile: async () => {
    if (!admin) throw new Error("Forbidden");
    return { role: "admin", workspaceId: "ws-1" };
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = q.eq = () => q;
      q.in = async () => ({ data: [{ id: "id-zr", kind: "zr" }, { id: "id-dzd", kind: "dzd" }, { id: "id-usdt", kind: "usdt" }] });
      return q;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: null, error: rpcError };
    },
  }),
}));

import { markPayoutTaken, postLegacy, remapLegacy, reverseEntry, saveAccount, saveEntry, transferFunds } from "./actions";

const ID = "11111111-1111-4111-8111-111111111111";
const KEY = "22222222-2222-4222-8222-222222222222";
const day = "2026-06-01";
const entry = { account_id: ID, occurred_on: day, direction: "in" as const, amount: 12.5, request_key: KEY };
const transfer = { from: "dzd" as const, occurred_on: day, amount_out: 480, amount_in: 2, rate: 240, request_key: KEY };
const payout = { occurred_on: day, amount: 250, request_key: KEY };
const reverse = { entry_id: ID, occurred_on: day, request_key: KEY };
const remap = { legacy_account_id: ID, expected_mapping_id: KEY, kind: "dzd" as const, conversions: {} };

describe("account actions", () => {
  beforeEach(() => {
    admin = true;
    rpcError = null;
    calls = [];
  });

  test("agent is refused by every action", async () => {
    admin = false;
    for (const run of [
      () => saveAccount(new FormData()), () => saveEntry(entry), () => transferFunds(transfer),
      () => markPayoutTaken(payout), () => reverseEntry(reverse), () => postLegacy({ mappings: {} }),
      () => remapLegacy(remap),
    ]) await expect(run()).rejects.toThrow("Forbidden");
    expect(calls).toEqual([]);
  });

  test("invalid input never calls the RPC", async () => {
    const invalid = { ok: false, error: "invalidInput" };
    expect(await saveEntry({ ...entry, amount: -1 })).toEqual(invalid);
    expect(await saveEntry({ ...entry, request_key: "x" })).toEqual(invalid);
    expect(await transferFunds({ ...transfer, rate: 241 })).toEqual(invalid);
    expect(await markPayoutTaken({ ...payout, amount: 0 })).toEqual(invalid);
    expect(await reverseEntry({ ...reverse, occurred_on: "soon" })).toEqual(invalid);
    expect(await postLegacy({ mappings: { [ID]: { kind: "dzd", conversions: { [`opening:${ID}`]: { amount: 1, evidence: " " } } } } })).toEqual(invalid);
    expect(await remapLegacy({ ...remap, expected_mapping_id: "" })).toEqual(invalid);
    expect(calls).toEqual([]);
  });

  test("same request key is passed on retry", async () => {
    rpcError = { message: "network" };
    expect(await saveEntry(entry)).toEqual({ ok: false, error: "entryFailed" });
    rpcError = null;
    expect(await saveEntry(entry)).toEqual({ ok: true });
    expect(calls.map((c) => c.args.p_request_key)).toEqual([KEY, KEY]);
    expect(calls[0]).toEqual(calls[1]);
  });

  test("payout is ZR to DZD, equal amounts, no rate", async () => {
    expect(await markPayoutTaken(payout)).toEqual({ ok: true });
    expect(calls).toEqual([{ fn: "transfer_account_funds", args: expect.objectContaining({
      p_from_account_id: "id-zr", p_to_account_id: "id-dzd", p_amount_out: 250, p_amount_in: 250,
    }) }]);
    expect(calls[0].args).not.toHaveProperty("p_rate_dzd");
  });

  test("a stale mapping asks to reload", async () => {
    rpcError = { message: "Choose a different destination using the current legacy mapping" };
    expect(await remapLegacy(remap)).toEqual({ ok: false, error: "staleMapping" });
  });
});
