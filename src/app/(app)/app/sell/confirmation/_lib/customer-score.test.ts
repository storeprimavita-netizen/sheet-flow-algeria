import { describe, expect, test } from "vitest";
import { parseCustomerScore } from "./customer-score";

const linked = {
  id: "11111111-1111-4111-8111-111111111111",
  total: 3, delivered: 0, returned: 0, cancelled: 0, noAnswer: 1,
  score: 0, state: "neutral", reason: "no_answer", lifetime: 900,
  lastAt: null, confirmation: null, delivery: null, productOrders: null, deliveryRate: null,
};

describe("confirmation customer snapshot", () => {
  test("keeps visible scope and adverse reasons at zero while dropping restricted fields", () => {
    const result = parseCustomerScore({
      scope: "visible", customer: { ...linked, phone: "ignored", cost: 400 }, related: [], hasMore: false,
    }, false);
    expect(result).toMatchObject({ status: "ready", data: { customer: { score: 0, reason: "no_answer", deliveryRate: null } } });
    expect(result).not.toHaveProperty("data.customer.lifetime");
    expect(result).not.toHaveProperty("data.customer.phone");
    expect(result).not.toHaveProperty("data.customer.cost");
  });

  test("distinguishes unlinked, empty, new and unscored states", () => {
    const data = { scope: "workspace", related: [], hasMore: false };
    expect(parseCustomerScore(null, true)).toEqual({ status: "empty" });
    expect(parseCustomerScore({ ...data, customer: null }, true)).toMatchObject({ status: "ready", data: { customer: null } });
    for (const [state, reason] of [["new", "no_history"], ["unscored", "unscored"]]) {
      expect(parseCustomerScore({ ...data, customer: { ...linked, score: null, state, reason } }, true))
        .toMatchObject({ status: "ready", data: { customer: { score: null, state, lifetime: 900 } } });
    }
  });

  test("fails safely when the scope or payload is unexpected", () => {
    expect(parseCustomerScore({ scope: "workspace", customer: linked, related: [], hasMore: false }, false))
      .toEqual({ status: "error" });
    expect(parseCustomerScore({ scope: "workspace", customer: { id: linked.id }, related: [] }, true))
      .toEqual({ status: "error" });
  });
});
