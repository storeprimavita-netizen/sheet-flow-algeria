import { describe, expect, test } from "vitest";
import { diffRows } from "./diff";

describe("diffRows", () => {
  test("secret-only change gives two fingerprints", () => {
    const [c] = diffRows({ secret: "whsec_old" }, { secret: "whsec_new" });
    expect(c.from.redacted && c.to.redacted).toBe(true);
    expect(c.from.fingerprint).not.toBe(c.to.fingerprint);
    expect(JSON.stringify(c)).not.toMatch(/whsec_|sk_/);
  });
  test("unchanged secret yields no entry", () => {
    expect(diffRows({ secret: "same", n: 1 }, { secret: "same", n: 1 })).toEqual([]);
  });
  test("missing key shows an empty-set mark", () => {
    const [c] = diffRows(null, { name: "x" });
    expect(c.from).toEqual({ text: "∅", redacted: false });
  });
  test("value already masked in the DB under a secret key is redacted", () => {
    const [c] = diffRows({ api_key: "[redacted:aaaaaaaa]" }, { api_key: "[redacted:bbbbbbbb]" });
    expect(c.from).toMatchObject({ redacted: true, fingerprint: "aaaaaaaa" });
    expect(c.to).toMatchObject({ redacted: true, fingerprint: "bbbbbbbb" });
  });
  test("any mask token shows a pill, including one made at the depth cap", () => {
    const [c] = diffRows({ name: "a" }, { name: "[redacted:deadbeef]" });
    expect(c.to).toMatchObject({ redacted: true, fingerprint: "deadbeef" });
  });
  test("prefixed secret under an innocent key is masked here", () => {
    const [c] = diffRows({ note: "a" }, { note: "sk_live_123" });
    expect(c.to.redacted).toBe(true);
    expect(JSON.stringify(c)).not.toContain("sk_live");
  });
  test("nested config secret becomes a dotted-key pill", () => {
    const rows = diffRows({ config: { api_key: "K1", tenant_id: "t1" } }, { config: { api_key: "K2", tenant_id: "t1" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("config › api_key");
    expect(rows[0].from.redacted && rows[0].to.redacted).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/K1|K2/);
  });
  test("settings key/value row with a secret key shows the pill on value", () => {
    const [c] = diffRows(
      { key: "telegram.token", value: "[redacted:d2409090]" },
      { key: "telegram.token", value: "[redacted:11111111]" },
    );
    expect(c.key).toBe("value");
    expect(c.from).toMatchObject({ redacted: true, fingerprint: "d2409090" });
    expect(c.to).toMatchObject({ redacted: true, fingerprint: "11111111" });
  });
  test("colliding paths and empty keys stay distinct", () => {
    const rows = diffRows({ "a.b": 1, "": 1, a: { b: 1 } }, { "a.b": 2, "": 2, a: { b: 3 } });
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
    expect(rows.map((r) => r.key).sort()).toEqual(["", "\"a.b\"", "a › b"]);
  });
  test("object to array at the same path is a change", () => {
    expect(diffRows({ items: { "0": "a" } }, { items: ["a"] })).toHaveLength(2);
  });
  test("empty key is not dropped and root is not a change", () => {
    const rows = diffRows({ "": "x" }, { "": "y" });
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("");
    expect(diffRows({}, {})).toEqual([]);
  });
  test("updated_at is skipped at the top level only", () => {
    const rows = diffRows({ updated_at: "1", meta: { updated_at: "1" } }, { updated_at: "2", meta: { updated_at: "2" } });
    expect(rows.map((r) => r.key)).toEqual(["meta › updated_at"]);
  });
  test("array elements get index segments; a secret inside shows a pill", () => {
    const rows = diffRows({ items: [{ api_key: "A" }] }, { items: [{ api_key: "B" }] });
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("items › [0] › api_key");
    expect(rows[0].from.redacted && rows[0].to.redacted).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/"A"|"B"/);
  });
  test("labels: index vs key '0', and a key containing the separator, are distinguishable", () => {
    const idx = diffRows({ items: ["a"] }, { items: ["b"] })[0].key;
    const key0 = diffRows({ items: { "0": "a" } }, { items: { "0": "b" } })[0].key;
    expect(idx).toBe("items › [0]");
    expect(key0).toBe("items › 0");
    const sep = diffRows({ "a › b": 1 }, { "a › b": 2 })[0].key;
    const nested = diffRows({ a: { b: 1 } }, { a: { b: 2 } })[0].key;
    expect(sep).toBe('"a › b"');
    expect(nested).toBe("a › b");
    expect(diffRows({ "a.b": 1 }, { "a.b": 2 })[0].key).toBe('"a.b"');
    expect(diffRows({ items: [{ x: 1 }] }, { items: [{ x: 2 }] })[0].key).toBe("items › [0] › x");
  });
});
