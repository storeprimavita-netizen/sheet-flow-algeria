import { describe, expect, test } from "vitest";

import { canDropOnColumn, groupKanbanRows, kanbanTargets, moveKanbanRow, type KanbanRow } from "./kanban";

const row = (id: string, fields: Partial<KanbanRow> = {}): KanbanRow => ({
  id, orderSeq: 1, customerName: null, customerPhone: null, productId: null,
  productName: null, wilayaCode: null, wilayaName: null, status: "wait_for_confirmation", ...fields,
});

describe("order board", () => {
  test("groups by stable identities, includes missing items and keeps each group's order", () => {
    const rows = [
      row("first", { productId: "a", productName: "Same", attempts: 3, wilayaCode: 16, wilayaName: "Alger" }),
      row("other", { productId: "b", productName: "Same", attempts: 0, wilayaCode: 8, wilayaName: "Bechar" }),
      row("missing"),
      row("second", { productId: "a", productName: "Same", attempts: 3, wilayaCode: 16, wilayaName: "Alger" }),
    ];
    const groups = groupKanbanRows(rows, "product", "confirmation");
    expect(groups.map((column) => [column.key, column.label, column.rows.map((item) => item.id)])).toEqual([
      ["a", "Same", ["first", "second"]], ["b", "Same", ["other"]], ["missing", null, ["missing"]],
    ]);
    expect(groupKanbanRows(rows, "attempts", "confirmation").map((column) => column.key)).toEqual(["0", "3", "missing"]);
    expect(groupKanbanRows(rows, "wilaya", "confirmation").map((column) => column.key)).toEqual(["8", "16", "missing"]);
  });

  test("both controls use the stage and role rules, and only status columns accept moves", () => {
    const confirmation = row("pending");
    const shipping = row("shipping", { status: "in_transit" });
    expect(kanbanTargets("confirmation", false, confirmation).map((target) => target.key)).toContain("confirmed");
    expect(canDropOnColumn("confirmation", false, "status", confirmation, "confirmed")).toBe(true);
    expect(canDropOnColumn("confirmation", false, "product", confirmation, "confirmed")).toBe(false);
    expect(canDropOnColumn("confirmation", false, "status", { ...confirmation, locked: true }, "confirmed")).toBe(false);
    expect(kanbanTargets("shipping", false, shipping)).toEqual([]);
    expect(canDropOnColumn("shipping", false, "status", shipping, "delivered")).toBe(false);
    expect(canDropOnColumn("shipping", true, "status", shipping, "delivered")).toBe(true);
    expect(canDropOnColumn("shipping", true, "status", shipping, "swap")).toBe(false);
    expect(kanbanTargets("shipping", true, { ...shipping, status: "swap" })).toEqual([]);
    expect(kanbanTargets("all", true, { ...confirmation, deliveryStatus: "swap" })).toEqual([]);
  });

  test("an optimistic move changes only the target card and never mutates authoritative rows", () => {
    const rows = [row("one"), row("two")];
    const moved = moveKanbanRow(rows, { orderId: "one", status: "confirmed" });
    const columns = (items: KanbanRow[]) => groupKanbanRows(items, "status", "confirmation");
    expect(columns(moved).find((column) => column.key === "confirmed")?.rows.map((item) => item.id)).toEqual(["one"]);
    expect(columns(rows).find((column) => column.key === "wait_for_confirmation")?.rows.map((item) => item.id)).toEqual(["one", "two"]);
    expect(moved[1]).toBe(rows[1]);
  });
});
