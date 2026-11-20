import { describe, expect, it } from "vitest";

import { zrSendState } from "./zr-sendable";

describe("zrSendState", () => {
  it("swap status is swapped even without a link", () => {
    expect(zrSendState({ swapped_to_order_id: null, delivery_status: "swap" })).toEqual({ ok: false, reason: "swapped" });
  });
  it("link wins", () => {
    expect(zrSendState({ swapped_to_order_id: "o2", delivery_status: "wait_for_deposit" })).toEqual({ ok: false, reason: "swapped" });
  });
  it("other status and sendable", () => {
    expect(zrSendState({ swapped_to_order_id: null, delivery_status: "delayed" })).toEqual({ ok: false, reason: "status" });
    expect(zrSendState({ swapped_to_order_id: null, delivery_status: "wait_for_deposit" })).toEqual({ ok: true });
  });
});
